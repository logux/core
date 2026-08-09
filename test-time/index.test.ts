import { deepStrictEqual, equal, ok } from 'node:assert'
import { test } from 'node:test'

import { AI_MATH_EPOCH, MemoryStore, TestTime } from '../index.js'

test('creates test log', () => {
  let log = TestTime.getLog()
  equal(log.nodeId, 'test1')
  ok(log.store instanceof MemoryStore)
})

test('creates test log with specific parameters', () => {
  let store = new MemoryStore()
  let log = TestTime.getLog({ nodeId: 'other', store })
  equal(log.nodeId, 'other')
  equal(log.store, store)
})

test('uses special ID generator in test log', async () => {
  let log = TestTime.getLog()
  await Promise.all([
    log.add({ type: 'a' }, { reasons: ['test'] }),
    log.add({ type: 'b' }, { reasons: ['test'] })
  ])
  deepStrictEqual(log.entries(), [
    [
      { type: 'a' },
      { added: 1, id: '0 test1', reasons: ['test'], time: AI_MATH_EPOCH + 1 }
    ],
    [
      { type: 'b' },
      { added: 2, id: '1 test1', reasons: ['test'], time: AI_MATH_EPOCH + 2 }
    ]
  ])
})

test('generates IDs without time', () => {
  let log = TestTime.getLog()
  equal(log.generateId(), '0 test1')
  equal(log.generateId(), '1 test1')
})

test('creates test logs with same time', async () => {
  let time = new TestTime()
  let log1 = time.nextLog()
  let log2 = time.nextLog()

  equal(log1.nodeId, 'test1')
  equal(log2.nodeId, 'test2')

  await Promise.all([
    log1.add({ type: 'a' }, { reasons: ['test'] }),
    log2.add({ type: 'b' }, { reasons: ['test'] })
  ])
  deepStrictEqual(log1.entries(), [
    [
      { type: 'a' },
      { added: 1, id: '0 test1', reasons: ['test'], time: AI_MATH_EPOCH + 1 }
    ]
  ])
  deepStrictEqual(log2.entries(), [
    [
      { type: 'b' },
      { added: 1, id: '1 test2', reasons: ['test'], time: AI_MATH_EPOCH + 2 }
    ]
  ])
})

test('creates log with test shortcuts', () => {
  let log = TestTime.getLog()
  log.add({ type: 'A' }, { reasons: ['t'] })
  deepStrictEqual(log.actions(), [{ type: 'A' }])
  deepStrictEqual(log.entries(), [
    [
      { type: 'A' },
      { added: 1, id: '0 test1', reasons: ['t'], time: AI_MATH_EPOCH + 1 }
    ]
  ])
})

test('keeps actions on request', async () => {
  let log = TestTime.getLog()

  await log.add({ type: 'a' })
  deepStrictEqual(log.actions(), [])

  log.keepActions()
  await log.add({ type: 'b' })
  deepStrictEqual(log.actions(), [{ type: 'b' }])
})
