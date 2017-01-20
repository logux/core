var TestTime = require('logux-core').TestTime

var ClientSync = require('../client-sync')
var LocalPair = require('../local-pair')

function wait (ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms)
  })
}

function initTest (opts) {
  var log = TestTime.getLog()
  var sync
  return log.add({ type: 'test' }).then(function () {
    log.store.lastSent = 1
    sync = new ClientSync('client', log, (new LocalPair()).left, opts)

    sync.connection.connect()
    return wait(1)
  }).then(function () {
    sync.connection.other().send(['connected', sync.protocol, 'server'], [0, 0])

    var sent = []
    sync.connection.other().on('message', function (msg) {
      sent.push(msg)
    })

    return { sync: sync, sent: sent }
  })
}

it('throws on ping and no timeout options', function () {
  expect(function () {
    new ClientSync('client', null, null, { ping: 1000, timeout: 0 })
  }).toThrowError(/set timeout option/)
})

it('answers pong on ping', function () {
  return initTest({ fixTime: false }).then(function (test) {
    test.sync.connection.other().send(['ping', 1])
    expect(test.sent).toEqual([['pong', 1]])
  })
})

it('sends ping on idle connection', function () {
  var error, test
  return initTest({
    ping: 300,
    timeout: 100,
    fixTime: false
  }).then(function (created) {
    test = created
    test.sync.testMessage = function () { }
    test.sync.catch(function (err) {
      error = err
    })
    return wait(250)
  }).then(function () {
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
    test.sync.connection.other().send(['pong', 1])
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
  return initTest({
    ping: 100,
    timeout: 300,
    fixTime: false
  }).then(function (test) {
    return wait(250).then(function () {
      expect(test.sent).toEqual([['ping', 1]])
    })
  })
})

it('checks ping synced type', function () {
  var test = initTest({ fixTime: false })

  test.right.send(['ping'])
  expect(test.right.connected).toBeFalsy()
  expect(test.sent).toEqual([['error', 'wrong-format', '["ping"]']])

  test = initTest({ fixTime: false })
  test.right.send(['ping', 'abc'])
  expect(test.right.connected).toBeFalsy()
  expect(test.sent).toEqual([['error', 'wrong-format', '["ping","abc"]']])

  test = initTest({ fixTime: false })
  test.right.send(['ping', []])
  expect(test.right.connected).toBeFalsy()
  expect(test.sent).toEqual([['error', 'wrong-format', '["ping",[]]']])
})

it('checks pong synced type', function () {
  var test = initTest({ fixTime: false })

  test.right.send(['pong'])
  expect(test.right.connected).toBeFalsy()
  expect(test.sent).toEqual([['error', 'wrong-format', '["pong"]']])

  test = initTest({ fixTime: false })
  test.right.send(['pong', 'abc'])
  expect(test.right.connected).toBeFalsy()
  expect(test.sent).toEqual([['error', 'wrong-format', '["pong","abc"]']])

  test = initTest({ fixTime: false })
  test.right.send(['pong', {}])
  expect(test.right.connected).toBeFalsy()
  expect(test.sent).toEqual([['error', 'wrong-format', '["pong",{}]']])
})
