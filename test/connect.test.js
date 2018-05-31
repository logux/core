var TestTime = require('logux-core').TestTime
var delay = require('nanodelay')

var ServerSync = require('../server-sync')
var ClientSync = require('../client-sync')
var SyncError = require('../sync-error')
var TestPair = require('../test-pair')
var BaseSync = require('../base-sync')

var PROTOCOL = BaseSync.prototype.localProtocol

var test

function createTest () {
  var time = new TestTime()
  var pair = new TestPair()

  pair.leftSync = new ClientSync('client', time.nextLog(), pair.left)
  pair.rightSync = new ServerSync('server', time.nextLog(), pair.right)

  var current = 0
  pair.leftSync.now = function () {
    current += 1
    return current
  }
  pair.rightSync.now = pair.leftSync.now

  pair.leftSync.catch(function () { })
  pair.rightSync.catch(function () { })

  return pair
}
afterEach(function () {
  if (test) {
    test.leftSync.destroy()
    test.rightSync.destroy()
    test = undefined
  }
})

it('sends protocol version and name in connect message', function () {
  test = createTest()
  return test.left.connect().then(function () {
    return test.wait()
  }).then(function () {
    expect(test.leftSent).toEqual([
      ['connect', PROTOCOL, 'client', 0]
    ])
  })
})

it('answers with protocol version and name in connected message', function () {
  test = createTest()
  return test.left.connect().then(function () {
    return test.wait('left')
  }).then(function () {
    expect(test.rightSent).toEqual([
      ['connected', PROTOCOL, 'server', [2, 3]]
    ])
  })
})

it('checks client protocol version', function () {
  test = createTest()
  test.leftSync.localProtocol = 1
  test.rightSync.minProtocol = 2

  return test.left.connect().then(function () {
    return test.wait('left')
  }).then(function () {
    expect(test.rightSent).toEqual([
      ['error', 'wrong-protocol', { supported: 2, used: 1 }]
    ])
    expect(test.rightSync.connected).toBeFalsy()
  })
})

it('checks server protocol version', function () {
  test = createTest()
  test.leftSync.minProtocol = 2
  test.rightSync.localProtocol = 1

  return test.left.connect().then(function () {
    return test.wait('left')
  }).then(function () {
    return test.wait('right')
  }).then(function () {
    expect(test.leftSent).toEqual([
      ['connect', PROTOCOL, 'client', 0],
      ['error', 'wrong-protocol', { supported: 2, used: 1 }]
    ])
    expect(test.leftSent.connected).toBeFalsy()
  })
})

it('checks types in connect message', function () {
  var wrongs = [
    ['connect', []],
    ['connect', PROTOCOL, 'client', 0, 'abc'],
    ['connected', []],
    ['connected', PROTOCOL, 'client', [0]]
  ]
  return Promise.all(wrongs.map(function (msg) {
    var log = TestTime.getLog()
    var pair = new TestPair()
    var sync = new ServerSync('server', log, pair.left)
    return pair.left.connect().then(function () {
      pair.right.send(msg)
      return pair.wait('right')
    }).then(function () {
      expect(sync.connected).toBeFalsy()
      expect(pair.leftSent).toEqual([
        ['error', 'wrong-format', JSON.stringify(msg)]
      ])
    })
  }))
})

it('saves other node name', function () {
  test = createTest()
  test.left.connect()
  return test.leftSync.waitFor('synchronized').then(function () {
    expect(test.leftSync.remoteNodeId).toEqual('server')
    expect(test.rightSync.remoteNodeId).toEqual('client')
  })
})

it('saves other client protocol', function () {
  test = createTest()
  test.leftSync.minProtocol = 1
  test.leftSync.localProtocol = 1
  test.rightSync.minProtocol = 1
  test.rightSync.localProtocol = 2

  test.left.connect()
  return test.leftSync.waitFor('synchronized').then(function () {
    expect(test.leftSync.remoteProtocol).toEqual(2)
    expect(test.rightSync.remoteProtocol).toEqual(1)
  })
})

it('saves other client subprotocol', function () {
  test = createTest()
  test.leftSync.options.subprotocol = '1.0.0'
  test.rightSync.options.subprotocol = '1.1.0'

  test.left.connect()
  return test.leftSync.waitFor('synchronized').then(function () {
    expect(test.leftSync.remoteSubprotocol).toEqual('1.1.0')
    expect(test.rightSync.remoteSubprotocol).toEqual('1.0.0')
  })
})

it('has default subprotocol', function () {
  test = createTest()
  test.left.connect()
  return test.leftSync.waitFor('synchronized').then(function () {
    expect(test.rightSync.remoteSubprotocol).toEqual('0.0.0')
  })
})

it('checks subprotocol version', function () {
  test = createTest()
  test.leftSync.options.subprotocol = '1.0.0'
  test.rightSync.on('connect', function () {
    throw new SyncError(test.rightSync, 'wrong-subprotocol', {
      supported: '2.x',
      used: test.rightSync.remoteSubprotocol
    })
  })

  return test.left.connect().then(function () {
    return test.wait('left')
  }).then(function () {
    expect(test.rightSent).toEqual([
      ['error', 'wrong-subprotocol', { supported: '2.x', used: '1.0.0' }]
    ])
    expect(test.rightSync.connected).toBeFalsy()
  })
})

it('checks subprotocol version in client', function () {
  test = createTest()
  test.rightSync.options.subprotocol = '1.0.0'
  test.leftSync.on('connect', function () {
    throw new SyncError(test.leftSync, 'wrong-subprotocol', {
      supported: '2.x',
      used: test.leftSync.remoteSubprotocol
    })
  })

  return test.left.connect().then(function () {
    return test.wait('right')
  }).then(function () {
    return test.wait('right')
  }).then(function () {
    expect(test.leftSent).toEqual([
      ['connect', PROTOCOL, 'client', 0],
      ['error', 'wrong-subprotocol', { supported: '2.x', used: '1.0.0' }]
    ])
    expect(test.leftSync.connected).toBeFalsy()
  })
})

it('throws regular errors during connect event', function () {
  test = createTest()

  var error = new Error('test')
  test.leftSync.on('connect', function () {
    throw error
  })

  expect(function () {
    test.leftSync.connectMessage(PROTOCOL, 'client', 0)
  }).toThrow(error)
})

it('sends credentials in connect', function () {
  test = createTest()
  test.leftSync.options = { credentials: { a: 1 } }

  test.left.connect()
  return test.leftSync.waitFor('synchronized').then(function () {
    expect(test.leftSent).toEqual([
      ['connect', PROTOCOL, 'client', 0, { credentials: { a: 1 } }]
    ])
  })
})

it('sends credentials in connected', function () {
  test = createTest()
  test.rightSync.options = { credentials: 1 }

  test.left.connect()
  return test.leftSync.waitFor('synchronized').then(function () {
    expect(test.rightSent).toEqual([
      ['connected', PROTOCOL, 'server', [2, 3], { credentials: 1 }]
    ])
  })
})

it('sends error on messages before auth', function () {
  var log = TestTime.getLog()
  test = new TestPair()
  test.leftSync = new BaseSync('client', log, test.left)
  test.rightSync = new ServerSync('server', log, test.right)
  test.leftSync.catch(function () { })

  return test.left.connect().then(function () {
    test.leftSync.sendDuilian()
    return test.wait('left')
  }).then(function () {
    expect(test.rightSent).toEqual([
      ['error', 'missed-auth', '["duilian","金木水火土"]']
    ])
  })
})

it('denies access for wrong users', function () {
  test = createTest()
  test.rightSync.options = {
    auth: function () {
      return Promise.resolve(false)
    }
  }

  return test.left.connect().then(function () {
    return test.wait('left')
  }).then(function () {
    expect(test.rightSent).toEqual([
      ['error', 'wrong-credentials']
    ])
    expect(test.rightSync.connected).toBeFalsy()
  })
})

it('denies access to wrong server', function () {
  test = createTest()
  test.leftSync.options = {
    auth: function () {
      return Promise.resolve(false)
    }
  }

  return test.left.connect().then(function () {
    return test.wait('right')
  }).then(function () {
    return test.wait('right')
  }).then(function () {
    expect(test.leftSent).toEqual([
      ['connect', PROTOCOL, 'client', 0],
      ['error', 'wrong-credentials']
    ])
    expect(test.leftSync.connected).toBeFalsy()
  })
})

it('allows access for right users', function () {
  test = createTest()
  test.leftSync.options = { credentials: 'a' }
  test.rightSync.options = {
    auth: function (credentials, nodeId) {
      return delay(10).then(function () {
        return credentials === 'a' && nodeId === 'client'
      })
    }
  }

  return test.left.connect().then(function () {
    test.leftSync.sendDuilian(0)
    return delay(20)
  }).then(function () {
    expect(test.rightSent[0]).toEqual(['connected', PROTOCOL, 'server', [1, 2]])
  })
})

it('has default timeFix', function () {
  test = createTest()
  test.left.connect()
  return test.leftSync.waitFor('synchronized').then(function () {
    expect(test.leftSync.timeFix).toEqual(0)
  })
})

it('calculates time difference', function () {
  test = createTest()
  var clientTime = [10000, 10000 + 1000 + 100 + 1]
  test.leftSync.now = function () {
    return clientTime.shift()
  }
  var serverTime = [0 + 50, 0 + 50 + 1000]
  test.rightSync.now = function () {
    return serverTime.shift()
  }

  test.leftSync.options.fixTime = true
  test.left.connect()
  return test.leftSync.waitFor('synchronized').then(function () {
    expect(test.leftSync.baseTime).toEqual(1050)
    expect(test.rightSync.baseTime).toEqual(1050)
    expect(test.leftSync.timeFix).toEqual(10000)
  })
})

it('uses timeout between connect and connected', function () {
  var log = TestTime.getLog()
  var pair = new TestPair()
  var client = new ClientSync('client', log, pair.left, { timeout: 100 })

  var error
  client.catch(function (err) {
    error = err
  })

  return pair.left.connect().then(function () {
    return delay(101)
  }).then(function () {
    expect(error.name).toEqual('SyncError')
    expect(error.message).not.toContain('received')
    expect(error.message).toContain('timeout')
  })
})
