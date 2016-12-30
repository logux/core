var createTestTimer = require('logux-core').createTestTimer
var MemoryStore = require('logux-core').MemoryStore
var Log = require('logux-core').Log

var LocalPair = require('../local-pair')
var BaseSync = require('../base-sync')

function createSync () {
  var log = new Log({ store: new MemoryStore(), timer: createTestTimer() })
  var pair = new LocalPair()
  return new BaseSync('client', log, pair.left)
}

function wait (ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms)
  })
}

it('saves all arguments', function () {
  var log = { on: function () { } }
  var connection = { on: function () { } }
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
  var sync = createSync()
  expect(Object.keys(sync.log.emitter.events)).toEqual(['event'])
  expect(Object.keys(sync.connection.emitter.events))
    .toEqual(['connecting', 'connect', 'message', 'error', 'disconnect'])

  sync.destroy()
  expect(Object.keys(sync.log.emitter.events)).toEqual([])
  expect(Object.keys(sync.connection.emitter.events)).toEqual([])
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
  sync.connection.connect()
  sync.destroy()
  expect(sync.connection.connected).toBeFalsy()
})

it('throws a error on send to disconnected connection', function () {
  var sync = createSync()
  expect(function () {
    sync.send(['test'])
  }).toThrowError(/disconnected/)
})

it('sends messages to connection', function () {
  var sync = createSync()
  sync.connection.connect()
  var messages = []
  sync.connection.other().on('message', function (msg) {
    messages.push(msg)
  })

  sync.send(['test'])
  expect(messages).toEqual([['test']])
})

it('has connection state', function () {
  var sync = createSync()
  expect(sync.connected).toBeFalsy()

  sync.connection.connect()
  expect(sync.connected).toBeTruthy()

  sync.connection.disconnect()
  expect(sync.connected).toBeFalsy()
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
  var sync = createSync()
  var calls = []
  sync.authenticated = true
  sync.testMessage = function (a, b) {
    calls.push([a, b])
  }

  sync.connection.connect()
  sync.connection.other().send(['test', 1, 2])
  expect(calls).toEqual([[1, 2]])
})

it('sets wait state on creating', function () {
  var log = new Log({ store: new MemoryStore(), timer: createTestTimer() })
  log.add({ type: 'a' })
  var pair = new LocalPair()
  var sync = new BaseSync('client', log, pair.left)
  expect(sync.state).toEqual('wait')
})

it('has state', function () {
  var sync = createSync()
  var other = sync.connection.other()
  var states = []
  sync.on('state', function () {
    states.push(sync.state)
  })

  expect(sync.state).toEqual('disconnected')

  sync.connection.connect()
  sync.sendConnect()
  other.send(['connected', sync.protocol, 'server', [0, 0]])
  return wait(0).then(function () {
    expect(sync.state).toEqual('synchronized')
    return sync.log.add({ type: 'a' })
  }).then(function () {
    expect(sync.state).toEqual('sending')

    other.send(['synced', 1])
    expect(sync.state).toEqual('synchronized')

    sync.connection.disconnect()
    expect(sync.state).toEqual('disconnected')

    return sync.log.add({ type: 'b' })
  }).then(function () {
    expect(sync.state).toEqual('wait')

    sync.connection.emitter.emit('connecting')
    expect(sync.state).toEqual('connecting')

    sync.connection.connect()
    sync.sendConnect()
    expect(sync.state).toEqual('sending')

    other.send(['connected', sync.protocol, 'server', [0, 0]])
    return wait(0)
  }).then(function () {
    other.send(['synced', 2])
    expect(sync.state).toEqual('synchronized')

    expect(states).toEqual([
      'synchronized',
      'sending',
      'synchronized',
      'disconnected',
      'wait',
      'connecting',
      'sending',
      'synchronized'
    ])
  })
})

it('has synced and otherSynced option', function () {
  var log = { on: function () { } }
  var con = { on: function () { } }
  var sync = new BaseSync('client', log, con, { synced: 1, otherSynced: 2 })
  expect(sync.synced).toBe(1)
  expect(sync.otherSynced).toBe(2)
})

it('has separated timeouts', function () {
  var calls = []
  var log = { on: function () { } }
  var con = {
    connected: true,
    disconnect: function (reason) {
      calls.push(reason)
    },
    on: function () { }
  }
  var sync = new BaseSync('client', log, con, { timeout: 100 })

  var error
  sync.catch(function (e) {
    error = e
  })

  sync.startTimeout()
  return wait(60).then(function () {
    sync.startTimeout()
    return wait(60)
  }).then(function () {
    expect(calls).toEqual(['timeout'])
    expect(error.message).toContain('timeout')
  })
})

it('accepts already connected connection', function () {
  var log = { on: function () { } }
  var pair = new LocalPair()
  pair.left.connect()
  var sync = new BaseSync('client', log, pair.left)
  expect(sync.connected).toBeTruthy()
})

it('receives errors from connection', function () {
  var log = { on: function () { } }
  var pair = new LocalPair()
  var sync = new BaseSync('client', log, pair.left)
  pair.left.connect()

  var emitted
  sync.on('error', function (e) {
    emitted = e
  })

  var error = new Error('test')
  pair.left.emitter.emit('error', error)

  expect(sync.connected).toBeFalsy()
  expect(emitted).toEqual(error)
})

it('receives format errors from connection', function () {
  var log = { on: function () { } }
  var pair = new LocalPair()
  var sync = new BaseSync('client', log, pair.left)
  pair.left.connect()

  var sent = []
  pair.right.on('message', function (msg) {
    sent.push(msg)
  })

  var error = new Error('Wrong message format')
  error.received = 'options'
  pair.left.emitter.emit('error', error)
  expect(sync.connected).toBeFalsy()
  expect(sent).toEqual([
    ['error', 'wrong-format', 'options']
  ])
})

it('emits synced event', function () {
  var sync = createSync()
  var other = sync.connection.other()

  var synced = []
  sync.on('synced', function () {
    synced.push([sync.synced, sync.otherSynced])
  })

  sync.connection.connect()
  sync.sendConnect()
  other.send(['connected', sync.protocol, 'server', [0, 0]])
  expect(synced).toEqual([])

  other.send(['ping', 1])
  expect(synced).toEqual([[0, 1]])

  other.send(['pong', 2])
  expect(synced).toEqual([[0, 1], [0, 2]])

  other.send(['sync', 3, { type: 'a' }, sync.log.timer()])
  return wait(0).then(function () {
    expect(synced).toEqual([[0, 1], [0, 2], [0, 3]])

    other.send(['synced', 1])
    expect(synced).toEqual([[0, 1], [0, 2], [0, 3], [1, 3]])
  })
})
