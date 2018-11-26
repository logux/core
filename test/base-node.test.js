var NanoEvents = require('nanoevents')
var delay = require('nanodelay')

var TestTime = require('../test-time')
var TestPair = require('../test-pair')
var BaseNode = require('../base-node')

function createNode (opts) {
  var pair = new TestPair()
  var log = TestTime.getLog()
  log.on('preadd', function (action, meta) {
    meta.reasons = ['test']
  })
  return new BaseNode('client', log, pair.left, opts)
}

function createTest () {
  var node = createNode()
  var test = node.connection.pair
  test.leftNode = node
  return test.left.connect().then(function () {
    return test
  })
}

function listeners (emitter) {
  return Object.keys(emitter.events).map(function (i) {
    return emitter.events[i].length
  }).reduce(function (all, i) {
    return all + i
  }, 0)
}

it('saves all arguments', function () {
  var log = TestTime.getLog()
  var connection = new NanoEvents()
  var node = new BaseNode('client', log, connection, { a: 1 })

  expect(node.localNodeId).toEqual('client')
  expect(node.log).toBe(log)
  expect(node.connection).toBe(connection)
  expect(node.options).toEqual({ a: 1 })
})

it('allows to miss options', function () {
  var node = createNode()
  expect(node.options).toEqual({ })
})

it('has protocol version', function () {
  var node = createNode()
  expect(typeof node.localProtocol).toEqual('number')
  expect(typeof node.minProtocol).toEqual('number')
  expect(node.localProtocol).toBeGreaterThanOrEqual(node.minProtocol)
})

it('unbind all listeners on destroy', function () {
  var node = new BaseNode('client', TestTime.getLog(), new NanoEvents())

  expect(listeners(node.log.emitter)).toBeGreaterThan(0)
  expect(listeners(node.connection)).toBeGreaterThan(0)

  node.destroy()
  expect(listeners(node.log.emitter)).toEqual(0)
  expect(listeners(node.connection)).toEqual(0)
})

it('destroys connection on destroy', function () {
  var node = createNode()
  node.connection.destroy = function () { }
  jest.spyOn(node.connection, 'disconnect')
  jest.spyOn(node.connection, 'destroy')

  node.destroy()
  expect(node.connection.disconnect).not.toBeCalledWith('destroy')
  expect(node.connection.destroy).toBeCalled()
})

it('disconnects on destroy', function () {
  var node = createNode()
  return node.connection.connect().then(function () {
    node.destroy()
    expect(node.connection.connected).toBeFalsy()
  })
})

it('does not throw error on send to disconnected connection', function () {
  var node = createNode()
  expect(function () {
    node.sendDuilian()
  }).not.toThrow()
})

it('sends messages to connection', function () {
  return createTest().then(function (test) {
    test.leftNode.send(['test'])
    return test.wait()
  }).then(function (test) {
    expect(test.leftSent).toEqual([['test']])
  })
})

it('has connection state', function () {
  var node = createNode()
  expect(node.connected).toBeFalsy()
  return node.connection.connect().then(function () {
    expect(node.connected).toBeTruthy()
    node.connection.disconnect()
    expect(node.connected).toBeFalsy()
  })
})

it('has state', function () {
  var node = createNode()
  var pair = node.connection.pair

  var states = []
  node.on('state', function () {
    states.push(node.state)
  })

  expect(node.state).toEqual('disconnected')
  return node.connection.connect().then(function () {
    node.sendConnect()
    pair.right.send(['connected', node.localProtocol, 'server', [0, 0]])
    return node.waitFor('synchronized')
  }).then(function () {
    expect(node.state).toEqual('synchronized')
    return node.log.add({ type: 'a' })
  }).then(function () {
    expect(node.state).toEqual('sending')
    pair.right.send(['synced', 1])
    return node.waitFor('synchronized')
  }).then(function () {
    expect(node.state).toEqual('synchronized')
    node.connection.disconnect()
    expect(node.state).toEqual('disconnected')
    return node.log.add({ type: 'b' })
  }).then(function () {
    expect(node.state).toEqual('disconnected')
    node.connection.emitter.emit('connecting')
    expect(node.state).toEqual('connecting')
    return node.connection.connect()
  }).then(function () {
    node.sendConnect()
    pair.right.send(['connected', node.localProtocol, 'server', [0, 0]])
    return node.waitFor('sending')
  }).then(function () {
    expect(node.state).toEqual('sending')
    pair.right.send(['synced', 2])
    return node.waitFor('synchronized')
  }).then(function () {
    expect(node.state).toEqual('synchronized')
    return node.log.add({ type: 'c' })
  }).then(function () {
    node.connection.disconnect()
    expect(states).toEqual([
      'connecting',
      'synchronized',
      'sending',
      'synchronized',
      'disconnected',
      'connecting',
      'sending',
      'synchronized',
      'sending',
      'disconnected'
    ])
  })
})

it('does not wait for state change is current state is correct', function () {
  return createNode().waitFor('disconnected')
})

it('loads lastSent, lastReceived and lastAdded from store', function () {
  var log = TestTime.getLog()
  var con = new NanoEvents()
  var node

  log.store.setLastSynced({ sent: 1, received: 2 })
  return log.add({ type: 'a' }, { reasons: ['test'] }).then(function () {
    node = new BaseNode('client', log, con)
    return node.initializing
  }).then(function () {
    expect(node.lastAddedCache).toBe(1)
    expect(node.lastSent).toBe(1)
    expect(node.lastReceived).toBe(2)
  })
})

it('has separated timeouts', function () {
  var node = createNode({ timeout: 100 })

  var error
  node.catch(function (e) {
    error = e
  })

  node.startTimeout()
  return delay(60).then(function () {
    node.startTimeout()
    return delay(60)
  }).then(function () {
    expect(error.message).toContain('timeout')
  })
})

it('stops timeouts on disconnect', function () {
  var node = createNode({ timeout: 10 })

  var error
  node.catch(function (e) {
    error = e
  })

  node.startTimeout()
  node.startTimeout()
  node.onDisconnect()

  return delay(50).then(function () {
    node.startTimeout()
    expect(error).toBeUndefined()
  })
})

it('accepts already connected connection', function () {
  var pair = new TestPair()
  var node
  return pair.left.connect().then(function () {
    node = new BaseNode('client', TestTime.getLog(), pair.left)
    return node.initializing
  }).then(function () {
    expect(node.connected).toBeTruthy()
  })
})

it('receives errors from connection', function () {
  return createTest().then(function (test) {
    var emitted
    test.leftNode.catch(function (e) {
      emitted = e
    })

    var error = new Error('test')
    test.left.emitter.emit('error', error)

    expect(test.leftNode.connected).toBeFalsy()
    expect(test.leftEvents).toEqual([
      ['connect'],
      ['disconnect', 'error']
    ])
    expect(emitted).toEqual(error)
  })
})

it('does not fall on sync without connection', function () {
  return createNode().syncSince(0)
})

it('receives format errors from connection', function () {
  return createTest().then(function (test) {
    var error = new Error('Wrong message format')
    error.received = 'options'
    test.left.emitter.emit('error', error)
    return test.wait()
  }).then(function (test) {
    expect(test.leftNode.connected).toBeFalsy()
    expect(test.leftEvents).toEqual([
      ['connect'],
      ['disconnect', 'error']
    ])
    expect(test.leftSent).toEqual([
      ['error', 'wrong-format', 'options']
    ])
  })
})

it('throws error by default', function () {
  var error = new Error('test')
  return createTest().then(function (test) {
    test.leftNode.connection.send = function () {
      throw error
    }
    expect(function () {
      test.leftNode.send(['ping', 0])
    }).toThrow(error)
  })
})

it('disconnect on the error during send', function () {
  var error = new Error('test')
  var errors = []
  return createTest().then(function (test) {
    test.leftNode.catch(function (e) {
      errors.push(e)
    })
    test.leftNode.connection.send = function () {
      throw error
    }
    test.leftNode.send(['ping', 0])
    return delay(1, test)
  }).then(function (test) {
    expect(test.leftNode.connected).toBeFalsy()
    expect(errors).toEqual([error])
  })
})
