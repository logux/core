var NanoEvents = require('nanoevents')

var BaseSync = require('../base-sync')
var LocalPair = require('../local-pair')

function createSync () {
  var log = new NanoEvents()
  var pair = new LocalPair()
  return new BaseSync('host', log, pair.left)
}

it('saves all arguments', function () {
  var log = { on: function () { } }
  var connection = { on: function () { } }
  var sync = new BaseSync('host', log, connection, { a: 1 })

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
  expect(Object.keys(sync.log.events)).toEqual(['event'])
  expect(Object.keys(sync.connection.emitter.events))
    .toEqual(['connect', 'message', 'disconnect'])

  sync.destroy()
  expect(Object.keys(sync.log.events)).toEqual([])
  expect(Object.keys(sync.connection.emitter.events)).toEqual([])
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

it('emits events on loosing connection', function () {
  var sync = createSync()
  var events = []
  sync.on('disconnect', function () {
    events.push('disconnect')
  })

  sync.connection.connect()
  expect(events).toEqual([])

  sync.connection.disconnect()
  expect(events).toEqual(['disconnect'])

  sync.connection.connect()
  sync.connection.disconnect()
  expect(events).toEqual(['disconnect', 'disconnect'])
})

it('supports one-time events', function () {
  var sync = createSync()
  var events = []
  sync.once('disconnect', function () {
    events.push('disconnect')
  })

  sync.connection.connect()
  sync.connection.disconnect()
  sync.connection.connect()
  sync.connection.disconnect()
  expect(events).toEqual(['disconnect'])
})

it('calls message method', function () {
  var sync = createSync()
  var calls = []
  sync.testMessage = function (a, b) {
    calls.push([a, b])
  }

  sync.connection.connect()
  sync.connection.other().send(['test', 1, 2])
  expect(calls).toEqual([[1, 2]])
})
