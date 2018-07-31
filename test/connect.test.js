var delay = require('nanodelay')

var ServerNode = require('../server-node')
var ClientNode = require('../client-node')
var SyncError = require('../sync-error')
var TestTime = require('../test-time')
var TestPair = require('../test-pair')
var BaseNode = require('../base-node')

var PROTOCOL = BaseNode.prototype.localProtocol

var test

function createTest () {
  var time = new TestTime()
  var pair = new TestPair()

  pair.leftNode = new ClientNode('client', time.nextLog(), pair.left)
  pair.rightNode = new ServerNode('server', time.nextLog(), pair.right)

  var current = 0
  pair.leftNode.now = function () {
    current += 1
    return current
  }
  pair.rightNode.now = pair.leftNode.now

  pair.leftNode.catch(function () { })
  pair.rightNode.catch(function () { })

  return pair
}

afterEach(function () {
  if (test) {
    test.leftNode.destroy()
    test.rightNode.destroy()
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
  test.leftNode.localProtocol = 1
  test.rightNode.minProtocol = 2

  return test.left.connect().then(function () {
    return test.wait('left')
  }).then(function () {
    expect(test.rightSent).toEqual([
      ['error', 'wrong-protocol', { supported: 2, used: 1 }]
    ])
    expect(test.rightNode.connected).toBeFalsy()
  })
})

it('checks server protocol version', function () {
  test = createTest()
  test.leftNode.minProtocol = 2
  test.rightNode.localProtocol = 1

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
    var node = new ServerNode('server', log, pair.left)
    return pair.left.connect().then(function () {
      pair.right.send(msg)
      return pair.wait('right')
    }).then(function () {
      expect(node.connected).toBeFalsy()
      expect(pair.leftSent).toEqual([
        ['error', 'wrong-format', JSON.stringify(msg)]
      ])
    })
  }))
})

it('saves other node name', function () {
  test = createTest()
  test.left.connect()
  return test.leftNode.waitFor('synchronized').then(function () {
    expect(test.leftNode.remoteNodeId).toEqual('server')
    expect(test.rightNode.remoteNodeId).toEqual('client')
  })
})

it('saves other client protocol', function () {
  test = createTest()
  test.leftNode.minProtocol = 1
  test.leftNode.localProtocol = 1
  test.rightNode.minProtocol = 1
  test.rightNode.localProtocol = 2

  test.left.connect()
  return test.leftNode.waitFor('synchronized').then(function () {
    expect(test.leftNode.remoteProtocol).toEqual(2)
    expect(test.rightNode.remoteProtocol).toEqual(1)
  })
})

it('saves other client subprotocol', function () {
  test = createTest()
  test.leftNode.options.subprotocol = '1.0.0'
  test.rightNode.options.subprotocol = '1.1.0'

  test.left.connect()
  return test.leftNode.waitFor('synchronized').then(function () {
    expect(test.leftNode.remoteSubprotocol).toEqual('1.1.0')
    expect(test.rightNode.remoteSubprotocol).toEqual('1.0.0')
  })
})

it('has default subprotocol', function () {
  test = createTest()
  test.left.connect()
  return test.leftNode.waitFor('synchronized').then(function () {
    expect(test.rightNode.remoteSubprotocol).toEqual('0.0.0')
  })
})

it('checks subprotocol version', function () {
  test = createTest()
  test.leftNode.options.subprotocol = '1.0.0'
  test.rightNode.on('connect', function () {
    throw new SyncError('wrong-subprotocol', {
      supported: '2.x',
      used: test.rightNode.remoteSubprotocol
    })
  })

  return test.left.connect().then(function () {
    return test.wait('left')
  }).then(function () {
    expect(test.rightSent).toEqual([
      ['error', 'wrong-subprotocol', { supported: '2.x', used: '1.0.0' }]
    ])
    expect(test.rightNode.connected).toBeFalsy()
  })
})

it('checks subprotocol version in client', function () {
  test = createTest()
  test.rightNode.options.subprotocol = '1.0.0'
  test.leftNode.on('connect', function () {
    throw new SyncError('wrong-subprotocol', {
      supported: '2.x',
      used: test.leftNode.remoteSubprotocol
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
    expect(test.leftNode.connected).toBeFalsy()
  })
})

it('throws regular errors during connect event', function () {
  test = createTest()

  var error = new Error('test')
  test.leftNode.on('connect', function () {
    throw error
  })

  expect(function () {
    test.leftNode.connectMessage(PROTOCOL, 'client', 0)
  }).toThrow(error)
})

it('sends credentials in connect', function () {
  test = createTest()
  test.leftNode.options = { credentials: { a: 1 } }

  test.left.connect()
  return test.leftNode.waitFor('synchronized').then(function () {
    expect(test.leftSent).toEqual([
      ['connect', PROTOCOL, 'client', 0, { credentials: { a: 1 } }]
    ])
  })
})

it('sends credentials in connected', function () {
  test = createTest()
  test.rightNode.options = { credentials: 1 }

  test.left.connect()
  return test.leftNode.waitFor('synchronized').then(function () {
    expect(test.rightSent).toEqual([
      ['connected', PROTOCOL, 'server', [2, 3], { credentials: 1 }]
    ])
  })
})

it('sends error on messages before auth', function () {
  var log = TestTime.getLog()
  test = new TestPair()
  test.leftNode = new BaseNode('client', log, test.left)
  test.rightNode = new ServerNode('server', log, test.right)
  test.leftNode.catch(function () { })

  return test.left.connect().then(function () {
    test.leftNode.sendDuilian()
    return test.wait('left')
  }).then(function () {
    expect(test.rightSent).toEqual([
      ['error', 'missed-auth', '["duilian","金木水火土"]']
    ])
  })
})

it('denies access for wrong users', function () {
  test = createTest()
  test.rightNode.options = {
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
    expect(test.rightNode.connected).toBeFalsy()
  })
})

it('denies access to wrong server', function () {
  test = createTest()
  test.leftNode.options = {
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
    expect(test.leftNode.connected).toBeFalsy()
  })
})

it('allows access for right users', function () {
  test = createTest()
  test.leftNode.options = { credentials: 'a' }
  test.rightNode.options = {
    auth: function (credentials, nodeId) {
      return delay(10).then(function () {
        return credentials === 'a' && nodeId === 'client'
      })
    }
  }

  return test.left.connect().then(function () {
    test.leftNode.sendDuilian(0)
    return delay(50)
  }).then(function () {
    expect(test.rightSent[0]).toEqual(['connected', PROTOCOL, 'server', [1, 2]])
  })
})

it('has default timeFix', function () {
  test = createTest()
  test.left.connect()
  return test.leftNode.waitFor('synchronized').then(function () {
    expect(test.leftNode.timeFix).toEqual(0)
  })
})

it('calculates time difference', function () {
  test = createTest()
  var clientTime = [10000, 10000 + 1000 + 100 + 1]
  test.leftNode.now = function () {
    return clientTime.shift()
  }
  var serverTime = [0 + 50, 0 + 50 + 1000]
  test.rightNode.now = function () {
    return serverTime.shift()
  }

  test.leftNode.options.fixTime = true
  test.left.connect()
  return test.leftNode.waitFor('synchronized').then(function () {
    expect(test.leftNode.baseTime).toEqual(1050)
    expect(test.rightNode.baseTime).toEqual(1050)
    expect(test.leftNode.timeFix).toEqual(10000)
  })
})

it('uses timeout between connect and connected', function () {
  var log = TestTime.getLog()
  var pair = new TestPair()
  var client = new ClientNode('client', log, pair.left, { timeout: 100 })

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

it('catches authentication errors', function () {
  test = createTest()
  var errors = []
  test.rightNode.catch(function (e) {
    errors.push(e)
  })

  var error = new Error()
  test.rightNode.options = {
    auth: function () {
      return Promise.reject(error)
    }
  }

  return test.left.connect().then(function () {
    return test.wait('right')
  }).then(function () {
    return delay(1)
  }).then(function () {
    expect(errors).toEqual([error])
    expect(test.rightSent).toEqual([])
    expect(test.rightNode.connected).toBeFalsy()
  })
})

it('sends authentication errors', function () {
  test = createTest()
  test.rightNode.options = {
    auth: function () {
      return Promise.reject(new SyncError('bruteforce'))
    }
  }

  return test.left.connect().then(function () {
    return test.wait('right')
  }).then(function () {
    return test.wait('left')
  }).then(function () {
    expect(test.rightSent).toEqual([['error', 'bruteforce']])
    expect(test.rightNode.connected).toBeFalsy()
  })
})
