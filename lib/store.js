/**
 * Persona memory store: character cards, Ebbinghaus-style memories, and diaries.
 *
 * Everything lives in one JSON document under DSH_HOME/persona-memory/store.json.
 * The store owns all mutations; the Host plugin exposes the same operations to
 * agent tools and to the Web settings page.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { promises as fsp } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

const DAY_MS = 24 * 60 * 60 * 1000
const MIN_STABILITY_DAYS = 0.05
const MAX_STABILITY_DAYS = 3650
/** Forgetting-curve review spacing, in days, indexed by successful reviews. */
const REVIEW_INTERVALS = [0.25, 1, 2.5, 5, 10, 21, 45, 90]

const DEFAULT_SETTINGS = {
  /** Session ids whose conversation currently runs with the persona. */
  personaSessions: [],
  /** Sessions where persona was turned off; they get a short "stay in normal voice" prompt. */
  personaOffReminders: [],
  /** Let the model keep a diary through the persona_diary tool. */
  diaryEnabled: true,
  /** Record a local digest of each finished turn, one entry per session per day. */
  autoDigest: true,
  /** How many memories the persona section injects per model step. */
  promptTopK: 8,
  /** Retention below this value is forgotten (archived) unless pinned. */
  forgetThreshold: 0.05,
  /** Hard cap on retained memories. */
  maxMemories: 500,
}

export const DEFAULT_CARD = {
  name: '小记',
  title: '你的长期记忆伙伴',
  description:
    '你是小记，一个和用户长期相处的 AI 伙伴。你真诚、好奇，会记住用户说过的事，也会承认自己记不清了。',
  style: '温和、简洁、自然。用第一人称说话，像老朋友一样，偶尔有一点俏皮，但不过分热情。',
  rules: [
    '以「小记」的身份与用户相处，不要自称模型或助手。',
    '自然地带入记得的事，不要一次倾倒所有记忆。',
    '记不清的事先问用户，不要编造细节。',
  ],
  greeting: '嗨，又见面了。今天想聊点什么？',
}

function clampNumber(value, min, max, fallback) {
  const number = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(max, Math.max(min, number))
}

function clampText(value, maxLength) {
  if (typeof value !== 'string') return ''
  const text = value.replace(/\r\n/g, '\n').trim()
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text
}

function normalizeTags(tags) {
  const list = Array.isArray(tags)
    ? tags
    : typeof tags === 'string'
      ? tags.split(/[,，;；\s]+/)
      : []
  const seen = new Set()
  const result = []
  for (const raw of list) {
    const tag = clampText(String(raw ?? ''), 24)
    if (!tag) continue
    const key = tag.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(tag)
    if (result.length >= 8) break
  }
  return result
}

function normalizeCard(raw, fallback) {
  const base = fallback ?? DEFAULT_CARD
  const source = raw && typeof raw === 'object' ? raw : {}
  const now = Date.now()
  return {
    id: typeof source.id === 'string' && source.id ? source.id : randomUUID(),
    name: clampText(source.name ?? base.name, 40) || base.name,
    title: clampText(source.title ?? base.title, 60),
    description: clampText(source.description ?? base.description, 4000),
    style: clampText(source.style ?? base.style, 2000),
    rules: Array.isArray(source.rules)
      ? source.rules.map((rule) => clampText(String(rule ?? ''), 300)).filter(Boolean).slice(0, 12)
      : Array.isArray(base.rules)
        ? [...base.rules]
        : [],
    greeting: clampText(source.greeting ?? base.greeting, 500),
    createdAt: Number.isFinite(source.createdAt) ? source.createdAt : now,
    updatedAt: Number.isFinite(source.updatedAt) ? source.updatedAt : now,
  }
}

function normalizeMemory(raw) {
  if (!raw || typeof raw !== 'object') return null
  const text = clampText(raw.text, 1200)
  if (!text) return null
  const now = Date.now()
  const createdAt = Number.isFinite(raw.createdAt) ? raw.createdAt : now
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : randomUUID(),
    cardId: typeof raw.cardId === 'string' ? raw.cardId : '',
    text,
    tags: normalizeTags(raw.tags),
    importance: Math.round(clampNumber(raw.importance, 1, 5, 3)),
    createdAt,
    lastReviewedAt: Number.isFinite(raw.lastReviewedAt) ? raw.lastReviewedAt : createdAt,
    lastSurfacedAt: Number.isFinite(raw.lastSurfacedAt) ? raw.lastSurfacedAt : 0,
    stability: clampNumber(raw.stability, MIN_STABILITY_DAYS, MAX_STABILITY_DAYS, 4),
    reviews: Math.max(0, Math.floor(clampNumber(raw.reviews, 0, 10000, 0))),
    pinned: raw.pinned === true,
    source: typeof raw.source === 'string' ? raw.source : 'manual',
    sessionId: typeof raw.sessionId === 'string' ? raw.sessionId : '',
  }
}

function normalizeDiary(raw) {
  if (!raw || typeof raw !== 'object') return null
  const body = clampText(raw.body, 8000)
  if (!body) return null
  const createdAt = Number.isFinite(raw.createdAt) ? raw.createdAt : Date.now()
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : randomUUID(),
    cardId: typeof raw.cardId === 'string' ? raw.cardId : '',
    date: typeof raw.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.date) ? raw.date : localDate(createdAt),
    title: clampText(raw.title, 120) || '无题',
    body,
    tags: normalizeTags(raw.tags),
    source: raw.source === 'local' || raw.source === 'manual' ? raw.source : 'model',
    sessionId: typeof raw.sessionId === 'string' ? raw.sessionId : '',
    createdAt,
  }
}

export function localDate(timestamp = Date.now()) {
  const date = new Date(timestamp)
  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function loadJson(file) {
  try {
    const text = readFileSync(file, 'utf8')
    const parsed = JSON.parse(text)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

function baseStability(importance) {
  return 4 * (0.6 + 0.2 * importance)
}

function cloneSettings(settings) {
  return { ...settings }
}

function memoryKey(memory) {
  return `${memory.cardId ?? ''}|${String(memory.text ?? '').toLowerCase().replace(/\s+/g, ' ').trim()}`
}

function diaryKey(entry) {
  return `${entry.cardId ?? ''}|${entry.date}|${entry.title}|${entry.body}`.toLowerCase()
}

export class PersonaStore {
  constructor(options = {}) {
    this.dir = options.dir || resolveDataDir()
    this.file = path.join(this.dir, 'store.json')
    this.recentQuery = ''
    this.surfaceTimer = null
    this.cardBindingMigrated = false
    this.state = this.#load()
    this.sweep()
    if (this.cardBindingMigrated) this.persistSync()
  }

  #load() {
    const raw = loadJson(this.file)
    const now = Date.now()
    const settings = { ...DEFAULT_SETTINGS }
    if (raw?.settings && typeof raw.settings === 'object') {
      settings.personaSessions = Array.isArray(raw.settings.personaSessions)
        ? [...new Set(raw.settings.personaSessions.filter((entry) => typeof entry === 'string' && entry.trim()))].slice(-500)
        : []
      settings.personaOffReminders = Array.isArray(raw.settings.personaOffReminders)
        ? [...new Set(raw.settings.personaOffReminders.filter((entry) => typeof entry === 'string' && entry.trim()))].slice(-500)
        : []
      settings.diaryEnabled = raw.settings.diaryEnabled !== false
      settings.autoDigest = raw.settings.autoDigest !== false
      settings.promptTopK = Math.round(clampNumber(raw.settings.promptTopK, 1, 30, 8))
      settings.forgetThreshold = clampNumber(raw.settings.forgetThreshold, 0.01, 0.5, 0.05)
      settings.maxMemories = Math.round(clampNumber(raw.settings.maxMemories, 50, 2000, 500))
    }
    const cards = Array.isArray(raw?.cards)
      ? raw.cards.map((card) => normalizeCard(card)).filter(Boolean)
      : []
    if (cards.length === 0) cards.push(normalizeCard(DEFAULT_CARD))
    const activeCardId =
      typeof raw?.activeCardId === 'string' && cards.some((card) => card.id === raw.activeCardId)
        ? raw.activeCardId
        : cards[0].id
    const memories = Array.isArray(raw?.memories)
      ? raw.memories.map(normalizeMemory).filter(Boolean)
      : []
    const archived = Array.isArray(raw?.archived)
      ? raw.archived
          .map((entry) => {
            const memory = normalizeMemory(entry)
            if (!memory) return null
            memory.archivedAt = Number.isFinite(entry?.archivedAt) ? entry.archivedAt : now
            memory.forgetReason = typeof entry?.forgetReason === 'string' ? entry.forgetReason : 'forgotten'
            return memory
          })
          .filter(Boolean)
          .slice(-300)
      : []
    const diaries = Array.isArray(raw?.diaries)
      ? raw.diaries.map(normalizeDiary).filter(Boolean).slice(-1000)
      : []
    const cardIds = new Set(cards.map((card) => card.id))
    for (const memory of [...memories, ...archived]) {
      if (!memory.cardId || !cardIds.has(memory.cardId)) {
        memory.cardId = activeCardId
        this.cardBindingMigrated = true
      }
    }
    for (const diary of diaries) {
      if (!diary.cardId || !cardIds.has(diary.cardId)) {
        diary.cardId = activeCardId
        this.cardBindingMigrated = true
      }
    }
    return {
      version: 1,
      settings,
      activeCardId,
      cards,
      memories,
      archived,
      diaries,
      updatedAt: now,
    }
  }

  persistSync() {
    this.state.updatedAt = Date.now()
    try {
      mkdirSync(this.dir, { recursive: true })
      const tmp = `${this.file}.tmp-${process.pid}`
      writeFileSync(tmp, JSON.stringify(this.state, null, 2), 'utf8')
      renameSync(tmp, this.file)
    } catch {
      try {
        mkdirSync(this.dir, { recursive: true })
        writeFileSync(this.file, JSON.stringify(this.state, null, 2), 'utf8')
      } catch {
        /* storage failures must never break a model step */
      }
    }
  }

  persistSoon() {
    if (this.surfaceTimer) return
    this.surfaceTimer = setTimeout(() => {
      this.surfaceTimer = null
      this.persistSync()
    }, 4000)
    if (typeof this.surfaceTimer.unref === 'function') this.surfaceTimer.unref()
  }

  dispose() {
    if (this.surfaceTimer) {
      clearTimeout(this.surfaceTimer)
      this.surfaceTimer = null
    }
    this.persistSync()
  }

  /* ------------------------------------------------------------------ */
  /* Forgetting curve                                                    */
  /* ------------------------------------------------------------------ */

  retention(memory, now = Date.now()) {
    if (memory.pinned) return 1
    const elapsedDays = Math.max(0, now - memory.lastReviewedAt) / DAY_MS
    return Math.exp(-elapsedDays / Math.max(memory.stability, MIN_STABILITY_DAYS))
  }

  ageDays(memory, now = Date.now()) {
    return Math.floor(Math.max(0, now - memory.createdAt) / DAY_MS)
  }

  isDue(memory, now = Date.now()) {
    if (memory.pinned) return false
    if (this.retention(memory, now) >= 0.85) return false
    const interval = REVIEW_INTERVALS[Math.min(memory.reviews, REVIEW_INTERVALS.length - 1)]
    return now - memory.lastReviewedAt >= interval * DAY_MS
  }

  /** Archive memories whose trace has faded below the configured threshold. */
  sweep(now = Date.now()) {
    const threshold = this.state.settings.forgetThreshold
    const keep = []
    for (const memory of this.state.memories) {
      const oldEnough = now - memory.createdAt > DAY_MS
      if (!memory.pinned && oldEnough && this.retention(memory, now) < threshold) {
        memory.archivedAt = now
        memory.forgetReason = 'forgotten'
        this.state.archived.push(memory)
      } else {
        keep.push(memory)
      }
    }
    this.state.memories = keep
    if (this.state.archived.length > 300) {
      this.state.archived = this.state.archived.slice(-300)
    }
    this.enforceCapacity()
  }

  enforceCapacity() {
    const max = this.state.settings.maxMemories
    if (this.state.memories.length <= max) return
    const now = Date.now()
    const sorted = [...this.state.memories].sort(
      (a, b) => this.retention(b, now) * b.importance - this.retention(a, now) * a.importance,
    )
    for (const memory of sorted.slice(max)) {
      if (memory.pinned) continue
      memory.archivedAt = now
      memory.forgetReason = 'capacity'
      this.state.archived.push(memory)
    }
    const dropped = new Set(
      sorted.slice(max).filter((memory) => !memory.pinned).map((memory) => memory.id),
    )
    this.state.memories = this.state.memories.filter((memory) => !dropped.has(memory.id))
  }

  /* ------------------------------------------------------------------ */
  /* Memory operations                                                   */
  /* ------------------------------------------------------------------ */

  addMemory(input = {}) {
    const text = clampText(input.text, 1200)
    if (!text) throw new Error('memory text is required')
    const now = Date.now()
    const importance = Math.round(clampNumber(input.importance, 1, 5, 3))
    const cardId =
      typeof input.cardId === 'string' && this.state.cards.some((card) => card.id === input.cardId)
        ? input.cardId
        : this.state.activeCardId
    const memory = {
      id: randomUUID(),
      cardId,
      text,
      tags: normalizeTags(input.tags),
      importance,
      createdAt: now,
      lastReviewedAt: now,
      lastSurfacedAt: 0,
      stability: baseStability(importance),
      reviews: 0,
      pinned: input.pinned === true,
      source: typeof input.source === 'string' ? input.source : 'manual',
      sessionId: typeof input.sessionId === 'string' ? input.sessionId : '',
    }
    this.state.memories.push(memory)
    this.sweep()
    this.persistSync()
    return memory
  }

  findMemory(id) {
    return this.state.memories.find((memory) => memory.id === id)
  }

  review(ids) {
    const now = Date.now()
    const wanted = new Set(Array.isArray(ids) ? ids : [ids])
    const reviewed = []
    for (const memory of this.state.memories) {
      if (!wanted.has(memory.id)) continue
      memory.stability = Math.min(MAX_STABILITY_DAYS, memory.stability * 1.8 + 1.2)
      memory.reviews += 1
      memory.lastReviewedAt = now
      reviewed.push(memory)
    }
    if (reviewed.length) this.persistSync()
    return reviewed
  }

  reviewDue(limit = 5) {
    const now = Date.now()
    const cardId = this.state.activeCardId
    const due = this.state.memories
      .filter((memory) => memory.cardId === cardId && this.isDue(memory, now))
      .sort((a, b) => this.retention(a, now) - this.retention(b, now))
      .slice(0, limit)
    return this.review(due.map((memory) => memory.id))
  }

  recall(query, limit = 5) {
    const now = Date.now()
    const cardId = this.state.activeCardId
    const tokens = tokenize(query)
    const scored = []
    for (const memory of this.state.memories) {
      if (memory.cardId !== cardId) continue
      const overlap = tokenOverlap(tokens, tokenize(`${memory.text} ${memory.tags.join(' ')}`))
      if (tokens.size > 0 && overlap <= 0) continue
      scored.push({
        memory,
        score: overlap * 10 + this.retention(memory, now) * 3 + memory.importance * 0.6,
      })
    }
    scored.sort((a, b) => b.score - a.score)
    const top = scored.slice(0, Math.max(1, Math.min(20, limit)))
    this.review(top.slice(0, 3).map((item) => item.memory.id))
    return top.map((item) => item.memory)
  }

  forget(id) {
    const index = this.state.memories.findIndex((memory) => memory.id === id)
    if (index < 0) return null
    const [memory] = this.state.memories.splice(index, 1)
    memory.archivedAt = Date.now()
    memory.forgetReason = 'manual'
    this.state.archived.push(memory)
    this.persistSync()
    return memory
  }

  restore(id) {
    const index = this.state.archived.findIndex((memory) => memory.id === id)
    if (index < 0) return null
    const [memory] = this.state.archived.splice(index, 1)
    delete memory.archivedAt
    delete memory.forgetReason
    memory.lastReviewedAt = Date.now()
    memory.stability = Math.max(1, memory.stability * 0.4)
    this.state.memories.push(memory)
    this.persistSync()
    return memory
  }

  pin(id, pinned) {
    const memory = this.findMemory(id)
    if (!memory) return null
    memory.pinned = pinned === true
    this.persistSync()
    return memory
  }

  updateMemory(id, patch = {}) {
    const memory = this.findMemory(id)
    if (!memory) return null
    if (patch.text !== undefined) {
      const text = clampText(patch.text, 1200)
      if (text) memory.text = text
    }
    if (patch.tags !== undefined) memory.tags = normalizeTags(patch.tags)
    if (patch.importance !== undefined) {
      memory.importance = Math.round(clampNumber(patch.importance, 1, 5, memory.importance))
    }
    this.persistSync()
    return memory
  }

  /**
   * Rehearse memories that actually reached the model prompt. This is the
   * "use it or lose it" side of the curve: gentle, and never enough to make a
   * memory permanent on its own.
   */
  markSurfaced(ids, now = Date.now()) {
    if (!ids || ids.length === 0) return
    for (const id of ids) {
      const memory = this.findMemory(id)
      if (!memory) continue
      memory.lastSurfacedAt = now
      memory.stability = Math.min(MAX_STABILITY_DAYS, memory.stability * 1.03)
    }
    this.persistSoon()
  }

  selectForPrompt(topK, now = Date.now(), recentQuery = '') {
    const cardId = this.state.activeCardId
    const tokens = tokenize(recentQuery)
    const scored = this.state.memories
      .filter((memory) => memory.cardId === cardId)
      .map((memory) => {
        const overlap = tokenOverlap(tokens, tokenize(`${memory.text} ${memory.tags.join(' ')}`))
        const score =
          (memory.pinned ? 1000 : 0) +
          memory.importance * 1.5 +
          this.retention(memory, now) * 5 +
          overlap * 6
        return { memory, score }
      })
    scored.sort((a, b) => b.score - a.score)
    const limit = Math.max(1, Math.min(30, topK))
    const selected = scored.slice(0, limit).map((item) => item.memory)
    this.markSurfaced(selected.map((memory) => memory.id), now)
    return selected
  }

  /* ------------------------------------------------------------------ */
  /* Diary                                                               */
  /* ------------------------------------------------------------------ */

  addDiary(input = {}) {
    const now = Date.now()
    const body = clampText(input.body, 8000)
    if (!body) throw new Error('diary body is required')
    const date = typeof input.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.date) ? input.date : localDate(now)
    const source = input.source === 'local' || input.source === 'manual' ? input.source : 'model'
    const sessionId = typeof input.sessionId === 'string' ? input.sessionId : ''
    const cardId =
      typeof input.cardId === 'string' && this.state.cards.some((card) => card.id === input.cardId)
        ? input.cardId
        : this.state.activeCardId
    if (source === 'local' && sessionId) {
      const existing = this.state.diaries.find(
        (entry) =>
          entry.source === 'local' &&
          entry.sessionId === sessionId &&
          entry.date === date &&
          entry.cardId === cardId,
      )
      if (existing) {
        existing.body = clampText(`${existing.body}\n${body}`, 8000)
        existing.updatedAt = now
        this.persistSync()
        return existing
      }
    }
    const diary = {
      id: randomUUID(),
      cardId,
      date,
      title: clampText(input.title, 120) || `${date} 的日记`,
      body,
      tags: normalizeTags(input.tags),
      source,
      sessionId,
      createdAt: now,
    }
    this.state.diaries.push(diary)
    this.persistSync()
    return diary
  }

  deleteDiary(id) {
    const index = this.state.diaries.findIndex((entry) => entry.id === id)
    if (index < 0) return false
    this.state.diaries.splice(index, 1)
    this.persistSync()
    return true
  }

  /* ------------------------------------------------------------------ */
  /* Cards and settings                                                  */
  /* ------------------------------------------------------------------ */

  activeCard() {
    return this.state.cards.find((card) => card.id === this.state.activeCardId) ?? this.state.cards[0]
  }

  saveCard(input = {}) {
    const id = typeof input.id === 'string' ? input.id : ''
    const existing = id ? this.state.cards.find((card) => card.id === id) : undefined
    if (existing) {
      const next = normalizeCard({ ...existing, ...input, id: existing.id }, existing)
      next.createdAt = existing.createdAt
      next.updatedAt = Date.now()
      Object.assign(existing, next)
      this.persistSync()
      return existing
    }
    const card = normalizeCard({ ...DEFAULT_CARD, ...input }, DEFAULT_CARD)
    card.id = randomUUID()
    card.createdAt = Date.now()
    card.updatedAt = card.createdAt
    this.state.cards.push(card)
    this.persistSync()
    return card
  }

  createCard(input = {}) {
    return this.saveCard({ ...input, id: undefined })
  }

  activateCard(id) {
    if (!this.state.cards.some((card) => card.id === id)) return null
    this.state.activeCardId = id
    this.persistSync()
    return this.activeCard()
  }

  deleteCard(id) {
    if (this.state.cards.length <= 1) throw new Error('至少保留一张人物卡')
    const index = this.state.cards.findIndex((card) => card.id === id)
    if (index < 0) return false
    this.state.cards.splice(index, 1)
    this.state.memories = this.state.memories.filter((memory) => memory.cardId !== id)
    this.state.archived = this.state.archived.filter((memory) => memory.cardId !== id)
    this.state.diaries = this.state.diaries.filter((entry) => entry.cardId !== id)
    if (this.state.activeCardId === id) this.state.activeCardId = this.state.cards[0].id
    this.persistSync()
    return true
  }

  /** Permanently remove every active and forgotten memory belonging to one card. */
  clearCardMemories(cardId = this.state.activeCardId) {
    const before = this.state.memories.length
    const beforeArchived = this.state.archived.length
    this.state.memories = this.state.memories.filter((memory) => memory.cardId !== cardId)
    this.state.archived = this.state.archived.filter((memory) => memory.cardId !== cardId)
    this.persistSync()
    return {
      cardId,
      memories: before - this.state.memories.length,
      archived: beforeArchived - this.state.archived.length,
    }
  }

  updateSettings(patch = {}) {
    const next = { ...this.state.settings }
    if (patch.personaSessions !== undefined) {
      next.personaSessions = Array.isArray(patch.personaSessions)
        ? [...new Set(patch.personaSessions.filter((entry) => typeof entry === 'string' && entry.trim()))].slice(-500)
        : []
    }
    if (patch.personaOffReminders !== undefined) {
      next.personaOffReminders = Array.isArray(patch.personaOffReminders)
        ? [...new Set(patch.personaOffReminders.filter((entry) => typeof entry === 'string' && entry.trim()))].slice(-500)
        : []
    }
    if (patch.diaryEnabled !== undefined) next.diaryEnabled = patch.diaryEnabled === true
    if (patch.autoDigest !== undefined) next.autoDigest = patch.autoDigest === true
    if (patch.promptTopK !== undefined) next.promptTopK = Math.round(clampNumber(patch.promptTopK, 1, 30, 8))
    if (patch.forgetThreshold !== undefined) {
      next.forgetThreshold = clampNumber(patch.forgetThreshold, 0.01, 0.5, 0.05)
    }
    if (patch.maxMemories !== undefined) {
      next.maxMemories = Math.round(clampNumber(patch.maxMemories, 50, 2000, 500))
    }
    this.state.settings = next
    this.sweep()
    this.persistSync()
    return next
  }

  isSessionPersona(sessionId) {
    const id = String(sessionId ?? '')
    return Boolean(id) && Array.isArray(this.state.settings.personaSessions) && this.state.settings.personaSessions.includes(id)
  }

  setSessionPersona(sessionId, enabled) {
    const id = String(sessionId ?? '').trim()
    if (!id) throw new Error('sessionId is required')
    const sessions = new Set(this.state.settings.personaSessions ?? [])
    const reminders = new Set(this.state.settings.personaOffReminders ?? [])
    const wasOn = sessions.has(id)
    if (enabled === true) {
      sessions.add(id)
      reminders.delete(id)
    } else {
      sessions.delete(id)
      if (wasOn) reminders.add(id)
    }
    this.state.settings = {
      ...this.state.settings,
      personaSessions: [...sessions].slice(-500),
      personaOffReminders: [...reminders].slice(-500),
    }
    this.persistSync()
    return this.state.settings
  }

  isPersonaOffReminder(sessionId) {
    const id = String(sessionId ?? '')
    return Boolean(id) && Array.isArray(this.state.settings.personaOffReminders) && this.state.settings.personaOffReminders.includes(id)
  }

  clearPersonaSessions() {
    const reminders = new Set(this.state.settings.personaOffReminders ?? [])
    for (const id of this.state.settings.personaSessions ?? []) reminders.add(id)
    this.state.settings = {
      ...this.state.settings,
      personaSessions: [],
      personaOffReminders: [...reminders].slice(-500),
    }
    this.persistSync()
    return this.state.settings
  }

  /* ------------------------------------------------------------------ */
  /* Import / export                                                     */
  /* ------------------------------------------------------------------ */

  exportData(kind = 'all') {
    const normalized = ['cards', 'memories', 'diaries', 'all'].includes(kind) ? kind : 'all'
    const payload = {
      app: 'dsh-persona-memory',
      version: 1,
      kind: normalized,
      exportedAt: Date.now(),
      data: {},
    }
    if (normalized === 'cards' || normalized === 'all') {
      payload.data.activeCardId = this.state.activeCardId
      payload.data.cards = this.state.cards.map((card) => ({ ...card, rules: [...card.rules] }))
    }
    if (normalized === 'memories') {
      const cardId = this.state.activeCardId
      payload.data.cardId = cardId
      payload.data.cardName = this.activeCard()?.name ?? ''
      payload.data.memories = this.state.memories
        .filter((memory) => memory.cardId === cardId)
        .map((memory) => ({ ...memory, tags: [...memory.tags] }))
      payload.data.archived = this.state.archived
        .filter((memory) => memory.cardId === cardId)
        .map((memory) => ({ ...memory, tags: [...memory.tags] }))
    }
    if (normalized === 'all') {
      payload.data.memories = this.state.memories.map((memory) => ({ ...memory, tags: [...memory.tags] }))
      payload.data.archived = this.state.archived.map((memory) => ({ ...memory, tags: [...memory.tags] }))
    }
    if (normalized === 'diaries') {
      const cardId = this.state.activeCardId
      payload.data.cardId = cardId
      payload.data.cardName = this.activeCard()?.name ?? ''
      payload.data.diaries = this.state.diaries
        .filter((entry) => entry.cardId === cardId)
        .map((entry) => ({ ...entry, tags: [...entry.tags] }))
    }
    if (normalized === 'all') {
      payload.data.diaries = this.state.diaries.map((entry) => ({ ...entry, tags: [...entry.tags] }))
      payload.data.settings = cloneSettings(this.state.settings)
    }
    return payload
  }

  importData(kind = 'all', mode = 'merge', payload = {}) {
    const normalized = ['cards', 'memories', 'diaries', 'all'].includes(kind) ? kind : 'all'
    const replace = mode === 'replace'
    let data =
      payload && typeof payload === 'object' && payload.data && typeof payload.data === 'object'
        ? payload.data
        : payload
    if (Array.isArray(data)) {
      data =
        normalized === 'cards'
          ? { cards: data }
          : normalized === 'diaries'
            ? { diaries: data }
            : { memories: data }
    }
    if (!data || typeof data !== 'object') throw new Error('导入文件格式不正确')
    const hasCards = Array.isArray(data.cards) || typeof data.name === 'string'
    const hasMemories = Array.isArray(data.memories) || Array.isArray(data.archived)
    const hasDiaries = Array.isArray(data.diaries)
    const expected =
      normalized === 'cards'
        ? hasCards
        : normalized === 'memories'
          ? hasMemories
          : normalized === 'diaries'
            ? hasDiaries
            : hasCards || hasMemories || hasDiaries
    if (!expected) throw new Error('导入文件格式不正确：没有找到对应的数据类型')
    const result = {
      kind: normalized,
      mode: replace ? 'replace' : 'merge',
      cards: 0,
      memories: 0,
      diaries: 0,
      skipped: 0,
    }
    const now = Date.now()
    /** Incoming card id -> the id it actually got, so imported memories follow their card. */
    const cardIdMap = new Map()

    if ((normalized === 'cards' || normalized === 'all') && (Array.isArray(data.cards) || typeof data.name === 'string')) {
      const source = Array.isArray(data.cards) ? data.cards : [data]
      const cards = source.map((raw) => normalizeCard(raw)).filter(Boolean).slice(0, 200)
      if (replace && cards.length) {
        const seen = new Set()
        this.state.cards = cards.map((card) => {
          const id = card.id && !seen.has(card.id) ? card.id : randomUUID()
          seen.add(id)
          cardIdMap.set(card.id, id)
          return { ...card, id, createdAt: now, updatedAt: now }
        })
        const wanted = typeof data.activeCardId === 'string' ? data.activeCardId : ''
        this.state.activeCardId = this.state.cards.some((card) => card.id === wanted)
          ? wanted
          : this.state.cards[0].id
        result.cards = this.state.cards.length
      } else {
        for (const card of cards) {
          const existing =
            this.state.cards.find((entry) => entry.id === card.id) ??
            this.state.cards.find((entry) => entry.name === card.name)
          if (existing) {
            cardIdMap.set(card.id, existing.id)
            Object.assign(existing, { ...card, id: existing.id, createdAt: existing.createdAt, updatedAt: now })
          } else {
            const id = card.id && !this.state.cards.some((entry) => entry.id === card.id) ? card.id : randomUUID()
            cardIdMap.set(card.id, id)
            this.state.cards.push({ ...card, id, createdAt: now, updatedAt: now })
          }
          result.cards += 1
        }
        if (typeof data.activeCardId === 'string' && this.state.cards.some((card) => card.id === data.activeCardId)) {
          this.state.activeCardId = data.activeCardId
        }
      }
    }

    const activeCardId = this.state.activeCardId
    const isKnownCard = (id) => typeof id === 'string' && this.state.cards.some((card) => card.id === id)
    const resolveCardId = (incomingCardId) => {
      if (normalized === 'memories' || normalized === 'diaries') return activeCardId
      const mapped = cardIdMap.get(incomingCardId)
      if (mapped && isKnownCard(mapped)) return mapped
      if (isKnownCard(incomingCardId)) return incomingCardId
      return activeCardId
    }

    if ((normalized === 'memories' || normalized === 'all') && Array.isArray(data.memories)) {
      const incoming = data.memories
        .map(normalizeMemory)
        .filter(Boolean)
        .slice(0, 5000)
        .map((memory) => ({
          ...memory,
          id: normalized === 'memories' ? randomUUID() : memory.id,
          cardId: resolveCardId(memory.cardId),
        }))
      if (replace) {
        this.state.memories =
          normalized === 'memories'
            ? [...this.state.memories.filter((memory) => memory.cardId !== activeCardId), ...incoming]
            : incoming
        result.memories = incoming.length
      } else {
        const ids = new Set(this.state.memories.map((memory) => memory.id))
        const keys = new Set(this.state.memories.map((memory) => memoryKey(memory)))
        for (const memory of incoming) {
          const key = memoryKey(memory)
          if (ids.has(memory.id) || keys.has(key)) {
            result.skipped += 1
            continue
          }
          ids.add(memory.id)
          keys.add(key)
          this.state.memories.push(memory)
          result.memories += 1
        }
      }
    }
    if ((normalized === 'memories' || normalized === 'all') && Array.isArray(data.archived)) {
      const incoming = data.archived
        .map((entry) => {
          const memory = normalizeMemory(entry)
          if (!memory) return null
          memory.archivedAt = Number.isFinite(entry?.archivedAt) ? entry.archivedAt : now
          memory.forgetReason = typeof entry?.forgetReason === 'string' ? entry.forgetReason : 'imported'
          memory.cardId = resolveCardId(memory.cardId)
          if (normalized === 'memories') memory.id = randomUUID()
          return memory
        })
        .filter(Boolean)
        .slice(-2000)
      if (replace) {
        this.state.archived =
          normalized === 'memories'
            ? [...this.state.archived.filter((memory) => memory.cardId !== activeCardId), ...incoming]
            : incoming
      } else {
        const ids = new Set(this.state.archived.map((memory) => memory.id))
        for (const memory of incoming) {
          if (ids.has(memory.id)) {
            result.skipped += 1
            continue
          }
          ids.add(memory.id)
          this.state.archived.push(memory)
        }
      }
    }

    if ((normalized === 'diaries' || normalized === 'all') && Array.isArray(data.diaries)) {
      const incoming = data.diaries
        .map((entry) => {
          const diary = normalizeDiary(entry)
          if (!diary) return null
          diary.updatedAt = Number.isFinite(entry?.updatedAt) ? entry.updatedAt : diary.createdAt
          diary.cardId = resolveCardId(diary.cardId)
          if (normalized === 'diaries') diary.id = randomUUID()
          return diary
        })
        .filter(Boolean)
        .slice(0, 5000)
      if (replace) {
        this.state.diaries =
          normalized === 'diaries'
            ? [...this.state.diaries.filter((entry) => entry.cardId !== activeCardId), ...incoming]
            : incoming
        result.diaries = incoming.length
      } else {
        const ids = new Set(this.state.diaries.map((entry) => entry.id))
        const keys = new Set(this.state.diaries.map((entry) => diaryKey(entry)))
        for (const diary of incoming) {
          const key = diaryKey(diary)
          if (ids.has(diary.id) || keys.has(key)) {
            result.skipped += 1
            continue
          }
          ids.add(diary.id)
          keys.add(key)
          this.state.diaries.push(diary)
          result.diaries += 1
        }
      }
    }

    if (normalized === 'all' && replace && data.settings && typeof data.settings === 'object') {
      this.updateSettings(data.settings)
    }
    this.sweep()
    this.persistSync()
    return result
  }

  /* ------------------------------------------------------------------ */
  /* State for UI and tools                                              */
  /* ------------------------------------------------------------------ */

  stats(now = Date.now()) {
    const cardId = this.state.activeCardId
    const active = this.state.memories.filter((memory) => memory.cardId === cardId)
    return {
      active: active.length,
      pinned: active.filter((memory) => memory.pinned).length,
      due: active.filter((memory) => this.isDue(memory, now)).length,
      forgotten: this.state.archived.filter((memory) => memory.cardId === cardId).length,
      diaries: this.state.diaries.filter((entry) => entry.cardId === cardId).length,
      cards: this.state.cards.length,
      avgRetention: active.length
        ? active.reduce((sum, memory) => sum + this.retention(memory, now), 0) / active.length
        : 0,
    }
  }

  publicMemory(memory, now) {
    return {
      id: memory.id,
      text: memory.text,
      tags: memory.tags,
      importance: memory.importance,
      pinned: memory.pinned,
      reviews: memory.reviews,
      createdAt: memory.createdAt,
      lastReviewedAt: memory.lastReviewedAt,
      stability: Number(memory.stability.toFixed(2)),
      retention: Number(this.retention(memory, now).toFixed(4)),
      ageDays: this.ageDays(memory, now),
      due: this.isDue(memory, now),
      source: memory.source,
    }
  }

  publicState() {
    const now = Date.now()
    const card = this.activeCard()
    const cardId = this.state.activeCardId
    const memories = this.state.memories
      .filter((memory) => memory.cardId === cardId)
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
        return this.retention(b, now) * b.importance - this.retention(a, now) * a.importance
      })
      .slice(0, 200)
      .map((memory) => this.publicMemory(memory, now))
    return {
      ok: true,
      now,
      dataFile: this.file,
      settings: cloneSettings(this.state.settings),
      activeCardId: this.state.activeCardId,
      activeCard: card ? { ...card } : null,
      cards: this.state.cards.map((entry) => ({
        id: entry.id,
        name: entry.name,
        title: entry.title,
        description: entry.description,
        style: entry.style,
        rules: [...entry.rules],
        greeting: entry.greeting,
        updatedAt: entry.updatedAt,
      })),
      memories,
      archived: this.state.archived
        .filter((memory) => memory.cardId === cardId)
        .slice(-50)
        .reverse()
        .map((memory) => this.publicMemory(memory, now)),
      diaries: this.state.diaries
        .filter((entry) => entry.cardId === cardId)
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 100)
        .map((entry) => ({ ...entry })),
      stats: this.stats(now),
    }
  }
}

export function resolveDataDir() {
  if (process.env.DSH_PERSONA_MEMORY_DIR) return process.env.DSH_PERSONA_MEMORY_DIR
  const home = process.env.DSH_HOME || path.join(homedir(), '.dsh')
  return path.join(home, 'persona-memory')
}

/* -------------------------------------------------------------------- */
/* Lightweight relevance                                                  */
/* -------------------------------------------------------------------- */

const CJK = /[\u3400-\u9fff]/
const LATIN = /[a-z0-9]/

export function tokenize(text) {
  const tokens = new Set()
  const value = String(text ?? '').toLowerCase()
  if (!value) return tokens
  const words = value.match(/[a-z0-9][a-z0-9_'-]{1,}/g) ?? []
  for (const word of words) tokens.add(word)
  const chars = [...value]
  let run = []
  const flush = () => {
    for (let index = 0; index + 1 < run.length; index += 1) {
      tokens.add(run[index] + run[index + 1])
    }
    run = []
  }
  for (const char of chars) {
    if (CJK.test(char)) run.push(char)
    else flush()
  }
  flush()
  return tokens
}

export function tokenOverlap(left, right) {
  if (left.size === 0 || right.size === 0) return 0
  let shared = 0
  for (const token of left) if (right.has(token)) shared += 1
  return shared / Math.sqrt(left.size * right.size)
}

/* -------------------------------------------------------------------- */
/* Prompt rendering                                                       */
/* -------------------------------------------------------------------- */

const RETENTION_LABEL = (value) => {
  if (value >= 0.8) return '清晰'
  if (value >= 0.5) return '还记得'
  if (value >= 0.25) return '模糊'
  return '快要忘记'
}

function formatAge(days) {
  if (days <= 0) return '今天'
  if (days === 1) return '昨天'
  if (days < 30) return `${days} 天前`
  if (days < 365) return `${Math.floor(days / 30)} 个月前`
  return `${Math.floor(days / 365)} 年前`
}

function formatTime(timestamp) {
  const date = new Date(timestamp)
  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

export function buildPersonaOffReminder() {
  return [
    '本对话未启用人设模式。',
    '请使用普通、中性的助手语气回答，不要沿用之前对话中的角色自称、固定昵称、口癖或括号动作描写。',
    '也不要在回复中解释这条设置，正常回答用户即可。',
  ].join('\n')
}

export function buildPersonaPrompt(store, now = Date.now(), recentQuery = '') {
  const { settings } = store.state
  const card = store.activeCard()
  if (!card) return ''
  const lines = []
  lines.push('## 人设模式（长期人格）')
  lines.push(`你是「${card.name}」${card.title ? `，${card.title}` : ''}。`)
  if (card.description) lines.push(card.description)
  if (card.style) lines.push(`【说话风格】${card.style}`)
  if (card.rules.length) {
    lines.push('【行为准则】')
    for (const rule of card.rules) lines.push(`- ${rule}`)
  }
  lines.push(
    '保持这个人格：使用第一人称，情绪、用词和节奏都符合上面的设定。不要提及“人设卡”“记忆库”“插件”等系统词汇；像真的记得或真的忘记了那样表达。',
  )

  const selected = store.selectForPrompt(settings.promptTopK, now, recentQuery)
  if (selected.length) {
    lines.push('', '【长期记忆】（依据重要度与清晰度浮现，可能不完整）')
    for (const memory of selected) {
      const retention = store.retention(memory, now)
      const tags = memory.tags.length ? ` #${memory.tags.join(' #')}` : ''
      const pinned = memory.pinned ? ' · 常记' : ''
      lines.push(
        `- (${formatAge(store.ageDays(memory, now))} · ${RETENTION_LABEL(retention)}${pinned}${tags}) ${memory.text.replace(/\s+/g, ' ')}`,
      )
    }
  }

  const selectedIds = new Set(selected.map((memory) => memory.id))
  const due = store.state.memories
    .filter((memory) => !selectedIds.has(memory.id) && store.isDue(memory, now) && !memory.pinned)
    .sort((a, b) => store.retention(a, now) - store.retention(b, now))
    .slice(0, 3)
  if (due.length) {
    lines.push('', '【有些记忆正在变模糊】')
    for (const memory of due) {
      lines.push(
        `- (${formatAge(store.ageDays(memory, now))} · ${RETENTION_LABEL(store.retention(memory, now))}) ${memory.text.replace(/\s+/g, ' ')}`,
      )
    }
    lines.push('（不确定的地方可以向用户确认；用 persona_memory 的 review 可以加深印象。）')
  }

  if (settings.diaryEnabled) {
    lines.push(
      '',
      '【日记习惯】',
      '你保持写日记的习惯。当一轮对话结束，或发生了值得记住的情绪、事件、约定时，调用 persona_diary 写一篇 1~3 句的日记；把新了解到的持久事实用 persona_memory 的 remember 记下来。不要为了写日记而打断对话，也不要机械地每轮都写。',
    )
  } else {
    lines.push(
      '',
      '【记忆习惯】',
      '了解到关于用户或你们关系的持久事实时，用 persona_memory 的 remember 记录下来，重要的事标注更高的 importance。',
    )
  }

  const date = new Date(now)
  lines.push('', `当前时间：${formatTime(now)}（${WEEKDAYS[date.getDay()]}）`)
  const text = lines.join('\n')
  return text.length > 5000 ? `${text.slice(0, 5000)}\n…` : text
}
