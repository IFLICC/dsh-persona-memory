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

test('library entries bind to the active card and update by title', () => {
  const { store, cleanup } = openStore(legacyStore())
  try {
    const first = store.addLibrary({
      title: '绷不住了',
      content: '表达忍不住笑出来的网络用语',
      kind: 'meme',
      tags: ['梗', '网络'],
      url: 'https://example.com/meme',
      source: 'web',
    })
    assert.equal(first.updated, false)
    assert.equal(store.publicState().stats.library, 1)

    const again = store.addLibrary({
      title: '绷不住了',
      content: '更新后的解释',
      kind: 'meme',
      tags: ['梗'],
    })
    assert.equal(again.updated, true)
    assert.equal(store.state.library.length, 1)
    assert.equal(again.entry.content, '更新后的解释')

    store.activateCard('card-b')
    assert.equal(store.publicState().library.length, 0)
    store.addLibrary({ title: 'B 的知识点', content: '只属于 B', kind: 'knowledge' })
    assert.equal(store.publicState().library.length, 1)
    assert.equal(store.listLibrary({ query: '绷不住了' }).length, 0)

    store.activateCard('card-a')
    assert.equal(store.publicState().library.length, 1)
    assert.equal(store.listLibrary({ query: '绷不住' })[0].title, '绷不住了')
    const prompt = buildPersonaPrompt(store, Date.now(), '')
    assert.ok(prompt.includes('【资料库】'))
    assert.ok(prompt.includes('绷不住了'))
    assert.ok(!prompt.includes('B 的知识点'))
  } finally {
    cleanup()
  }
})

test('library export/import copies into the active card with fresh ids', () => {
  const { store, cleanup } = openStore(legacyStore())
  try {
    store.addLibrary({ title: 'A 的梗', content: 'A 的梗说明', kind: 'meme' })
    const exported = store.exportData('library')
    assert.equal(exported.data.cardId, 'card-a')
    assert.equal(exported.data.entries.length, 1)

    store.activateCard('card-b')
    const result = store.importData('library', 'merge', exported)
    assert.equal(result.library, 1)
    const copied = store.publicState().library[0]
    assert.equal(copied.title, 'A 的梗')
    assert.notEqual(copied.id, exported.data.entries[0].id)

    store.activateCard('card-a')
    assert.equal(store.publicState().library.length, 1, 'source card keeps its entry')
  } finally {
    cleanup()
  }
})

test('full backup and card deletion handle library entries', () => {
  const source = openStore(legacyStore())
  const target = openStore()
  try {
    source.store.addLibrary({ title: 'A 的梗', content: 'A', kind: 'meme' })
    source.store.activateCard('card-b')
    source.store.addLibrary({ title: 'B 的知识', content: 'B', kind: 'knowledge' })
    const backup = source.store.exportData('all')
    assert.equal(backup.data.library.length, 2)

    target.store.importData('all', 'replace', backup)
    const cardIds = new Set(target.store.state.cards.map((card) => card.id))
    assert.ok(target.store.state.library.every((entry) => cardIds.has(entry.cardId)))

    source.store.deleteCard('card-b')
    assert.ok(!source.store.state.library.some((entry) => entry.cardId === 'card-b'))
    assert.equal(source.store.state.library.length, 1)

    target.store.activateCard('card-b')
    const cleared = target.store.clearCardLibrary()
    assert.equal(cleared.library, 1)
    assert.equal(target.store.publicState().library.length, 0)
    target.store.activateCard('card-a')
    assert.equal(target.store.publicState().library.length, 1)
  } finally {
    source.cleanup()
    target.cleanup()
  }
})

function traitValue(card, key) {
  return card.traits.find((trait) => trait.key === key)?.value
}

test('legacy card fields migrate to sections and traits', () => {
  const seed = legacyStore()
  seed.cards[0] = {
    id: 'card-a',
    name: 'A',
    title: '',
    description: '描述内容',
    style: '风格内容',
    rules: ['规则一', '规则二'],
    greeting: '',
  }
  const { store, cleanup } = openStore(seed)
  try {
    const card = store.state.cards.find((entry) => entry.id === 'card-a')
    assert.deepEqual(
      card.sections.map((section) => section.label),
      ['人格描述', '说话风格', '准则 1', '准则 2'],
    )
    assert.equal(card.sections[0].content, '描述内容')
    assert.equal(traitValue(card, 'humanize'), 50)

    const prompt = buildPersonaPrompt(store, Date.now(), '')
    assert.ok(prompt.includes('【人格描述】描述内容'))
    assert.ok(prompt.includes('【准则 1】规则一'))
    assert.ok(prompt.includes('拟人度 50'))
  } finally {
    cleanup()
  }
})

test('custom sections and trait weights drive the prompt', () => {
  const { store, cleanup } = openStore(legacyStore())
  try {
    store.activateCard('card-a')
    store.saveCard({
      id: 'card-a',
      sections: [
        { label: '口癖', content: '喜欢说“欸嘿”' },
        { label: '禁忌', content: '不要讨论政治' },
      ],
      traits: [
        { key: 'humanize', label: '拟人度', value: 90 },
        { key: 'memes', label: '玩梗', value: 10 },
        { key: 'emotion', label: '情绪', value: 70 },
        { key: 'actions', label: '动作描写', value: 30 },
        { key: 'initiative', label: '主动性', value: 80 },
        { key: 'teasing', label: '吐槽', value: 20 },
        { label: '毒舌', value: 80 },
      ],
    })
    const card = store.state.cards.find((entry) => entry.id === 'card-a')
    assert.deepEqual(card.sections.map((section) => section.label), ['口癖', '禁忌'])
    assert.equal(traitValue(card, 'humanize'), 90)

    const prompt = buildPersonaPrompt(store, Date.now(), '')
    assert.ok(prompt.includes('【口癖】喜欢说“欸嘿”'))
    assert.ok(prompt.includes('【禁忌】不要讨论政治'))
    assert.ok(prompt.includes('拟人度 90'))
    assert.ok(prompt.includes('强烈拟人'))
    assert.ok(prompt.includes('玩梗 10'))
    assert.ok(prompt.includes('几乎不用网络梗'))
    assert.ok(prompt.includes('毒舌 80'))
    assert.ok(prompt.includes('比较明显'))

    const exported = store.exportData('cards')
    assert.equal(exported.data.cards[0].sections.length, 2)
    assert.equal(traitValue(exported.data.cards[0], 'humanize'), 90)
    assert.equal(exported.data.cards[0].traits.find((trait) => trait.label === '毒舌').value, 80)

    const target = openStore()
    try {
      target.store.importData('cards', 'replace', exported)
      const imported = target.store.state.cards[0]
      assert.deepEqual(imported.sections.map((section) => section.label), ['口癖', '禁忌'])
      assert.equal(traitValue(imported, 'humanize'), 90)
      assert.equal(imported.traits.find((trait) => trait.label === '毒舌').value, 80)
    } finally {
      target.cleanup()
    }
  } finally {
    cleanup()
  }
})

test('creating a card uses the default template instead of the active card', () => {
  const { store, cleanup } = openStore(legacyStore())
  try {
    store.activateCard('card-a')
    store.saveCard({
      id: 'card-a',
      sections: [{ label: '口癖', content: '只属于 A 的设定' }],
      traits: [
        { key: 'humanize', label: '拟人度', value: 90 },
        { key: 'memes', label: '玩梗', value: 10 },
        { label: '毒舌', value: 80 },
      ],
    })

    const created = store.createCard({ name: '新人物卡' })
    assert.equal(created.name, '新人物卡')
    assert.deepEqual(
      created.sections.map((section) => section.label),
      ['人格描述', '说话风格', '准则 1', '准则 2', '准则 3'],
    )
    assert.equal(traitValue(created, 'humanize'), 50)
    assert.equal(traitValue(created, 'memes'), 50)
    assert.ok(!created.traits.some((trait) => trait.label === '毒舌'))
    assert.ok(!created.sections.some((section) => section.label === '口癖'))
  } finally {
    cleanup()
  }
})

test('trait entries can be deleted entirely', () => {
  const { store, cleanup } = openStore(legacyStore())
  try {
    store.activateCard('card-a')
    store.saveCard({ id: 'card-a', traits: [] })
    const card = store.state.cards.find((entry) => entry.id === 'card-a')
    assert.equal(card.traits.length, 0)
    assert.ok(!buildPersonaPrompt(store, Date.now(), '').includes('【表现权重】'))
  } finally {
    cleanup()
  }
})

test('due memories from another card never enter the prompt', () => {
  const { store, cleanup } = openStore(legacyStore())
  try {
    store.activateCard('card-a')
    const memory = store.addMemory({
      text: 'A 的模糊记忆：遥的角色曲是 Little Wish',
      cardId: 'card-a',
    })
    memory.lastReviewedAt = Date.now() - 30 * DAY
    memory.reviews = 0
    assert.equal(store.isDue(memory), true)

    store.activateCard('card-b')
    const otherCardPrompt = buildPersonaPrompt(store, Date.now(), '')
    assert.ok(!otherCardPrompt.includes('Little Wish'))

    store.activateCard('card-a')
    const ownCardPrompt = buildPersonaPrompt(store, Date.now(), '')
    assert.ok(ownCardPrompt.includes('Little Wish'))
  } finally {
    cleanup()
  }
})
