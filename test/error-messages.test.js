var LocalPair = require('../local-pair')
var SyncError = require('../sync-error')
var BaseSync = require('../base-sync')

function createTest () {
  var log = { on: function () { } }
  var pair = new LocalPair()
  var sync = new BaseSync('host', log, pair.left)
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
  test.sync.connection.other().send({ hi: 1 })
  expect(test.messages).toEqual([
    ['error', 'Wrong message format in 1', 'protocol'],
    ['error', 'Wrong message format in {"hi":1}', 'protocol']
  ])
})

it('sends error on wrong message type format', function () {
  var test = createTest()
  test.sync.connection.other().send([])
  test.sync.connection.other().send([1])
  expect(test.messages).toEqual([
    ['error', 'Wrong type in message []', 'protocol'],
    ['error', 'Wrong type in message [1]', 'protocol']
  ])
})

it('sends error on unknown message type', function () {
  var test = createTest()
  test.sync.connection.other().send(['test'])
  expect(test.messages).toEqual([
    ['error', 'Unknown message type `test`', 'protocol']
  ])
})

it('throws a error on error message by default', function () {
  var sync = createTest().sync
  expect(function () {
    sync.connection.other().send(['error', 'test error'])
  }).toThrow(new SyncError(sync, 'test error', undefined, true))
})

it('disables throwing a error on listener', function () {
  var sync = createTest().sync
  var errors = []
  sync.catch(function (error) {
    errors.push(error)
  })

  sync.connection.other().send(['error', 'test error', 'custom'])
  expect(errors).toEqual([new SyncError(sync, 'test error', 'custom', true)])
})

it('emits a event on error sending', function () {
  var sync = createTest().sync
  var errors = []
  sync.on('sendedError', function (desc, type) {
    errors.push([desc, type])
  })

  sync.sendError('test', 'type')
  expect(errors).toEqual([['test', 'type']])
})
