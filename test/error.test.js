var TestTime = require('logux-core').TestTime

var LocalPair = require('../local-pair')
var SyncError = require('../sync-error')
var BaseSync = require('../base-sync')

function createTest () {
  var log = TestTime.getLog()
  var pair = new LocalPair()
  var sync = new BaseSync('server', log, pair.left)
  var messages = []
  pair.right.on('message', function (msg) {
    messages.push(msg)
  })
  pair.left.connect()
  return {
    messages: messages,
    sync: sync
  }
}

it('sends error on wrong message format', function () {
  var test = createTest()

  test.sync.connection.other().send(1)
  expect(test.sync.connection.connected).toBeFalsy()

  test.sync.connection.connect()
  test.sync.connection.other().send({ hi: 1 })
  expect(test.sync.connection.connected).toBeFalsy()

  test.sync.connection.connect()
  test.sync.connection.other().send([])
  expect(test.sync.connection.connected).toBeFalsy()

  test.sync.connection.connect()
  test.sync.connection.other().send([1])
  expect(test.sync.connection.connected).toBeFalsy()

  expect(test.messages).toEqual([
    ['error', 'wrong-format', '1'],
    ['error', 'wrong-format', '{"hi":1}'],
    ['error', 'wrong-format', '[]'],
    ['error', 'wrong-format', '[1]']
  ])
})

it('sends error on wrong error param types', function () {
  var test = createTest()

  test.sync.connection.other().send(['error'])
  expect(test.sync.connection.connected).toBeFalsy()

  test.sync.connection.connect()
  test.sync.connection.other().send(['error', 1])
  expect(test.sync.connection.connected).toBeFalsy()

  test.sync.connection.connect()
  test.sync.connection.other().send(['error', {}])
  expect(test.sync.connection.connected).toBeFalsy()

  expect(test.messages).toEqual([
    ['error', 'wrong-format', '["error"]'],
    ['error', 'wrong-format', '["error",1]'],
    ['error', 'wrong-format', '["error",{}]']
  ])
})

it('sends error on unknown message type', function () {
  var test = createTest()
  test.sync.connection.other().send(['test'])
  expect(test.sync.connection.connected).toBeFalsy()
  expect(test.messages).toEqual([
    ['error', 'unknown-message', 'test']
  ])
})

it('throws a error on error message by default', function () {
  var sync = createTest().sync
  expect(function () {
    sync.connection.other().send(['error', 'wrong-format', '1'])
  }).toThrow(new SyncError(sync, 'wrong-format', '1', true))
})

it('disables throwing a error on listener', function () {
  var sync = createTest().sync
  var errors = []
  sync.catch(function (error) {
    errors.push(error)
  })

  sync.connection.other().send(['error', 'wrong-format', '2'])
  expect(errors).toEqual([new SyncError(sync, 'wrong-format', '2', true)])
})

it('emits a event on error sending', function () {
  var sync = createTest().sync
  var errors = []
  sync.on('clientError', function (err) {
    errors.push(err)
  })

  var error = new SyncError(sync, 'test', 'type')
  sync.sendError(error)
  expect(errors).toEqual([error])
})
