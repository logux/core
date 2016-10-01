var createTestTimer = require('logux-core').createTestTimer
var MemoryStore = require('logux-core').MemoryStore
var Log = require('logux-core').Log

var LocalPair = require('../local-pair')
var ActiveSync = require('../active-sync')

function wait (ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms)
  })
}

function initTest (opts) {
  var log = new Log({ store: new MemoryStore(), timer: createTestTimer() })
  log.lastAdded = 1
  var pair = new LocalPair()
  var sync = new ActiveSync('host', log, pair.left, opts)

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
    new ActiveSync('host', null, null, { ping: 1000 })
  }).toThrowError(/set timeout option/)
})

it('throws on small ping', function () {
  expect(function () {
    new ActiveSync('host', null, null, { ping: 1000, timeout: 1000 })
  }).toThrowError(/longer than timeout/)
})

it('answers pong on ping', function () {
  var test = initTest()
  test.right.send(['ping', 1])
  expect(test.sent).toEqual([['pong', 1]])
})

it('sends ping on idle connection', function () {
  var test = initTest({ ping: 300, timeout: 100 })
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
  })
})
