var createTestTimer = require('logux-core').createTestTimer
var MemoryStore = require('logux-core').MemoryStore
var Log = require('logux-core').Log

var PassiveSync = require('../passive-sync')
var ActiveSync = require('../active-sync')
var LocalPair = require('../local-pair')

function createTest () {
  var log = new Log({ store: new MemoryStore(), timer: createTestTimer() })
  var pair = new LocalPair()
  var active = new ActiveSync('client', log, pair.left)
  var passive = new PassiveSync('server', log, pair.right)

  active.catch(function () { })
  passive.catch(function () { })

  var sendedActive = []
  passive.connection.on('message', function (msg) {
    sendedActive.push(msg)
  })
  var sendedPassive = []
  active.connection.on('message', function (msg) {
    sendedPassive.push(msg)
  })

  return {
    sendedPassive: sendedPassive,
    sendedActive: sendedActive,
    passive: passive,
    active: active
  }
}

function nextTick () {
  return new Promise(function (resolve) {
    setTimeout(function () {
      resolve()
    }, 1)
  })
}

it('sends protocol version and host in connect message', function () {
  var test = createTest()
  test.active.connection.connect()
  expect(test.sendedActive).toEqual([
    ['connect', test.active.protocol, 'client', 0]
  ])
})

it('answers with protocol version and host in connected message', function () {
  var test = createTest()
  test.active.connection.connect()
  expect(test.sendedPassive).toEqual([
    ['connected', test.passive.protocol, 'server', [1, 2]]
  ])
})

it('checks protocol version', function () {
  var test = createTest()
  test.active.protocol = [2, 0]
  test.passive.protocol = [1, 0]

  test.active.connection.connect()
  test.passive.connection.emitter.emit('message', ['test', 1])

  expect(test.sendedPassive).toEqual([
    ['error', 'Only 1.x protocols are supported, but you use 2.0', 'protocol']
  ])
  expect(test.active.connected).toBeFalsy()
})

it('saves other client host', function () {
  var test = createTest()
  test.active.connection.connect()
  expect(test.active.otherHost).toEqual('server')
  expect(test.passive.otherHost).toEqual('client')
})

it('saves other client protocol', function () {
  var test = createTest()
  test.active.protocol = [1, 0]
  test.passive.protocol = [1, 1]

  test.active.connection.connect()
  expect(test.active.otherProtocol).toEqual([1, 1])
  expect(test.passive.otherProtocol).toEqual([1, 0])
})

it('sends credentials in connect', function () {
  var test = createTest()
  test.active.options = { credentials: { a: 1, b: 2 } }

  test.active.connection.connect()
  expect(test.sendedActive).toEqual([
    ['connect', test.active.protocol, 'client', 0, { a: 1, b: 2 }]
  ])
})

it('sends credentials in connected', function () {
  var test = createTest()
  test.passive.options = { credentials: 1 }

  test.active.connection.connect()
  expect(test.sendedPassive).toEqual([
    ['connected', test.passive.protocol, 'server', [1, 2], 1]
  ])
})

it('sends error on messages before auth', function () {
  var test = createTest()
  test.active.destroy()
  test.passive.testMessage = function () { }

  test.active.connection.connect()
  test.active.connection.send(['test'])

  expect(test.sendedPassive).toEqual([
    ['error', 'Start authentication before sending `test` message', 'protocol']
  ])
})

it('denies access for wrong users', function () {
  var test = createTest()
  test.passive.testMessage = jest.fn()
  test.passive.options = {
    auth: function () {
      return Promise.resolve(false)
    }
  }

  test.active.connection.connect()
  test.active.send(['test'])

  return nextTick().then(function () {
    expect(test.sendedPassive).toEqual([
      ['error', 'Wrong credentials', 'auth']
    ])
    expect(test.passive.testMessage).not.toBeCalled()
    expect(test.passive.connected).toBeFalsy()
  })
})

it('denies access to wrong server', function () {
  var test = createTest()
  test.active.options = {
    auth: function () {
      return Promise.resolve(false)
    }
  }

  test.active.connection.connect()

  return nextTick().then(function () {
    expect(test.sendedActive).toEqual([
      ['connect', test.active.protocol, 'client', 0],
      ['error', 'Wrong credentials', 'auth']
    ])
    expect(test.active.connected).toBeFalsy()
  })
})

it('allows access for right users', function () {
  var test = createTest()
  test.active.options = { credentials: 'a' }
  test.passive.testMessage = jest.fn()
  test.passive.options = {
    auth: function (credentials, host) {
      return Promise.resolve(credentials === 'a' && host === 'client')
    }
  }

  test.active.connection.connect()
  test.active.send(['test'])

  return nextTick().then(function () {
    expect(test.sendedPassive).toEqual([
      ['connected', test.passive.protocol, 'server', [1, 2]]
    ])
    expect(test.passive.testMessage).toBeCalled()
  })
})

it('has default timeFix', function () {
  var test = createTest()
  test.active.connection.connect()
  expect(test.active.timeFix).toEqual(0)
})

it('calculates time difference', function () {
  var test = createTest()
  var times1 = [10000, 10000 + 1000 + 100]
  test.active.log = new Log({
    store: new MemoryStore(),
    timer: function () {
      return [times1.shift()]
    }
  })
  var times2 = [0 + 50, 0 + 50 + 1000]
  test.passive.log = new Log({
    store: new MemoryStore(),
    timer: function () {
      return [times2.shift()]
    }
  })

  test.active.options.fixTime = true
  test.active.connection.connect()

  expect(test.active.timeFix).toEqual(10000)
})

it('uses timeout between connect and connected', function () {
  jest.useFakeTimers()

  var log = new Log({ store: new MemoryStore(), timer: createTestTimer() })
  var pair = new LocalPair()
  var active = new ActiveSync('client', log, pair.left, { timeout: 1000 })

  var error
  active.catch(function (err) {
    error = err
  })

  pair.left.connect()
  jest.runOnlyPendingTimers()

  expect(error.name).toEqual('SyncError')
  expect(error.type).toEqual('connection')
  expect(error.message).not.toContain('received')
  expect(error.message).toContain('timeout')
})

it('connects with timeout', function () {
  jest.useFakeTimers()

  var test = createTest()
  var error
  test.active.catch(function (err) {
    error = err
  })
  test.active.options.timeout = 1000
  test.active.connection.connect()

  jest.runOnlyPendingTimers()
  expect(error).toBeUndefined()
})
