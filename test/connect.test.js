var TestTime = require('logux-core').TestTime

var BaseSync = require('../base-sync')
var ClientSync = require('../client-sync')
var ServerSync = require('../server-sync')
var LocalPair = require('../local-pair')
var SyncError = require('../sync-error')

function createTest () {
  var log = TestTime.getLog()
  var pair = new LocalPair()
  var client = new ClientSync('client', log, pair.left)
  var server = new ServerSync('server', log, pair.right)

  var time = 0
  client.now = function () {
    time += 1
    return time
  }
  server.now = client.now

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

function createBaseSyncTest () {
  var log = new Log({ store: new MemoryStore(), timer: createTestTimer() })
  var pair = new LocalPair()
  var leftSync = new BaseSync('left', log, pair.left)

  var leftSent = []
  pair.right.on('message', function (msg) {
    leftSent.push(msg)
  })
  var rightSent = []
  pair.left.on('message', function (msg) {
    rightSent.push(msg)
  })

  return {
    leftSent: leftSent,
    rightSent: rightSent,
    leftSync: leftSync
  }
}

function wait (ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms)
  })
}

it('sends protocol version and name in connect message', function () {
  var test = createTest()
  test.client.connection.connect()
  return wait(1).then(function () {
    expect(test.clientSent).toEqual([
      ['connect', test.client.protocol, 'client', 0]
    ])
  })
})

it('answers with protocol version and name in connected message', function () {
  var test = createTest()
  test.client.connection.connect()
  return wait(1).then(function () {
    expect(test.serverSent).toEqual([
      ['connected', test.server.protocol, 'server', [2, 3]]
    ])
  })
})

it('checks protocol version', function () {
  var test = createTest()
  test.client.protocol = [2, 0]
  test.server.protocol = [1, 0]

  test.client.connection.connect()
  return wait(1).then(function () {
    expect(test.serverSent).toEqual([
      ['error', 'wrong-protocol', { supported: [1], used: [2, 0] }]
    ])
    expect(test.client.connected).toBeFalsy()
  })
})

it('checks param types on connect message', function () {
  var test = createBaseSyncTest()
  var protocol = test.leftSync.protocol
  var right = test.leftSync.connection.other()

  right.connect()
  right.send(['connect', protocol])
  expect(right.connected).toBeFalsy()

  right.connect()
  right.send(['connect', protocol, 1, 1])
  expect(right.connected).toBeFalsy()

  right.connect()
  right.send(['connect', protocol, 'client', 'abc'])
  expect(right.connected).toBeFalsy()

  right.connect()
  right.send(['connect', protocol, 'client', 1, []])
  expect(right.connected).toBeFalsy()

  expect(test.leftSent).toEqual([
    ['error', 'wrong-format', '["connect",[0,1]]'],
    ['error', 'wrong-format', '["connect",[0,1],1,1]'],
    ['error', 'wrong-format', '["connect",[0,1],"client","abc"]'],
    ['error', 'wrong-format', '["connect",[0,1],"client",1,[]]']
  ])
})

it('checks param types on connected message', function () {
  var test = createBaseSyncTest()
  var left = test.leftSync.connection
  var right = left.other()
  var protocol = test.leftSync.protocol

  left.connect()
  left.send(['connect', protocol, 'left', 0])
  right.send(['connected', protocol, 'right'])
  expect(right.connected).toBeFalsy()

  left.connect()
  left.send(['connect', protocol, 'left', 0])
  right.send(['connected', protocol, 1, [0, 0]])
  expect(right.connected).toBeFalsy()

  left.connect()
  left.send(['connect', protocol, 'left', 0])
  right.send(['connected', protocol, 'right', [0, 'abc']])
  expect(right.connected).toBeFalsy()

  left.connect()
  left.send(['connect', protocol, 'left', 0])
  right.send(['connected', protocol, 'right', [0, 1], 'abc'])
  expect(right.connected).toBeFalsy()

  expect(test.leftSent).toEqual([
    ['connect', protocol, 'left', 0],
    ['error', 'wrong-format', '["connected",[0,1],"right"]'],
    ['connect', protocol, 'left', 0],
    ['error', 'wrong-format', '["connected",[0,1],1,[0,0]]'],
    ['connect', protocol, 'left', 0],
    ['error', 'wrong-format', '["connected",[0,1],"right",[0,"abc"]]'],
    ['connect', protocol, 'left', 0],
    ['error', 'wrong-format', '["connected",[0,1],"right",[0,1],"abc"]']
  ])
})

it('saves other node name', function () {
  var test = createTest()
  test.client.connection.connect()
  return wait(1).then(function () {
    expect(test.client.otherNodeId).toEqual('server')
    expect(test.server.otherNodeId).toEqual('client')
  })
})

it('saves other client protocol', function () {
  var test = createTest()
  test.client.protocol = [1, 0]
  test.server.protocol = [1, 1]

  test.client.connection.connect()
  return wait(1).then(function () {
    expect(test.client.otherProtocol).toEqual([1, 1])
    expect(test.server.otherProtocol).toEqual([1, 0])
  })
})

it('saves other client subprotocol', function () {
  var test = createTest()
  test.client.options.subprotocol = '1.0.0'
  test.server.options.subprotocol = '1.1.0'

  test.client.connection.connect()
  return wait(1).then(function () {
    expect(test.client.otherSubprotocol).toEqual('1.1.0')
    expect(test.server.otherSubprotocol).toEqual('1.0.0')
  })
})

it('has default subprotocol', function () {
  var test = createTest()
  test.client.connection.connect()
  return wait(1).then(function () {
    expect(test.server.otherSubprotocol).toEqual('0.0.0')
  })
})

it('checks subprotocol version', function () {
  var test = createTest()
  test.client.options.subprotocol = '1.0.0'
  test.server.on('connect', function () {
    throw new SyncError(test.server, 'wrong-subprotocol', {
      supported: '2.x',
      used: test.server.otherSubprotocol
    })
  })

  test.client.connection.connect()
  return wait(1).then(function () {
    expect(test.serverSent).toEqual([
      ['error', 'wrong-subprotocol', { supported: '2.x', used: '1.0.0' }]
    ])
    expect(test.client.connected).toBeFalsy()
  })
})

it('checks subprotocol version in client', function () {
  var test = createTest()
  test.server.options.subprotocol = '1.0.0'
  test.client.on('connect', function () {
    throw new SyncError(test.client, 'wrong-subprotocol', {
      supported: '2.x',
      used: test.client.otherSubprotocol
    })
  })

  test.client.connection.connect()
  return wait(1).then(function () {
    expect(test.clientSent[0]).toEqual(
      ['error', 'wrong-subprotocol', { supported: '2.x', used: '1.0.0' }])
    expect(test.client.connected).toBeFalsy()
  })
})

it('throws regular errors during connect event', function () {
  var test = createTest()

  var error = new Error('test')
  test.server.on('connect', function () {
    throw error
  })

  expect(function () {
    test.server.connectMessage(test.client.protocol, 'client', 0)
  }).toThrow(error)
})

it('sends credentials in connect', function () {
  var test = createTest()
  test.client.options = { credentials: { a: 1 } }

  test.client.connection.connect()
  return wait(1).then(function () {
    expect(test.clientSent).toEqual([
      ['connect', test.client.protocol, 'client', 0, { credentials: { a: 1 } }]
    ])
  })
})

it('sends credentials in connected', function () {
  var test = createTest()
  test.server.options = { credentials: 1 }

  test.client.connection.connect()
  return wait(1).then(function () {
    expect(test.serverSent).toEqual([
      ['connected', test.server.protocol, 'server', [2, 3], { credentials: 1 }]
    ])
  })
})

it('sends error on messages before auth', function () {
  var test = createTest()
  test.client.destroy()
  test.server.testMessage = function () { }

  test.client.connection.connect()
  test.client.connection.send(['test'])

  expect(test.serverSent).toEqual([
    ['error', 'missed-auth', '["test"]']
  ])
})

it('denies access for wrong users', function () {
  var test = createTest()
  test.server.options = {
    auth: function () {
      return Promise.resolve(false)
    }
  }

  test.client.connection.connect()
  return wait(1).then(function () {
    expect(test.serverSent).toEqual([
      ['error', 'wrong-credentials']
    ])
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
  return wait(1).then(function () {
    expect(test.clientSent).toEqual([
      ['connect', test.client.protocol, 'client', 0],
      ['error', 'wrong-credentials']
    ])
    expect(test.client.connected).toBeFalsy()
  })
})

it('allows access for right users', function () {
  var test = createTest()
  test.client.options = { credentials: 'a' }
  test.server.testMessage = jest.fn()
  test.server.options = {
    auth: function (credentials, nodeId) {
      return wait(10).then(function () {
        return credentials === 'a' && nodeId === 'client'
      })
    }
  }

  test.client.connection.connect()
  return wait(1).then(function () {
    test.client.send(['test'])
    return wait(10)
  }).then(function () {
    expect(test.serverSent).toEqual([
      ['connected', test.server.protocol, 'server', [1, 2]]
    ])
    expect(test.server.testMessage).toBeCalled()
  })
})

it('has default timeFix', function () {
  var test = createTest()
  test.client.connection.connect()
  return wait(1).then(function () {
    expect(test.client.timeFix).toEqual(0)
  })
})

it('calculates time difference', function () {
  var test = createTest()
  var clientTime = [10000, 10000 + 1000 + 100 + 1]
  test.client.now = function () {
    return clientTime.shift()
  }
  var serverTime = [0 + 50, 0 + 50 + 1000]
  test.server.now = function () {
    return serverTime.shift()
  }

  test.client.options.fixTime = true
  test.client.connection.connect()
  return wait(1).then(function () {
    expect(test.client.timeFix).toEqual(10000)
  })
})

it('uses timeout between connect and connected', function () {
  var log = TestTime.getLog()
  var pair = new LocalPair()
  var client = new ClientSync('client', log, pair.left, { timeout: 100 })

  var error
  client.catch(function (err) {
    error = err
  })

  pair.left.connect()
  return wait(110).then(function () {
    expect(error.name).toEqual('SyncError')
    expect(error.message).not.toContain('received')
    expect(error.message).toContain('timeout')
  })
})

it('connects with timeout', function () {
  var test = createTest()
  test.client.options.timeout = 100

  var error
  test.client.catch(function (err) {
    error = err
  })

  test.client.connection.connect()
  return wait(110).then(function () {
    expect(error).toBeUndefined()
  })
})
