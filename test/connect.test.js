var createTestTimer = require('logux-core').createTestTimer
var MemoryStore = require('logux-core').MemoryStore
var Log = require('logux-core').Log

var ClientSync = require('../client-sync')
var ServerSync = require('../server-sync')
var LocalPair = require('../local-pair')

function createTest () {
  var log = new Log({ store: new MemoryStore(), timer: createTestTimer() })
  var pair = new LocalPair()
  var client = new ClientSync('client', log, pair.left)
  var server = new ServerSync('server', log, pair.right)

  client.catch(function () { })
  server.catch(function () { })

  var clientSent = []
  server.connection.on('message', function (msg) {
    clientSent.push(msg)
  })
  var serverSent = []
  client.connection.on('message', function (msg) {
    serverSent.push(msg)
  })

  return {
    serverSent: serverSent,
    clientSent: clientSent,
    server: server,
    client: client
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
  test.client.connection.connect()
  expect(test.clientSent).toEqual([
    ['connect', test.client.protocol, 'client', 0]
  ])
})

it('answers with protocol version and host in connected message', function () {
  var test = createTest()
  test.client.connection.connect()
  expect(test.serverSent).toEqual([
    ['connected', test.server.protocol, 'server', [1, 2]]
  ])
})

it('checks protocol version', function () {
  var test = createTest()
  test.client.protocol = [2, 0]
  test.server.protocol = [1, 0]

  test.client.connection.connect()
  test.server.connection.emitter.emit('message', ['test', 1])

  expect(test.serverSent).toEqual([
    ['error', 'Only 1.x protocols are supported, but you use 2.0', 'protocol']
  ])
  expect(test.client.connected).toBeFalsy()
})

it('saves other client host', function () {
  var test = createTest()
  test.client.connection.connect()
  expect(test.client.otherHost).toEqual('server')
  expect(test.server.otherHost).toEqual('client')
})

it('saves other client protocol', function () {
  var test = createTest()
  test.client.protocol = [1, 0]
  test.server.protocol = [1, 1]

  test.client.connection.connect()
  expect(test.client.otherProtocol).toEqual([1, 1])
  expect(test.server.otherProtocol).toEqual([1, 0])
})

it('sends credentials in connect', function () {
  var test = createTest()
  test.client.options = { credentials: { a: 1, b: 2 } }

  test.client.connection.connect()
  expect(test.clientSent).toEqual([
    ['connect', test.client.protocol, 'client', 0, { a: 1, b: 2 }]
  ])
})

it('sends credentials in connected', function () {
  var test = createTest()
  test.server.options = { credentials: 1 }

  test.client.connection.connect()
  expect(test.serverSent).toEqual([
    ['connected', test.server.protocol, 'server', [1, 2], 1]
  ])
})

it('sends error on messages before auth', function () {
  var test = createTest()
  test.client.destroy()
  test.server.testMessage = function () { }

  test.client.connection.connect()
  test.client.connection.send(['test'])

  expect(test.serverSent).toEqual([
    ['error', 'Start authentication before sending `test` message', 'protocol']
  ])
})

it('denies access for wrong users', function () {
  var test = createTest()
  test.server.testMessage = jest.fn()
  test.server.options = {
    auth: function () {
      return Promise.resolve(false)
    }
  }

  test.client.connection.connect()
  test.client.send(['test'])

  return nextTick().then(function () {
    expect(test.serverSent).toEqual([
      ['error', 'Wrong credentials', 'auth']
    ])
    expect(test.server.testMessage).not.toBeCalled()
    expect(test.server.connected).toBeFalsy()
  })
})

it('denies access to wrong server', function () {
  var test = createTest()
  test.client.options = {
    auth: function () {
      return Promise.resolve(false)
    }
  }

  test.client.connection.connect()

  return nextTick().then(function () {
    expect(test.clientSent).toEqual([
      ['connect', test.client.protocol, 'client', 0],
      ['error', 'Wrong credentials', 'auth']
    ])
    expect(test.client.connected).toBeFalsy()
  })
})

it('allows access for right users', function () {
  var test = createTest()
  test.client.options = { credentials: 'a' }
  test.server.testMessage = jest.fn()
  test.server.options = {
    auth: function (credentials, host) {
      return Promise.resolve(credentials === 'a' && host === 'client')
    }
  }

  test.client.connection.connect()
  test.client.send(['test'])

  return nextTick().then(function () {
    expect(test.serverSent).toEqual([
      ['connected', test.server.protocol, 'server', [1, 2]]
    ])
    expect(test.server.testMessage).toBeCalled()
  })
})

it('has default timeFix', function () {
  var test = createTest()
  test.client.connection.connect()
  expect(test.client.timeFix).toEqual(0)
})

it('calculates time difference', function () {
  var test = createTest()
  var times1 = [10000, 10000 + 1000 + 100]
  test.client.log = new Log({
    store: new MemoryStore(),
    timer: function () {
      return [times1.shift()]
    }
  })
  var times2 = [0 + 50, 0 + 50 + 1000]
  test.server.log = new Log({
    store: new MemoryStore(),
    timer: function () {
      return [times2.shift()]
    }
  })

  test.client.options.fixTime = true
  test.client.connection.connect()

  expect(test.client.timeFix).toEqual(10000)
})

it('uses timeout between connect and connected', function () {
  jest.useFakeTimers()

  var log = new Log({ store: new MemoryStore(), timer: createTestTimer() })
  var pair = new LocalPair()
  var client = new ClientSync('client', log, pair.left, { timeout: 1000 })

  var error
  client.catch(function (err) {
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
  test.client.catch(function (err) {
    error = err
  })
  test.client.options.timeout = 1000
  test.client.connection.connect()

  jest.runOnlyPendingTimers()
  expect(error).toBeUndefined()
})
