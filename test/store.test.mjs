import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { PersonaStore, buildPersonaPrompt } from '../lib/store.js'

const DAY = 24 * 60 * 60 * 1000

function openStore(seed) {
  const dir = mkdtempSync(path.join(tmpdir(), 'dsh-persona-'))
  if (seed) writeFileSync(path.join(dir, 'store.json'), JSON.stringify(seed), 'utf8')
  const store = new PersonaStore({ dir })
  return {
    store,
    dir,
    cleanup() {
      store.dispose()
      rmSync(dir, { recursive: true, force: true })
    },
  }
}

function legacyStore(extra = {}) {
  return {
    version: 1,
    settings: { personaSessions: [], diaryEnabled: true, autoDigest: true },
    cards: [
      { id: 'card-a', name: 'A', title: '', description: '', style: '', rules: [], greeting: '' },
      { id: 'card-b', name: 'B', title: '', description: '', style: '', rules: [], greeting: '' },
    ],
    activeCardId: 'card-a',
    memories: [],
    archived: [],
    diaries: [],
    ...extra,
  }
}

test('memory fades on the forgetting curve and review extends it', () => {
  const { store, cleanup } = openStore()
  try {
    const memory = store.addMemory({ text: '用户喜欢在雨天听爵士乐', importance: 4 })
    assert.ok(store.retention(memory) > 0.99)

    memory.lastReviewedAt = Date.now() - 10 * DAY
    const faded = store.retention(memory)
    assert.ok(faded > 0.01 && faded < 0.5, `expected a faded trace, got ${faded}`)

    const before = memory.stability
    store.review([memory.id])
    assert.ok(memory.stability > before)
    assert.equal(memory.reviews, 1)
  } finally {
    cleanup()
  }
})

test('faded memories are archived and pinned memories survive', () => {
  const { store, cleanup } = openStore()
  try {
    const ordinary = store.addMemory({ text: '一件会忘记的琐事', importance: 1 })
    ordinary.createdAt = Date.now() - 400 * DAY
    ordinary.lastReviewedAt = Date.now() - 400 * DAY

    const pinned = store.addMemory({ text: '用户的名字是阿岚', importance: 5, pinned: true })
    pinned.lastReviewedAt = Date.now() - 400 * DAY

    store.sweep()
    assert.ok(!store.state.memories.some((entry) => entry.id === ordinary.id))
    assert.ok(store.state.archived.some((entry) => entry.id === ordinary.id))
    assert.ok(store.state.memories.some((entry) => entry.id === pinned.id))
    assert.equal(store.retention(pinned), 1)

    assert.ok(store.restore(ordinary.id))
    assert.ok(store.state.memories.some((entry) => entry.id === ordinary.id))
  } finally {
    cleanup()
  }
})

test('each character card owns its own memories and diaries', () => {
  const { store, cleanup } = openStore(legacyStore())
  try {
    store.activateCard('card-a')
    store.addMemory({ text: 'A 的记忆' })
    store.addDiary({ title: 'A 的日记', body: '今天很开心' })

    store.activateCard('card-b')
    store.addMemory({ text: 'B 的记忆' })
    store.addDiary({ title: 'B 的日记', body: '今天吃白米饭' })

    const state = store.publicState()
    assert.equal(state.activeCardId, 'card-b')
    assert.deepEqual(state.memories.map((entry) => entry.text), ['B 的记忆'])
    assert.deepEqual(state.diaries.map((entry) => entry.title), ['B 的日记'])
    assert.equal(state.stats.active, 1)
    assert.equal(state.stats.diaries, 1)

    const prompt = buildPersonaPrompt(store, Date.now(), '')
    assert.ok(prompt.includes('B 的记忆'))
    assert.ok(!prompt.includes('A 的记忆'))
  } finally {
    cleanup()
  }
})

test('per-card memory export and cross-card import', () => {
  const { store, cleanup } = openStore(legacyStore())
  try {
    store.activateCard('card-a')
    store.addMemory({ text: '蓝色鲸鱼' })
    const exported = store.exportData('memories')
    assert.equal(exported.data.cardId, 'card-a')
    assert.equal(exported.data.memories.length, 1)

    store.activateCard('card-b')
    const result = store.importData('memories', 'merge', exported)
    assert.equal(result.memories, 1)
    const copied = store.publicState().memories.find((entry) => entry.text === '蓝色鲸鱼')
    assert.ok(copied, 'the copy belongs to the active card')
    assert.notEqual(copied.id, exported.data.memories[0].id, 'copies get a fresh id')
  } finally {
    cleanup()
  }
})

test('full backup keeps memory and diary card associations', () => {
  const source = openStore(legacyStore())
  const target = openStore()
  try {
    source.store.addMemory({ text: 'A 的记忆' })
    source.store.addDiary({ title: 'A 的日记', body: '内容' })
    const backup = source.store.exportData('all')

    target.store.importData('all', 'replace', backup)
    const cardIds = new Set(target.store.state.cards.map((card) => card.id))
    assert.ok(target.store.state.memories.every((memory) => cardIds.has(memory.cardId)))
    assert.ok(target.store.state.diaries.every((diary) => cardIds.has(diary.cardId)))
  } finally {
    source.cleanup()
    target.cleanup()
  }
})

test('per-conversation persona flags leave an off reminder', () => {
  const { store, cleanup } = openStore()
  try {
    store.setSessionPersona('s1', true)
    assert.equal(store.isSessionPersona('s1'), true)

    store.setSessionPersona('s1', false)
    assert.equal(store.isSessionPersona('s1'), false)
    assert.equal(store.isPersonaOffReminder('s1'), true)

    store.setSessionPersona('s1', true)
    assert.equal(store.isPersonaOffReminder('s1'), false)

    store.setSessionPersona('s2', false)
    assert.equal(store.isPersonaOffReminder('s2'), false, 'a chat that never had persona gets no reminder')

    store.setSessionPersona('s3', true)
    store.clearPersonaSessions()
    assert.equal(store.isPersonaOffReminder('s3'), true, 'clear-all reminds the chats it turned off')
  } finally {
    cleanup()
  }
})

test('importing cards preserves their ids so memories can follow', () => {
  const source = openStore()
  const target = openStore()
  try {
    source.store.importData('cards', 'replace', {
      cards: [{ id: 'kept-card', name: '保留卡', rules: [] }],
    })
    source.store.activateCard('kept-card')
    source.store.addMemory({ text: '跟随卡片的记忆' })
    const backup = source.store.exportData('all')

    target.store.importData('all', 'replace', backup)
    assert.ok(target.store.state.cards.some((card) => card.id === 'kept-card'))
    const memory = target.store.publicState().memories[0]
    assert.equal(memory.text, '跟随卡片的记忆')
    assert.equal(target.store.state.memories[0].cardId, 'kept-card')
  } finally {
    source.cleanup()
    target.cleanup()
  }
})
