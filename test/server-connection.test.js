var NanoEvents = require('nanoevents')

var ServerConnection = require('../server-connection')

it('throws on connect method call', function () {
  var connection = new ServerConnection({ on: function () { } })
  expect(function () {
    connection.connect()
  }).toThrowError(/reconnect/)
})

it('emits connection states', function () {
  var connection = new ServerConnection(new NanoEvents())

  var states = []
  connection.on('disconnect', function () {
    states.push('disconnect')
  })

  expect(states).toEqual([])
  expect(connection.connected).toBeTruthy()

  connection.ws.emit('close')
  expect(states).toEqual(['disconnect'])
  expect(connection.connected).toBeFalsy()
})

it('emits error on wrong format', function () {
  var connection = new ServerConnection(new NanoEvents())
  var error
  connection.on('error', function (err) {
    error = err
  })

  connection.ws.emit('message', '{', { })
  expect(error.message).toEqual('Wrong message format')
  expect(error.received).toEqual('{')
})

it('closes WebSocket', function () {
  var ws = new NanoEvents()
  ws.close = jest.fn(function () {
    ws.emit('close')
  })
  var connection = new ServerConnection(ws)

  connection.disconnect()
  expect(ws.close).toHaveBeenCalled()
  expect(connection.connected).toBeFalsy()
})

it('receives messages', function () {
  var connection = new ServerConnection(new NanoEvents())

  var received = []
  connection.on('message', function (msg) {
    received.push(msg)
  })

  connection.ws.emit('message', '["test"]', { })
  expect(received).toEqual([['test']])
})

it('sends messages', function () {
  var connection = new ServerConnection(new NanoEvents())

  var sent = []
  connection.ws.send = function (msg) {
    sent.push(msg)
  }

  connection.send(['test'])
  expect(sent).toEqual(['["test"]'])
})

it('emits errors', function () {
  var connection = new ServerConnection(new NanoEvents())

  var error = new Error('test')
  connection.ws.send = function () {
    throw error
  }

  var emitted
  connection.on('error', function (err) {
    emitted = err
  })

  connection.send()
  expect(emitted).toEqual(error)
})
