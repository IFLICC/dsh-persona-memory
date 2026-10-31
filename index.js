/**
 * @local/dsh-persona-memory — Host half.
 *
 * Keeps a persona (character card) in the system prompt, remembers facts with an
 * Ebbinghaus-style forgetting curve, and can keep a diary. The Web settings page
 * talks to this file over the routes below.
 */
import { readFileSync } from 'node:fs'
import { PersonaStore, buildPersonaPrompt, buildPersonaOffReminder } from './lib/store.js'
import { compareSemver } from './lib/version.js'

const API_BASE = '/api/dsh-persona-memory'
const STICKER_ROUTE = `${API_BASE}/sticker`
const MAX_BODY_BYTES = 8 * 1024 * 1024
const REPO_URL = 'https://github.com/ifenc/dsh-persona-memory'
const RAW_PACKAGE_URL = 'https://raw.githubusercontent.com/ifenc/dsh-persona-memory/main/package.json'
const UPDATE_SOURCES = [
  RAW_PACKAGE_URL,
  'https://cdn.jsdelivr.net/gh/ifenc/dsh-persona-memory@main/package.json',
  'https://api.github.com/repos/ifenc/dsh-persona-memory/contents/package.json?ref=main',
]

let PLUGIN_VERSION = '0.0.0'
try {
  const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))
  if (typeof pkg.version === 'string' && pkg.version.trim()) PLUGIN_VERSION = pkg.version.trim()
} catch {
  /* keep the fallback version */
}

export const inject = ['tools', 'systemPrompt', 'webServer', 'agents', 'sessions', 'workingDirectory']

function blocksToText(content) {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  const parts = []
  for (const block of content) {
    if (block && block.type === 'text' && typeof block.text === 'string') parts.push(block.text)
  }
  return parts.join('\n')
}

function truncate(text, length) {
  const value = String(text ?? '').replace(/\s+/g, ' ').trim()
  return value.length > length ? `${value.slice(0, length - 1)}…` : value
}

function clock(timestamp) {
  const date = new Date(timestamp)
  const pad = (value) => String(value).padStart(2, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        reject(new Error('request body too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      if (!raw.trim()) return resolve({})
      try {
        const parsed = JSON.parse(raw)
        resolve(parsed && typeof parsed === 'object' ? parsed : {})
      } catch {
        reject(new Error('invalid JSON body'))
      }
    })
    req.on('error', reject)
  })
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
  })
  res.end(body)
}

let updateCheckCache = { at: 0, value: null }

async function fetchRemoteVersion() {
  let lastError = null
  for (const url of UPDATE_SOURCES) {
    try {
      const response = await fetch(url, {
        headers: {
          'user-agent': `dsh-persona-memory/${PLUGIN_VERSION}`,
          accept: 'application/vnd.github.raw',
        },
        signal: AbortSignal.timeout(6000),
        cache: 'no-store',
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const text = await response.text()
      let pkg = null
      try {
        pkg = JSON.parse(text)
      } catch {
        pkg = null
      }
      if (pkg && typeof pkg.version === 'string' && pkg.version.trim()) {
        return { version: pkg.version.trim(), source: url }
      }
      if (pkg && typeof pkg.content === 'string') {
        const decoded = JSON.parse(Buffer.from(pkg.content, 'base64').toString('utf8'))
        if (decoded && typeof decoded.version === 'string' && decoded.version.trim()) {
          return { version: decoded.version.trim(), source: url }
        }
      }
      throw new Error('响应里没有 version')
    } catch (error) {
      lastError = error
    }
  }
  throw lastError ?? new Error('没有可用的更新源')
}

async function checkForUpdate() {
  const now = Date.now()
  if (updateCheckCache.value && now - updateCheckCache.at < 5 * 60 * 1000) {
    return { ...updateCheckCache.value, cached: true }
  }
  let remote
  try {
    remote = await fetchRemoteVersion()
  } catch (error) {
    const cause = error && error.cause && error.cause.message ? `（${error.cause.message}）` : ''
    return {
      ok: false,
      current: PLUGIN_VERSION,
      repo: REPO_URL,
      error: `${error instanceof Error ? error.message : String(error)}${cause}`,
    }
  }
  const value = {
    ok: true,
    current: PLUGIN_VERSION,
    latest: remote.version,
    updateAvailable: compareSemver(remote.version, PLUGIN_VERSION) > 0,
    repo: REPO_URL,
    releases: `${REPO_URL}/releases`,
    source: remote.source,
    checkedAt: Date.now(),
  }
  updateCheckCache = { at: value.checkedAt, value }
  return value
}

function memoryView(store, memory, now) {
  return store.publicMemory(memory, now)
}

function memoryLine(store, memory, now) {
  const retention = Math.round(store.retention(memory, now) * 100)
  const tags = memory.tags.length ? ` #${memory.tags.join(' #')}` : ''
  return `[${retention}% · 重要度 ${memory.importance}${memory.pinned ? ' · 置顶' : ''}${tags}] ${truncate(memory.text, 160)}`
}

export function apply(ctx) {
  const store = new PersonaStore()
  ctx.effect(() => () => store.dispose(), 'persona-memory: flush store')

  const stickerUrl = (id) => {
    let origin = ''
    try {
      origin = ctx.webServer.getOrigin()
    } catch {
      origin = ''
    }
    return `${origin}${STICKER_ROUTE}/${id}`
  }

  /* ---------------------------------------------------------------- */
  /* System prompt — one scoped section per root conversation          */
  /* ---------------------------------------------------------------- */

  const agentSections = new Map()
  const recentQueries = new Map()

  const registerAgentSection = (agent) => {
    const id = agent?.id ? String(agent.id) : ''
    if (!id || agentSections.has(id)) return
    let session
    try {
      session = ctx.sessions.get(agent.id)
    } catch {
      session = undefined
    }
    if (!session) return
    if (session.header?.origin === 'subagent') return
    try {
      const dispose = agent.ctx.systemPrompt.section({
        name: 'persona-memory',
        order: 10,
        interpolate: false,
        text: () => {
          if (store.isSessionPersona(id)) {
            return buildPersonaPrompt(store, Date.now(), recentQueries.get(id) ?? '')
          }
          if (store.isPersonaOffReminder(id)) return buildPersonaOffReminder()
          return ''
        },
      })
      agentSections.set(id, dispose)
    } catch {
      /* a prompt-section failure must not abort agent creation */
    }
  }

  ctx.effect(
    () => () => {
      for (const dispose of agentSections.values()) {
        try {
          dispose()
        } catch {
          /* already disposed with its agent */
        }
      }
      agentSections.clear()
    },
    'persona-memory: dispose agent prompt sections',
  )

  ctx.on('agent/created', (payload) => {
    try {
      registerAgentSection(payload?.agent)
    } catch {
      /* never fail agent creation because of this plugin */
    }
  })

  ctx.on('agent/disposed', (payload) => {
    const id = payload?.agent?.id ? String(payload.agent.id) : ''
    if (!id) return
    agentSections.delete(id)
    recentQueries.delete(id)
  })

  try {
    for (const agent of ctx.agents.roots()) registerAgentSection(agent)
  } catch {
    /* the registry may not be ready during activation */
  }

  /* ---------------------------------------------------------------- */
  /* Agent tools                                                       */
  /* ---------------------------------------------------------------- */

  const personaTool = {
    name: 'persona',
    description:
      'Manage the active persona (character card) and this conversation\'s persona mode. Use when the user asks to change who you are, inspect the current character card, or turn the persona on/off in the current conversation.',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['status', 'enable', 'disable', 'card_get', 'card_update', 'card_create', 'card_activate', 'card_delete'],
          description: 'Operation to perform.',
        },
        card_id: { type: 'string', description: 'Character card id for card_activate/card_delete.' },
        name: { type: 'string', description: 'Character name.' },
        title: { type: 'string', description: 'Short role or title, e.g. "你的长期记忆伙伴".' },
        description: { type: 'string', description: 'Legacy shorthand for the 人格描述 section.' },
        style: { type: 'string', description: 'Legacy shorthand for the 说话风格 section.' },
        rules: { type: 'array', items: { type: 'string' }, description: 'Legacy shorthand for 准则 sections.' },
        sections: {
          type: 'array',
          description:
            'Full character-card sections, in order. Custom labels are allowed (e.g. 口癖, 世界观, 禁忌). When provided, replaces description/style/rules.',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'Existing section id; omit for a new section.' },
              label: { type: 'string', description: 'Section title shown in the prompt.' },
              content: { type: 'string', description: 'Section body.' },
            },
            required: ['label', 'content'],
            additionalProperties: false,
          },
        },
        traits: {
          type: 'array',
          description:
            'Behavior weight entries from 0 to 100. Users may add custom labels (e.g. 毒舌, 黏人) and delete built-in entries.',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'Existing trait id; omit for a new one.' },
              key: {
                type: 'string',
                description: 'Built-in key when editing a built-in trait, otherwise omit.',
              },
              label: { type: 'string', description: 'Trait name shown in the prompt.' },
              value: { type: 'integer', minimum: 0, maximum: 100, description: 'Weight value.' },
            },
            required: ['label', 'value'],
            additionalProperties: false,
          },
        },
        greeting: { type: 'string', description: 'Opening line used for introductions.' },
        sticker_enabled: {
          type: 'boolean',
          description: 'Whether this character may send stickers in replies.',
        },
      },
      required: ['action'],
      additionalProperties: false,
    },
    output: {
      schema: { type: 'object' },
      render: (_args, value) => [{ type: 'text', text: typeof value?.summary === 'string' ? value.summary : 'persona operation finished' }],
    },
    async execute(args = {}, exec) {
      const action = String(args.action ?? 'status')
      const sessionId = exec?.agent?.id ? String(exec.agent.id) : ''
      if ((action === 'enable' || action === 'disable') && !sessionId) {
        throw new Error('当前没有可用的对话')
      }
      if (action === 'enable' || action === 'disable') {
        store.setSessionPersona(sessionId, action === 'enable')
      }
      if (action === 'card_update' || action === 'card_create') {
        const patch = {}
        for (const key of ['name', 'title', 'greeting']) {
          if (args[key] !== undefined) patch[key] = args[key]
        }
        if (args.sticker_enabled !== undefined) patch.stickerEnabled = args.sticker_enabled
        if (args.sections !== undefined) {
          patch.sections = Array.isArray(args.sections) ? args.sections : []
        }
        if (args.traits !== undefined) patch.traits = args.traits
        const legacyProvided =
          args.description !== undefined || args.style !== undefined || args.rules !== undefined
        if (legacyProvided && args.sections === undefined) {
          if (action === 'card_create') {
            for (const key of ['description', 'style']) {
              if (args[key] !== undefined) patch[key] = args[key]
            }
            if (args.rules !== undefined) patch.rules = Array.isArray(args.rules) ? args.rules : []
          } else {
            const targetId = args.card_id || store.activeCard()?.id
            const target = store.state.cards.find((card) => card.id === targetId)
            if (!target) throw new Error('人物卡不存在')
            let sections = target.sections.map((section) => ({ ...section }))
            const setSection = (label, content) => {
              const index = sections.findIndex((section) => section.label === label)
              if (index >= 0) sections[index] = { ...sections[index], content }
              else sections.push({ label, content })
            }
            if (args.description !== undefined) setSection('人格描述', args.description)
            if (args.style !== undefined) setSection('说话风格', args.style)
            if (args.rules !== undefined) {
              sections = sections.filter((section) => !section.label.startsWith('准则'))
              ;(Array.isArray(args.rules) ? args.rules : []).forEach((rule, index) => {
                sections.push({ label: `准则 ${index + 1}`, content: String(rule ?? '') })
              })
            }
            patch.sections = sections
          }
        }
        if (action === 'card_update') {
          patch.id = args.card_id || store.activeCard()?.id
          if (!patch.id) throw new Error('没有可更新的人物卡')
          store.saveCard(patch)
        } else {
          const created = store.createCard(patch)
          store.activateCard(created.id)
        }
      }
      if (action === 'card_activate') {
        if (!args.card_id) throw new Error('card_id is required')
        if (!store.activateCard(String(args.card_id))) throw new Error('人物卡不存在')
      }
      if (action === 'card_delete') {
        if (!args.card_id) throw new Error('card_id is required')
        store.deleteCard(String(args.card_id))
      }
      const state = store.publicState()
      const card = state.activeCard
      const sessionEnabled = sessionId ? store.isSessionPersona(sessionId) : false
      const lines = [
        `本对话人设：${sessionEnabled ? '已开启' : '已关闭'}`,
        `已开启人设的对话：${state.settings.personaSessions.length} 个`,
        card ? `当前人物卡：${card.name}${card.title ? ` · ${card.title}` : ''}（${card.id}）` : '当前没有人物卡',
        `记忆 ${state.stats.active} 条（${state.stats.due} 条待复习，${state.stats.forgotten} 条已遗忘）｜日记 ${state.stats.diaries} 篇｜资料库 ${state.stats.library} 条｜表情包 ${state.stats.stickers} 个`,
      ]
      if (card?.sections?.length) {
        lines.push(`卡片条目（${card.sections.length}）：${card.sections.map((section) => section.label).join('、')}`)
        for (const section of card.sections.slice(0, 6)) {
          lines.push(`- ${section.label}：${truncate(section.content, 120)}`)
        }
      }
      if (card?.traits?.length) {
        lines.push(
          `表现权重：${card.traits.map((trait) => `${trait.label} ${trait.value}`).join(' · ')}`,
        )
      }
      lines.push(`可用人物卡：${state.cards.map((entry) => `${entry.name}（${entry.id}）`).join('、')}`)
      return {
        summary: lines.join('\n'),
        enabled: sessionEnabled,
        card,
        cards: state.cards,
        stats: state.stats,
        personaSessions: state.settings.personaSessions.length,
      }
    },
  }

  const memoryTool = {
    name: 'persona_memory',
    description:
      'Read and maintain long-term memories that fade over time (Ebbinghaus forgetting curve). Remember durable facts with "remember", search and reinforce them with "recall", and deepen due memories with "review".',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['remember', 'recall', 'review', 'forget', 'list', 'stats'],
          description: 'Operation to perform.',
        },
        text: { type: 'string', description: 'The fact to remember (one self-contained sentence).' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Topic tags for retrieval.' },
        importance: { type: 'integer', minimum: 1, maximum: 5, description: '1 = trivia, 5 = central to the relationship.' },
        pinned: { type: 'boolean', description: 'Pin the memory so it never fades.' },
        query: { type: 'string', description: 'Search text for recall/list.' },
        ids: { type: 'array', items: { type: 'string' }, description: 'Memory ids to review.' },
        id: { type: 'string', description: 'Memory id to forget.' },
        limit: { type: 'integer', minimum: 1, maximum: 30, description: 'Maximum entries to return.' },
      },
      required: ['action'],
      additionalProperties: false,
    },
    output: {
      schema: { type: 'object' },
      render: (_args, value) => [{ type: 'text', text: typeof value?.summary === 'string' ? value.summary : 'memory operation finished' }],
    },
    async execute(args = {}, exec) {
      const action = String(args.action ?? 'stats')
      const now = Date.now()
      if (action === 'remember') {
        const memory = store.addMemory({
          text: args.text,
          tags: args.tags,
          importance: args.importance,
          pinned: args.pinned,
          source: 'model',
          sessionId: exec?.agent?.id ? String(exec.agent.id) : '',
        })
        return {
          summary: `已记住：${memoryLine(store, memory, now)}`,
          memory: memoryView(store, memory, now),
        }
      }
      if (action === 'recall') {
        const memories = store.recall(String(args.query ?? ''), Number(args.limit) || 5)
        return {
          summary: memories.length
            ? memories.map((memory) => memoryLine(store, memory, now)).join('\n')
            : '没有找到相关记忆。',
          memories: memories.map((memory) => memoryView(store, memory, now)),
        }
      }
      if (action === 'review') {
        const reviewed = Array.isArray(args.ids) && args.ids.length
          ? store.review(args.ids.map(String))
          : store.reviewDue(Number(args.limit) || 5)
        return {
          summary: reviewed.length
            ? `已加深 ${reviewed.length} 条记忆：\n${reviewed.map((memory) => memoryLine(store, memory, now)).join('\n')}`
            : '当前没有需要复习的记忆。',
          memories: reviewed.map((memory) => memoryView(store, memory, now)),
        }
      }
      if (action === 'forget') {
        if (!args.id) throw new Error('id is required')
        const forgotten = store.forget(String(args.id))
        if (!forgotten) throw new Error('记忆不存在')
        return { summary: `已遗忘：${truncate(forgotten.text, 120)}`, forgotten: true }
      }
      if (action === 'list') {
        const cardId = store.state.activeCardId
        const activeMemories = store.state.memories.filter((memory) => memory.cardId === cardId)
        const tokens = String(args.query ?? '').trim().toLowerCase()
        const limit = Math.min(30, Number(args.limit) || 10)
        const memories = activeMemories
          .filter((memory) => !tokens || memory.text.toLowerCase().includes(tokens))
          .sort((a, b) => {
            if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
            return store.retention(b, now) * b.importance - store.retention(a, now) * a.importance
          })
          .slice(0, limit)
        return {
          summary: memories.length
            ? `${activeMemories.length} 条记忆中最近的 ${memories.length} 条：\n${memories
                .map((memory) => memoryLine(store, memory, now))
                .join('\n')}`
            : '还没有任何记忆。',
          memories: memories.map((memory) => memoryView(store, memory, now)),
          total: activeMemories.length,
        }
      }
      const cardId = store.state.activeCardId
      const stats = store.stats(now)
      const recent = store.state.memories
        .filter((memory) => memory.cardId === cardId)
        .sort((a, b) => b.lastReviewedAt - a.lastReviewedAt)
        .slice(0, 5)
        .map((memory) => memoryLine(store, memory, now))
      return {
        summary: `记忆 ${stats.active} 条｜待复习 ${stats.due} 条｜已遗忘 ${stats.forgotten} 条｜平均清晰度 ${Math.round(stats.avgRetention * 100)}%${
          recent.length ? `\n最近：\n${recent.join('\n')}` : ''
        }`,
        stats,
        recent: recent.length,
      }
    },
  }

  const diaryTool = {
    name: 'persona_diary',
    description:
      'Write and read the persona diary. When diary mode is on, use it at natural end points of a conversation to keep a short, first-person record of what happened and how it felt.',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['write', 'list', 'read', 'delete'],
          description: 'Operation to perform.',
        },
        title: { type: 'string', description: 'Short diary title.' },
        body: { type: 'string', description: 'Diary body, 1-3 sentences in the persona voice.' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Topic tags.' },
        date: { type: 'string', description: 'YYYY-MM-DD, defaults to today.' },
        id: { type: 'string', description: 'Diary id for read/delete.' },
        limit: { type: 'integer', minimum: 1, maximum: 50, description: 'Maximum entries to return.' },
      },
      required: ['action'],
      additionalProperties: false,
    },
    output: {
      schema: { type: 'object' },
      render: (_args, value) => [{ type: 'text', text: typeof value?.summary === 'string' ? value.summary : 'diary operation finished' }],
    },
    async execute(args = {}, exec) {
      const action = String(args.action ?? 'list')
      if (action === 'write') {
        const diary = store.addDiary({
          title: args.title,
          body: args.body,
          tags: args.tags,
          date: args.date,
          source: 'model',
          sessionId: exec?.agent?.id ? String(exec.agent.id) : '',
        })
        return { summary: `日记已写入（${diary.date}）：${truncate(diary.title, 80)}`, diary }
      }
      if (action === 'read') {
        if (!args.id) throw new Error('id is required')
        const cardId = store.state.activeCardId
        const diary = store.state.diaries.find(
          (entry) => entry.id === String(args.id) && entry.cardId === cardId,
        )
        if (!diary) throw new Error('日记不存在')
        return { summary: `${diary.date} · ${diary.title}\n${diary.body}`, diary }
      }
      if (action === 'delete') {
        if (!args.id) throw new Error('id is required')
        const cardId = store.state.activeCardId
        const diary = store.state.diaries.find(
          (entry) => entry.id === String(args.id) && entry.cardId === cardId,
        )
        if (!diary || !store.deleteDiary(diary.id)) throw new Error('日记不存在')
        return { summary: '日记已删除', deleted: true }
      }
      const limit = Math.min(50, Number(args.limit) || 10)
      const cardId = store.state.activeCardId
      const diaries = store.state.diaries
        .filter((entry) => entry.cardId === cardId)
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, limit)
      return {
        summary: diaries.length
          ? diaries.map((entry) => `- ${entry.date} ${entry.title}：${truncate(entry.body, 120)}`).join('\n')
          : '日记本还是空的。',
        diaries,
      }
    },
  }

  const libraryTool = {
    name: 'persona_library',
    description:
      "Search, read and maintain the current character's reference library: memes, knowledge notes, and web references. Search before answering when a topic may be covered; after learning something new from the web or conversation, add a concise entry (with url when available).",
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['search', 'get', 'add', 'update', 'delete', 'list'],
          description: 'Operation to perform.',
        },
        query: { type: 'string', description: 'Search text for search/list.' },
        id: { type: 'string', description: 'Entry id for get/update/delete.' },
        title: { type: 'string', description: 'Short entry title.' },
        content: { type: 'string', description: 'Knowledge, meme explanation, or reference notes.' },
        kind: { type: 'string', enum: ['meme', 'knowledge', 'reference', 'note'], description: 'Entry kind.' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Topic tags.' },
        url: { type: 'string', description: 'Source URL when learned from the web.' },
        limit: { type: 'integer', minimum: 1, maximum: 50, description: 'Maximum entries to return.' },
      },
      required: ['action'],
      additionalProperties: false,
    },
    output: {
      schema: { type: 'object' },
      render: (_args, value) => [{ type: 'text', text: typeof value?.summary === 'string' ? value.summary : 'library operation finished' }],
    },
    async execute(args = {}) {
      const action = String(args.action ?? 'search')
      const limit = Math.min(50, Number(args.limit) || 8)
      if (action === 'search' || action === 'list') {
        const entries = store.listLibrary({
          query: String(args.query ?? ''),
          kind: String(args.kind ?? ''),
          limit,
        })
        return {
          summary: entries.length
            ? entries
                .map((entry) => {
                  const tags = entry.tags.length ? ` #${entry.tags.join(' #')}` : ''
                  const url = entry.url ? ` · ${entry.url}` : ''
                  return `- [${entry.kind}] ${entry.title}${tags}${url}\n  ${truncate(entry.content, 180)}`
                })
                .join('\n')
            : '资料库里没有匹配的内容。',
          entries: entries.map((entry) => ({
            id: entry.id,
            title: entry.title,
            kind: entry.kind,
            tags: [...entry.tags],
            url: entry.url,
            preview: truncate(entry.content, 200),
            updatedAt: entry.updatedAt,
          })),
          count: entries.length,
        }
      }
      if (action === 'get') {
        if (!args.id) throw new Error('id is required')
        const entry = store.getLibrary(String(args.id))
        if (!entry) throw new Error('资料不存在')
        return {
          summary: `[${entry.kind}] ${entry.title}\n${entry.content}${entry.url ? `\n${entry.url}` : ''}`,
          entry: { ...entry, tags: [...entry.tags] },
        }
      }
      if (action === 'add') {
        if (!args.title && !args.content) throw new Error('title or content is required')
        const result = store.addLibrary({
          title: args.title,
          content: args.content,
          kind: args.kind,
          tags: args.tags,
          url: args.url,
          source: args.url ? 'web' : 'model',
        })
        return {
          summary: result.updated
            ? `资料已更新：${result.entry.title}`
            : `资料已存入：${result.entry.title}`,
          entry: { ...result.entry, tags: [...result.entry.tags] },
          updated: result.updated,
        }
      }
      if (action === 'update') {
        if (!args.id) throw new Error('id is required')
        const patch = {}
        for (const key of ['title', 'content', 'kind', 'tags', 'url']) {
          if (args[key] !== undefined) patch[key] = args[key]
        }
        const entry = store.updateLibrary(String(args.id), patch)
        if (!entry) throw new Error('资料不存在')
        return { summary: `资料已更新：${entry.title}`, entry: { ...entry, tags: [...entry.tags] } }
      }
      if (action === 'delete') {
        if (!args.id) throw new Error('id is required')
        if (!store.deleteLibrary(String(args.id))) throw new Error('资料不存在')
        return { summary: '资料已删除', deleted: true }
      }
      throw new Error(`unknown library action: ${action}`)
    },
  }

  const stickerTool = {
    name: 'persona_sticker',
    description:
      "Send a sticker from the current character's sticker library. Call action send to get a Markdown image, then put that Markdown on its own line in your reply. Only use a sticker when it fits the mood; do not send one every turn and never invent an image URL.",
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['send', 'list', 'search'],
          description: 'Operation to perform.',
        },
        id: { type: 'string', description: 'Sticker id for send.' },
        name: { type: 'string', description: 'Sticker name for send.' },
        query: { type: 'string', description: 'Search text for list/search.' },
        limit: { type: 'integer', minimum: 1, maximum: 50, description: 'Maximum stickers to return.' },
      },
      required: ['action'],
      additionalProperties: false,
    },
    output: {
      schema: { type: 'object' },
      render: (_args, value) => [{ type: 'text', text: typeof value?.summary === 'string' ? value.summary : 'sticker operation finished' }],
    },
    async execute(args = {}) {
      const card = store.activeCard()
      if (!card) throw new Error('没有人物卡')
      if (card.stickerEnabled === false) throw new Error('当前人物卡没有开启表情包')
      const action = String(args.action ?? 'list')
      if (action === 'send') {
        let sticker = null
        if (args.id) sticker = store.getSticker(String(args.id))
        if (!sticker && args.name) {
          const needle = String(args.name).trim().toLowerCase()
          const entries = store.listStickers()
          sticker =
            entries.find((entry) => entry.name.toLowerCase() === needle) ||
            entries.find((entry) => entry.name.toLowerCase().includes(needle))
        }
        if (!sticker) throw new Error('表情包不存在')
        const alt = sticker.name.replace(/[\[\]\\]/g, ' ').trim() || 'sticker'
        const markdown = `![${alt}](${stickerUrl(sticker.id)})`
        return {
          summary: `已准备表情包「${sticker.name}」。把下面这一行原样放进回复：\n${markdown}`,
          markdown,
          sticker,
        }
      }
      const limit = Math.min(50, Number(args.limit) || 20)
      const stickers = store.listStickers({ query: String(args.query ?? '') }).slice(0, limit)
      return {
        summary: stickers.length
          ? stickers
              .map((sticker) => {
                const tags = sticker.tags.length ? ` #${sticker.tags.join(' #')}` : ''
                return `- ${sticker.name}${tags}（${sticker.id}）`
              })
              .join('\n')
          : '表情库里没有匹配的内容。',
        stickers,
      }
    },
  }

  for (const tool of [personaTool, memoryTool, diaryTool, libraryTool, stickerTool]) {
    ctx.effect(() => ctx.tools.register(tool), `persona-memory: ${tool.name} tool`)
  }

  /* ---------------------------------------------------------------- */
  /* Local practice: recent query + automatic diary digest             */
  /* ---------------------------------------------------------------- */

  const turnBuffers = new Map()

  ctx.on('agent/inbox/claimed', (payload) => {
    const agent = payload?.agent
    const text = blocksToText(payload?.message?.content).trim()
    if (!text) return
    const key = agent?.id ? String(agent.id) : ''
    if (!key) return
    recentQueries.set(key, truncate(text, 400))
    const buffer = turnBuffers.get(key) ?? []
    buffer.push({ text, at: Date.now() })
    if (buffer.length > 20) buffer.shift()
    turnBuffers.set(key, buffer)
  })

  ctx.on('agent/turn-stopping', (payload) => {
    const agent = payload?.agent
    const key = agent?.id ? String(agent.id) : ''
    const buffer = key ? turnBuffers.get(key) : undefined
    if (key) turnBuffers.delete(key)
    if (!buffer || buffer.length === 0) return
    const settings = store.state.settings
    if (!settings.diaryEnabled || !settings.autoDigest) return
    if (!store.isSessionPersona(key)) return
    let session
    try {
      session = key ? ctx.sessions.get(agent.id) : undefined
    } catch {
      session = undefined
    }
    if (!session) return
    if (session.header?.origin === 'subagent') return
    const card = store.activeCard()
    const lines = buffer.map((item) => `- ${clock(item.at)} 用户：${truncate(item.text, 160)}`)
    try {
      store.addDiary({
        title: `和${card?.name ?? '你'}说的话 · ${clock(buffer[0].at)}`,
        body: lines.join('\n'),
        tags: ['自动摘要'],
        source: 'local',
        sessionId: key,
      })
    } catch {
      /* a diary write must never fail a turn */
    }
  })

  /* ---------------------------------------------------------------- */
  /* Web API for the settings page                                     */
  /* ---------------------------------------------------------------- */

  const buildState = () => ({ ...store.publicState(), version: PLUGIN_VERSION })

  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: 'prefix',
        path: API_BASE,
        handler: async (req, res) => {
          try {
            const url = new URL(req.url ?? '/', 'http://localhost')
            const route = url.pathname.replace(/\/+$/, '')
            if (req.method === 'GET' && (route === `${API_BASE}/state` || route === API_BASE)) {
              sendJson(res, 200, buildState())
              return
            }
            if (req.method === 'GET' && route === `${API_BASE}/update-check`) {
              sendJson(res, 200, await checkForUpdate())
              return
            }
            if (req.method === 'GET' && route === `${API_BASE}/export`) {
              sendJson(res, 200, store.exportData(String(url.searchParams.get('kind') ?? 'all')))
              return
            }
            if (req.method === 'GET' && route.startsWith(`${STICKER_ROUTE}/`)) {
              const id = decodeURIComponent(route.slice(STICKER_ROUTE.length + 1))
              const sticker = store.getStickerAny(id)
              if (!sticker) {
                sendJson(res, 404, { ok: false, error: 'sticker not found' })
                return
              }
              const comma = sticker.dataUrl.indexOf(',')
              const bytes = Buffer.from(sticker.dataUrl.slice(comma + 1), 'base64')
              res.writeHead(200, {
                'content-type': sticker.mime,
                'content-length': bytes.length,
                'cache-control': 'public, max-age=31536000, immutable',
              })
              res.end(bytes)
              return
            }
            if (req.method !== 'POST') {
              sendJson(res, 405, { ok: false, error: 'method not allowed' })
              return
            }
            const body = await readBody(req)
            const result = handleAction(store, route, body)
            sendJson(res, 200, { ok: true, ...result, state: buildState() })
          } catch (error) {
            sendJson(res, 400, { ok: false, error: error instanceof Error ? error.message : String(error) })
          }
        },
      }),
    'persona-memory: settings API',
  )
}

/* ------------------------------------------------------------------ */
/* API actions                                                        */
/* ------------------------------------------------------------------ */

function handleAction(store, route, body) {
  const now = Date.now()
  if (route === `${API_BASE}/toggle`) {
    const sessionId = String(body.sessionId ?? '').trim()
    if (!sessionId) throw new Error('sessionId is required')
    const settings = store.setSessionPersona(sessionId, body.enabled === true)
    return { sessionId, enabled: settings.personaSessions.includes(sessionId) }
  }
  if (route === `${API_BASE}/persona-clear`) {
    const settings = store.clearPersonaSessions()
    return { enabled: false, count: settings.personaSessions.length }
  }
  if (route === `${API_BASE}/settings`) {
    const settings = store.updateSettings(body.settings ?? body)
    return { settings }
  }
  if (route === `${API_BASE}/import`) {
    return store.importData(String(body.kind ?? 'all'), String(body.mode ?? 'merge'), body.payload)
  }
  if (route === `${API_BASE}/card`) {
    const action = String(body.action ?? 'save')
    if (action === 'save') return { card: store.saveCard(body.card ?? {}) }
    if (action === 'create') return { card: store.createCard(body.card ?? {}) }
    if (action === 'activate') {
      const card = store.activateCard(String(body.id ?? ''))
      if (!card) throw new Error('人物卡不存在')
      return { card }
    }
    if (action === 'delete') {
      if (!body.id) throw new Error('id is required')
      store.deleteCard(String(body.id))
      return { deleted: true }
    }
    throw new Error(`unknown card action: ${action}`)
  }
  if (route === `${API_BASE}/memory`) {
    const action = String(body.action ?? 'list')
    if (action === 'add') {
      const memory = store.addMemory({ ...body, source: 'manual' })
      return { memory: memoryView(store, memory, now) }
    }
    if (action === 'review') {
      const reviewed = Array.isArray(body.ids) && body.ids.length ? store.review(body.ids) : store.reviewDue(5)
      return { reviewed: reviewed.length }
    }
    if (action === 'pin' || action === 'unpin') {
      const memory = store.pin(String(body.id ?? ''), action === 'pin')
      if (!memory) throw new Error('记忆不存在')
      return { memory: memoryView(store, memory, now) }
    }
    if (action === 'forget') {
      const memory = store.forget(String(body.id ?? ''))
      if (!memory) throw new Error('记忆不存在')
      return { forgotten: memory.id }
    }
    if (action === 'restore') {
      const memory = store.restore(String(body.id ?? ''))
      if (!memory) throw new Error('记忆不存在或未遗忘')
      return { memory: memoryView(store, memory, now) }
    }
    if (action === 'update') {
      const memory = store.updateMemory(String(body.id ?? ''), body.patch ?? body)
      if (!memory) throw new Error('记忆不存在')
      return { memory: memoryView(store, memory, now) }
    }
    if (action === 'clear') {
      return store.clearCardMemories()
    }
    throw new Error(`unknown memory action: ${action}`)
  }
  if (route === `${API_BASE}/sticker`) {
    const action = String(body.action ?? 'list')
    if (action === 'add') return { sticker: store.addSticker({ ...body }) }
    if (action === 'delete') {
      if (!store.deleteSticker(String(body.id ?? ''))) throw new Error('表情包不存在')
      return { deleted: true }
    }
    if (action === 'clear') return store.clearCardStickers()
    if (action === 'list') {
      return { stickers: store.listStickers({ query: String(body.query ?? '') }) }
    }
    throw new Error(`unknown sticker action: ${action}`)
  }
  if (route === `${API_BASE}/library`) {
    const action = String(body.action ?? 'list')
    if (action === 'add') {
      const result = store.addLibrary({ ...body, source: 'manual' })
      return { entry: result.entry, updated: result.updated }
    }
    if (action === 'update') {
      const entry = store.updateLibrary(String(body.id ?? ''), body.patch ?? body)
      if (!entry) throw new Error('资料不存在')
      return { entry }
    }
    if (action === 'delete') {
      if (!store.deleteLibrary(String(body.id ?? ''))) throw new Error('资料不存在')
      return { deleted: true }
    }
    if (action === 'clear') return store.clearCardLibrary()
    if (action === 'list') {
      return {
        entries: store.listLibrary({
          query: String(body.query ?? ''),
          kind: String(body.kind ?? ''),
          limit: Number(body.limit) || 100,
        }),
      }
    }
    throw new Error(`unknown library action: ${action}`)
  }
  if (route === `${API_BASE}/diary`) {
    const action = String(body.action ?? 'list')
    if (action === 'add') return { diary: store.addDiary({ ...body, source: 'manual' }) }
    if (action === 'delete') {
      const cardId = store.state.activeCardId
      const diary = store.state.diaries.find(
        (entry) => entry.id === String(body.id ?? '') && entry.cardId === cardId,
      )
      if (!diary || !store.deleteDiary(diary.id)) throw new Error('日记不存在')
      return { deleted: true }
    }
    throw new Error(`unknown diary action: ${action}`)
  }
  throw new Error('unknown route')
}
