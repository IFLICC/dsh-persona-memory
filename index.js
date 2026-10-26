/**
 * @local/dsh-persona-memory — Host half.
 *
 * Keeps a persona (character card) in the system prompt, remembers facts with an
 * Ebbinghaus-style forgetting curve, and can keep a diary. The Web settings page
 * talks to this file over the routes below.
 */
import { PersonaStore, buildPersonaPrompt, buildPersonaOffReminder } from './lib/store.js'

const API_BASE = '/api/dsh-persona-memory'
const MAX_BODY_BYTES = 8 * 1024 * 1024

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
        description: { type: 'string', description: 'Personality, background, and how the character relates to the user.' },
        style: { type: 'string', description: 'Speaking style and tone.' },
        rules: { type: 'array', items: { type: 'string' }, description: 'Behavioral rules, one line each.' },
        greeting: { type: 'string', description: 'Opening line used for introductions.' },
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
        for (const key of ['name', 'title', 'description', 'style', 'greeting']) {
          if (args[key] !== undefined) patch[key] = args[key]
        }
        if (args.rules !== undefined) patch.rules = Array.isArray(args.rules) ? args.rules : []
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
        `记忆 ${state.stats.active} 条（${state.stats.due} 条待复习，${state.stats.forgotten} 条已遗忘）｜日记 ${state.stats.diaries} 篇`,
      ]
      if (card?.description) lines.push(`人格：${truncate(card.description, 220)}`)
      if (card?.style) lines.push(`风格：${truncate(card.style, 160)}`)
      if (card?.rules?.length) lines.push(`准则：${card.rules.map((rule) => truncate(rule, 80)).join('；')}`)
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

  for (const tool of [personaTool, memoryTool, diaryTool]) {
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
              sendJson(res, 200, store.publicState())
              return
            }
            if (req.method === 'GET' && route === `${API_BASE}/export`) {
              sendJson(res, 200, store.exportData(String(url.searchParams.get('kind') ?? 'all')))
              return
            }
            if (req.method !== 'POST') {
              sendJson(res, 405, { ok: false, error: 'method not allowed' })
              return
            }
            const body = await readBody(req)
            const result = handleAction(store, route, body)
            sendJson(res, 200, { ok: true, ...result, state: store.publicState() })
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
