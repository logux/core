var NanoEvents = require('nanoevents')
var TestTime = require('logux-core').TestTime

var TestPair = require('../test-pair')
var BaseSync = require('../base-sync')

function createSync (opts) {
  var pair = new TestPair()
  return new BaseSync('client', TestTime.getLog(), pair.left, opts)
}

function createTest () {
  var test = new TestPair()
  test.leftSync = new BaseSync('client', TestTime.getLog(), test.left)
  return test.left.connect().then(function () {
    return test
  })
}

function wait (ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms)
  })
}

it('saves all arguments', function () {
  var log = TestTime.getLog()
  var connection = new NanoEvents()
  var sync = new BaseSync('client', log, connection, { a: 1 })

  expect(sync.nodeId).toEqual('client')
  expect(sync.log).toBe(log)
  expect(sync.connection).toBe(connection)
  expect(sync.options).toEqual({ a: 1 })
})

it('allows to miss options', function () {
  var sync = createSync()
  expect(sync.options).toEqual({ })
})

it('has protocol version', function () {
  var sync = createSync()
  expect(sync.protocol.length).toBe(2)
  sync.protocol.forEach(function (part) {
    expect(typeof part).toEqual('number')
  })
})

it('unbind all listeners on destroy', function () {
  var sync = new BaseSync('client', TestTime.getLog(), new NanoEvents())

  expect(Object.keys(sync.log.emitter.events)).toEqual(['add'])
  expect(Object.keys(sync.connection.events).sort())
    .toEqual(['connect', 'connecting', 'disconnect', 'error', 'message'])

  sync.destroy()
  expect(Object.keys(sync.log.emitter.events)).toEqual([])
  expect(Object.keys(sync.connection.events)).toEqual([])
})

it('destroys connection on destroy', function () {
  var sync = createSync()
  sync.connection.disconnect = jest.fn()
  sync.connection.destroy = jest.fn()

  sync.destroy()
  expect(sync.connection.disconnect).not.toBeCalled()
  expect(sync.connection.destroy).toBeCalled()
})

it('disconnects on destroy', function () {
  var sync = createSync()
  return sync.connection.connect().then(function () {
    sync.destroy()
    expect(sync.connection.connected).toBeFalsy()
  })
})

it('throws a error on send to disconnected connection', function () {
  var sync = createSync()
  expect(function () {
    sync.send(['test'])
  }).toThrowError(/disconnected/)
})

it('sends messages to connection', function () {
  return createTest().then(function (test) {
    test.leftSync.send(['test'])
    return test.wait()
  }).then(function (test) {
    expect(test.leftSent).toEqual([['test']])
  })
})

it('has connection state', function () {
  var sync = createSync()
  expect(sync.connected).toBeFalsy()
  return sync.connection.connect().then(function () {
    expect(sync.connected).toBeTruthy()
    sync.connection.disconnect()
    expect(sync.connected).toBeFalsy()
  })
})

it('supports one-time events', function () {
  var sync = createSync()

  var states = []
  sync.once('state', function () {
    states.push(sync.state)
  })

  sync.setState('sending')
  sync.setState('synchronized')

  expect(states).toEqual(['sending'])
})

it('calls message method', function () {
  var calls = []
  return createTest().then(function (test) {
    test.leftSync.authenticated = true
    test.leftSync.testMessage = function (a, b) {
      calls.push([a, b])
    }
    test.right.send(['test', 1, 2])
    return test.wait()
  }).then(function () {
    expect(calls).toEqual([[1, 2]])
  })
})

it('sets wait state on creating', function () {
  var log = TestTime.getLog()
  var sync
  return log.add({ type: 'a' }).then(function () {
    var pair = new TestPair()
    sync = new BaseSync('client', log, pair.left)
    return sync.initializing
  }).then(function () {
    expect(sync.state).toEqual('wait')
  })
})

it('has state', function () {
  var sync = createSync()
  var pair = sync.connection.pair

  var states = []
  sync.on('state', function () {
    states.push(sync.state)
  })

  expect(sync.state).toEqual('disconnected')
  return sync.connection.connect().then(function () {
    sync.sendConnect()
    pair.right.send(['connected', sync.protocol, 'server', [0, 0]])
    return sync.waitFor('synchronized')
  }).then(function () {
    expect(sync.state).toEqual('synchronized')
    return sync.log.add({ type: 'a' })
  }).then(function () {
    expect(sync.state).toEqual('sending')
    pair.right.send(['synced', 1])
    return sync.waitFor('synchronized')
  }).then(function () {
    expect(sync.state).toEqual('synchronized')
    sync.connection.disconnect()
    expect(sync.state).toEqual('disconnected')
    return sync.log.add({ type: 'b' })
  }).then(function () {
    expect(sync.state).toEqual('wait')
    sync.connection.emitter.emit('connecting')
    expect(sync.state).toEqual('connecting')
    return sync.connection.connect()
  }).then(function () {
    sync.sendConnect()
    pair.right.send(['connected', sync.protocol, 'server', [0, 0]])
    return sync.waitFor('sending')
  }).then(function () {
    expect(sync.state).toEqual('sending')
    pair.right.send(['synced', 2])
    return sync.waitFor('synchronized')
  }).then(function () {
    expect(sync.state).toEqual('synchronized')
    return sync.log.add({ type: 'c' })
  }).then(function () {
    sync.connection.disconnect()
    expect(states).toEqual([
      'synchronized',
      'sending',
      'synchronized',
      'disconnected',
      'wait',
      'connecting',
      'sending',
      'synchronized',
      'sending',
      'wait'
    ])
  })
})

it('loads synced, otherSynced and last added from store', function () {
  var log = TestTime.getLog()
  var con = new NanoEvents()
  var sync

  log.store.setLastSynced({ sent: 1, received: 2 })
  return log.add({ type: 'a' }).then(function () {
    sync = new BaseSync('client', log, con)
    return sync.initializing
  }).then(function () {
    expect(sync.lastAddedCache).toBe(1)
    expect(sync.synced).toBe(1)
    expect(sync.otherSynced).toBe(2)
  })
})

it('has separated timeouts', function () {
  var sync = createSync({ timeout: 100 })

  var error
  sync.catch(function (e) {
    error = e
  })

  sync.startTimeout()
  return wait(60).then(function () {
    sync.startTimeout()
    return wait(60)
  }).then(function () {
    expect(error.message).toContain('timeout')
  })
})

it('accepts already connected connection', function () {
  var pair = new TestPair()
  var sync
  return pair.left.connect().then(function () {
    sync = new BaseSync('client', TestTime.getLog(), pair.left)
    return sync.initializing
  }).then(function () {
    expect(sync.connected).toBeTruthy()
  })
})

it('receives errors from connection', function () {
  return createTest().then(function (test) {
    var emitted
    test.leftSync.catch(function (e) {
      emitted = e
    })

    var error = new Error('test')
    test.left.emitter.emit('error', error)

    expect(test.leftSync.connected).toBeFalsy()
    expect(emitted).toEqual(error)
  })
})

it('receives format errors from connection', function () {
  return createTest().then(function (test) {
    var error = new Error('Wrong message format')
    error.received = 'options'
    test.left.emitter.emit('error', error)
    return test.wait()
  }).then(function (test) {
    expect(test.leftSync.connected).toBeFalsy()
    expect(test.leftSent).toEqual([
      ['error', 'wrong-format', 'options']
    ])
  })
})
