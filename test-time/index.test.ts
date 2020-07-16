import { MemoryStore, TestTime } from '../index.js'

it('creates test log', () => {
  let log = TestTime.getLog()
  expect(log.nodeId).toEqual('test1')
  expect(log.store instanceof MemoryStore).toBe(true)
})

it('creates test log with specific parameters', () => {
  let store = new MemoryStore()
  let log = TestTime.getLog({ store, nodeId: 'other' })
  expect(log.nodeId).toEqual('other')
  expect(log.store).toBe(store)
})

it('uses special ID generator in test log', async () => {
  let log = TestTime.getLog()
  await Promise.all([
    log.add({ type: 'a' }, { reasons: ['test'] }),
    log.add({ type: 'b' }, { reasons: ['test'] })
  ])
  expect(log.entries()).toEqual([
    [{ type: 'a' }, { added: 1, time: 1, id: '1 test1 0', reasons: ['test'] }],
    [{ type: 'b' }, { added: 2, time: 2, id: '2 test1 0', reasons: ['test'] }]
  ])
})

it('creates test logs with same time', async () => {
  let time = new TestTime()
  let log1 = time.nextLog()
  let log2 = time.nextLog()

  expect(log1.nodeId).toEqual('test1')
  expect(log2.nodeId).toEqual('test2')

  await Promise.all([
    log1.add({ type: 'a' }, { reasons: ['test'] }),
    log2.add({ type: 'b' }, { reasons: ['test'] })
  ])
  expect(log1.entries()).toEqual([
    [{ type: 'a' }, { added: 1, time: 1, id: '1 test1 0', reasons: ['test'] }]
  ])
  expect(log2.entries()).toEqual([
    [{ type: 'b' }, { added: 1, time: 2, id: '2 test2 0', reasons: ['test'] }]
  ])
})

it('creates log with test shortcuts', () => {
  let log = TestTime.getLog()
  log.add({ type: 'A' }, { reasons: ['t'] })
  expect(log.actions()).toEqual([{ type: 'A' }])
  expect(log.entries()).toEqual([
    [{ type: 'A' }, { id: '1 test1 0', time: 1, added: 1, reasons: ['t'] }]
  ])
})
