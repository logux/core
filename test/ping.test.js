var TestTime = require('logux-core').TestTime

var ClientSync = require('../client-sync')
var TestPair = require('../test-pair')

function wait (ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms)
  })
}

function createTest (opts) {
  var log = TestTime.getLog()
  var test = new TestPair()
  return log.add({ type: 'test' }).then(function () {
    log.store.lastSent = 1
    test.leftSync = new ClientSync('client', log, test.left, opts)
    return test.left.connect()
  }).then(function () {
    return test.wait()
  }).then(function () {
    test.right.send(['connected', test.leftSync.protocol, 'server', [0, 0]])
    test.clear()
    return test
  })
}

it('throws on ping and no timeout options', function () {
  expect(function () {
    new ClientSync('client', null, null, { ping: 1000, timeout: 0 })
  }).toThrowError(/set timeout option/)
})

it('answers pong on ping', function () {
  return createTest({ fixTime: false }).then(function (test) {
    test.right.send(['ping', 1])
    return test.wait('right')
  }).then(function (test) {
    expect(test.leftSent).toEqual([['pong', 1]])
  })
})

it('sends ping on idle connection', function () {
  var error, test
  return createTest({
    ping: 300,
    timeout: 100,
    fixTime: false
  }).then(function (created) {
    test = created
    test.leftSync.testMessage = function () { }
    test.leftSync.catch(function (err) {
      error = err
    })
    return wait(250)
  }).then(function () {
    test.right.send(['test'])
    return wait(250)
  }).then(function () {
    test.leftSync.send(['test'])
    return wait(250)
  }).then(function () {
    expect(error).toBeUndefined()
    expect(test.leftSent).toEqual([['test']])
    return wait(100)
  }).then(function () {
    expect(error).toBeUndefined()
    expect(test.leftSent).toEqual([['test'], ['ping', 1]])
    test.right.send(['pong', 1])
    return wait(250)
  }).then(function () {
    expect(error).toBeUndefined()
    expect(test.leftSent).toEqual([['test'], ['ping', 1]])
    return wait(100)
  }).then(function () {
    expect(error).toBeUndefined()
    expect(test.leftSent).toEqual([['test'], ['ping', 1], ['ping', 1]])
    return wait(250)
  }).then(function () {
    expect(error.message).toContain('timeout')
    expect(test.leftSent).toEqual([['test'], ['ping', 1], ['ping', 1]])
  })
})

it('sends only one ping if timeout is bigger than ping', function () {
  return createTest({
    ping: 100,
    timeout: 300,
    fixTime: false
  }).then(function (test) {
    return wait(250).then(function () {
      expect(test.leftSent).toEqual([['ping', 1]])
    })
  })
})

it('checks types', function () {
  var wrongs = [
    ['ping'],
    ['ping', 'abc'],
    ['ping', []],
    ['pong'],
    ['pong', 'abc'],
    ['pong', {}]
  ]
  return Promise.all(wrongs.map(function (command) {
    return createTest({ fixTime: false }).then(function (test) {
      test.right.send(command)
      return test.wait('right')
    }).then(function (test) {
      expect(test.leftSync.connected).toBeFalsy()
      expect(test.leftSent).toEqual([
        ['error', 'wrong-format', JSON.stringify(command)]
      ])
    })
  }))
})
