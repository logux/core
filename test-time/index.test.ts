import { deepStrictEqual, equal, ok } from 'node:assert'
import { test } from 'node:test'

import { MemoryStore, TestTime } from '../index.js'

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
    [{ type: 'a' }, { added: 1, id: '1 test1 0', reasons: ['test'], time: 1 }],
    [{ type: 'b' }, { added: 2, id: '2 test1 0', reasons: ['test'], time: 2 }]
  ])
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
    [{ type: 'a' }, { added: 1, id: '1 test1 0', reasons: ['test'], time: 1 }]
  ])
  deepStrictEqual(log2.entries(), [
    [{ type: 'b' }, { added: 1, id: '2 test2 0', reasons: ['test'], time: 2 }]
  ])
})

test('creates log with test shortcuts', () => {
  let log = TestTime.getLog()
  log.add({ type: 'A' }, { reasons: ['t'] })
  deepStrictEqual(log.actions(), [{ type: 'A' }])
  deepStrictEqual(log.entries(), [
    [{ type: 'A' }, { added: 1, id: '1 test1 0', reasons: ['t'], time: 1 }]
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
