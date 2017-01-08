var MemoryStore = require('../memory-store')
var TestTime = require('../test-time')

function checkEntries (log, expected) {
  var entries = log.store.created.map(function (entry) {
    return [entry[0], entry[1]]
  })
  expect(entries).toEqual(expected)
}

it('creates test log', function () {
  var log = TestTime.getLog()
  expect(log.nodeId).toEqual('test1')
  expect(log.store instanceof MemoryStore).toBeTruthy()
})

it('uses special ID generator in test log', function () {
  var log = TestTime.getLog()
  return Promise.all([
    log.add({ type: 'a' }),
    log.add({ type: 'b' })
  ]).then(function () {
    checkEntries(log, [
      [{ type: 'b' }, { added: 2, time: 2, id: [2, 'test1', 0] }],
      [{ type: 'a' }, { added: 1, time: 1, id: [1, 'test1', 0] }]
    ])
  })
})

it('creates test logs with same time', function () {
  var time = new TestTime()
  var log1 = time.nextLog()
  var log2 = time.nextLog()

  expect(log1.nodeId).toEqual('test1')
  expect(log2.nodeId).toEqual('test2')

  return Promise.all([
    log1.add({ type: 'a' }),
    log2.add({ type: 'b' })
  ]).then(function () {
    checkEntries(log1, [
      [{ type: 'a' }, { added: 1, time: 1, id: [1, 'test1', 0] }]
    ])
    checkEntries(log2, [
      [{ type: 'b' }, { added: 1, time: 2, id: [2, 'test2', 0] }]
    ])
  })
})
