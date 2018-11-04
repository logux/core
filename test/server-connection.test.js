var ServerConnection = require('../server-connection')

it('throws on connect method call', function () {
  var connection = new ServerConnection({ })
  expect(function () {
    connection.connect()
  }).toThrowError(/reconnect/)
})

it('emits connection states', function () {
  var connection = new ServerConnection({ })

  var states = []
  connection.on('disconnect', function () {
    states.push('disconnect')
  })

  expect(states).toEqual([])
  expect(connection.connected).toBeTruthy()

  connection.ws.onclose()
  expect(states).toEqual(['disconnect'])
  expect(connection.connected).toBeFalsy()
})

it('emits error on wrong format', function () {
  var connection = new ServerConnection({ })
  var error
  connection.on('error', function (err) {
    error = err
  })

  connection.ws.onmessage({ data: '{' })
  expect(error.message).toEqual('Wrong message format')
  expect(error.received).toEqual('{')
})

it('closes WebSocket', function () {
  var ws = {
    close: jest.fn(function () {
      ws.onclose()
    })
  }
  var connection = new ServerConnection(ws)

  connection.disconnect()
  expect(ws.close).toHaveBeenCalled()
  expect(connection.connected).toBeFalsy()
})

it('receives messages', function () {
  var connection = new ServerConnection({ })

  var received = []
  connection.on('message', function (msg) {
    received.push(msg)
  })

  connection.ws.onmessage({ data: '["test"]' })
  expect(received).toEqual([['test']])
})

it('sends messages', function () {
  var sent = []
  var ws = {
    send: function (msg) {
      sent.push(msg)
    }
  }
  var connection = new ServerConnection(ws)

  connection.send(['test'])
  expect(sent).toEqual(['["test"]'])
})

it('does not send to closed socket', function () {
  var sent = []
  var ws = {
    send: function (msg) {
      sent.push(msg)
    },
    close: function () { }
  }

  var connection = new ServerConnection(ws)

  var errors = []
  connection.on('error', function (e) {
    errors.push(e.message)
  })

  connection.ws.readyState = 2

  connection.send(['test'])
  expect(sent).toEqual([])
  expect(errors).toEqual(['WS was closed'])
})
