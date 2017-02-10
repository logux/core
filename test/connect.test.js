var TestTime = require('logux-core').TestTime

var TestPair = require('../test-pair')
var BaseSync = require('../base-sync')
var SyncError = require('../sync-error')
var ClientSync = require('../client-sync')
var ServerSync = require('../server-sync')

var PROTOCOL = BaseSync.prototype.localProtocol

function createTest () {
  var time = new TestTime()
  var test = new TestPair()
  test.leftSync = new ClientSync('client', time.nextLog(), test.left)
  test.rightSync = new ServerSync('server', time.nextLog(), test.right)

  var current = 0
  test.leftSync.now = function () {
    current += 1
    return current
  }
  test.rightSync.now = test.leftSync.now

  test.leftSync.catch(function () { })
  test.rightSync.catch(function () { })

  return test
}

function wait (ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms)
  })
}

it('sends protocol version and name in connect message', function () {
  var test = createTest()
  return test.left.connect().then(function () {
    return test.wait()
  }).then(function () {
    expect(test.leftSent).toEqual([
      ['connect', PROTOCOL, 'client', 0]
    ])
  })
})

it('answers with protocol version and name in connected message', function () {
  var test = createTest()
  return test.left.connect().then(function () {
    return test.wait('left')
  }).then(function () {
    expect(test.rightSent).toEqual([
      ['connected', PROTOCOL, 'server', [2, 3]]
    ])
  })
})

it('checks protocol version', function () {
  var test = createTest()
  test.leftSync.localProtocol = [2, 0]
  test.rightSync.localProtocol = [1, 0]

  return test.left.connect().then(function () {
    return test.wait('left')
  }).then(function () {
    expect(test.rightSent).toEqual([
      ['error', 'wrong-protocol', { supported: [1], used: [2, 0] }]
    ])
    expect(test.rightSync.connected).toBeFalsy()
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
    var sync = new BaseSync('client', log, pair.left)
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
  var test = createTest()
  test.left.connect()
  return test.leftSync.waitFor('synchronized').then(function () {
    expect(test.leftSync.remoteNodeId).toEqual('server')
    expect(test.rightSync.remoteNodeId).toEqual('client')
  })
})

it('supports number in node ID', function () {
  var test = createTest()
  test.leftSync.localNodeId = 1
  test.left.connect()
  return test.leftSync.waitFor('synchronized').then(function () {
    expect(test.rightSync.remoteNodeId).toEqual(1)
  })
})

it('saves other client protocol', function () {
  var test = createTest()
  test.leftSync.localProtocol = [1, 0]
  test.rightSync.localProtocol = [1, 1]

  test.left.connect()
  return test.leftSync.waitFor('synchronized').then(function () {
    expect(test.leftSync.remoteProtocol).toEqual([1, 1])
    expect(test.rightSync.remoteProtocol).toEqual([1, 0])
  })
})

it('saves other client subprotocol', function () {
  var test = createTest()
  test.leftSync.options.subprotocol = '1.0.0'
  test.rightSync.options.subprotocol = '1.1.0'

  test.left.connect()
  return test.leftSync.waitFor('synchronized').then(function () {
    expect(test.leftSync.remoteSubprotocol).toEqual('1.1.0')
    expect(test.rightSync.remoteSubprotocol).toEqual('1.0.0')
  })
})

it('has default subprotocol', function () {
  var test = createTest()
  test.left.connect()
  return test.leftSync.waitFor('synchronized').then(function () {
    expect(test.rightSync.remoteSubprotocol).toEqual('0.0.0')
  })
})

it('checks subprotocol version', function () {
  var test = createTest()
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
  var test = createTest()
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
      ['connect', [0, 1], 'client', 0],
      ['error', 'wrong-subprotocol', { supported: '2.x', used: '1.0.0' }]
    ])
    expect(test.leftSync.connected).toBeFalsy()
  })
})

it('throws regular errors during connect event', function () {
  var test = createTest()

  var error = new Error('test')
  test.rightSync.on('connect', function () {
    throw error
  })

  expect(function () {
    test.rightSync.connectMessage(PROTOCOL, 'client', 0)
  }).toThrow(error)
})

it('sends credentials in connect', function () {
  var test = createTest()
  test.leftSync.options = { credentials: { a: 1 } }

  test.left.connect()
  return test.leftSync.waitFor('synchronized').then(function () {
    expect(test.leftSent).toEqual([
      ['connect', PROTOCOL, 'client', 0, { credentials: { a: 1 } }]
    ])
  })
})

it('sends credentials in connected', function () {
  var test = createTest()
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
  var test = new TestPair()
  test.leftSync = new BaseSync('client', log, test.left)
  test.rightSync = new ServerSync('server', log, test.right)

  test.rightSync.testMessage = function () { }

  return test.left.connect().then(function () {
    test.left.send(['test'])
    return test.wait('left')
  }).then(function () {
    expect(test.rightSent).toEqual([
      ['error', 'missed-auth', '["test"]']
    ])
  })
})

it('denies access for wrong users', function () {
  var test = createTest()
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
  var test = createTest()
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
  var test = createTest()
  test.leftSync.options = { credentials: 'a' }
  test.rightSync.options = {
    auth: function (credentials, nodeId) {
      return wait(10).then(function () {
        return credentials === 'a' && nodeId === 'client'
      })
    }
  }

  return test.left.connect().then(function () {
    test.leftSync.sendDuilian()
    return test.wait('left')
  }).then(function () {
    expect(test.rightSent).toEqual([
      ['connected', PROTOCOL, 'server', [1, 2]],
      ['duilian', '人情練達即文章']
    ])
  })
})

it('has default timeFix', function () {
  var test = createTest()
  test.left.connect()
  return test.leftSync.waitFor('synchronized').then(function () {
    expect(test.leftSync.timeFix).toEqual(0)
  })
})

it('calculates time difference', function () {
  var test = createTest()
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
    return wait(101)
  }).then(function () {
    expect(error.name).toEqual('SyncError')
    expect(error.message).not.toContain('received')
    expect(error.message).toContain('timeout')
  })
})
