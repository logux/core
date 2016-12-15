var createTestTimer = require('logux-core').createTestTimer
var MemoryStore = require('logux-core').MemoryStore
var Log = require('logux-core').Log

var ClientSync = require('../client-sync')
var LocalPair = require('../local-pair')

function wait (ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms)
  })
}

function initTest (opts) {
  var log = new Log({ store: new MemoryStore(), timer: createTestTimer() })
  log.lastAdded = 1
  var pair = new LocalPair()
  var sync = new ClientSync('client', log, pair.left, opts)

  sync.connection.connect()
  sync.connection.other().send(['connected', sync.protocol, 'server'])

  var sent = []
  sync.connection.other().on('message', function (msg) {
    sent.push(msg)
  })

  return { sync: sync, sent: sent, right: sync.connection.other() }
}

it('throws on ping and no timeout options', function () {
  expect(function () {
    new ClientSync('client', null, null, { ping: 1000, timeout: 0 })
  }).toThrowError(/set timeout option/)
})

it('answers pong on ping', function () {
  var test = initTest({ fixTime: false })
  test.right.send(['ping', 1])
  expect(test.sent).toEqual([['pong', 1]])
})

it('sends ping on idle connection', function () {
  var test = initTest({ ping: 300, timeout: 100, fixTime: false })
  test.sync.testMessage = function () { }

  var error
  test.sync.catch(function (err) {
    error = err
  })

  return wait(250).then(function () {
    test.sync.connection.other().send(['test'])
    return wait(250)
  }).then(function () {
    test.sync.send(['test'])
    return wait(250)
  }).then(function () {
    expect(error).toBeUndefined()
    expect(test.sent).toEqual([['test']])
    return wait(100)
  }).then(function () {
    expect(error).toBeUndefined()
    expect(test.sent).toEqual([['test'], ['ping', 1]])
    test.right.send(['pong', 1])
    return wait(250)
  }).then(function () {
    expect(error).toBeUndefined()
    expect(test.sent).toEqual([['test'], ['ping', 1]])
    return wait(100)
  }).then(function () {
    expect(error).toBeUndefined()
    expect(test.sent).toEqual([['test'], ['ping', 1], ['ping', 1]])
    return wait(250)
  }).then(function () {
    expect(error.message).toContain('timeout')
    expect(test.sent).toEqual([
      ['test'],
      ['ping', 1],
      ['ping', 1]
    ])
  })
})

it('sends only one ping if timeout is bigger than ping', function () {
  var test = initTest({ ping: 100, timeout: 300, fixTime: false })
  return wait(250).then(function () {
    expect(test.sent).toEqual([['ping', 1]])
  })
})
