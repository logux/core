var WsConnection = require('../ws-connection')

function FakeWebSocket (url, protocols, opts) {
  this.opts = opts
  this.sent = []
  var self = this
  setTimeout(function () {
    self.onopen()
  }, 1)
}
FakeWebSocket.prototype = {
  send: function (msg) {
    this.sent.push(msg)
  },
  close: function () { }
}

afterEach(function () {
  delete global.WebSocket
})

it('throws a error on lack of WebSocket support', function () {
  expect(function () {
    new WsConnection('ws://locahost')
  }).toThrowError(/WebSocket/)
})

it('emits error on wrong format', function () {
  global.WebSocket = FakeWebSocket
  var connection = new WsConnection('ws://locahost')
  var error
  connection.on('error', function (err) {
    error = err
  })

  return connection.connect().then(function () {
    connection.ws.onmessage({ data: '{' })
    expect(error.message).toEqual('Wrong message format')
    expect(error.received).toEqual('{')
  })
})

it('emits error on error', function () {
  global.WebSocket = FakeWebSocket
  var connection = new WsConnection('ws://locahost')
  var error
  connection.on('error', function (err) {
    error = err
  })

  return connection.connect().then(function () {
    connection.ws.onerror({ error: new Error('test') })
    expect(error.message).toEqual('test')
    connection.ws.onerror({ })
    expect(error.message).toEqual('WS Error')
  })
})

it('emits connection states', function () {
  global.WebSocket = FakeWebSocket
  var connection = new WsConnection('ws://locahost')

  var states = []
  connection.on('connecting', function () {
    states.push('connecting')
  })
  connection.on('connect', function () {
    states.push('connect')
  })
  connection.on('disconnect', function () {
    states.push('disconnect')
  })

  expect(states).toEqual([])
  expect(connection.connected).toBeFalsy()

  var connecting = connection.connect()
  expect(states).toEqual(['connecting'])
  expect(connection.connected).toBeFalsy()

  return connecting.then(function () {
    expect(states).toEqual(['connecting', 'connect'])
    expect(connection.connected).toBeTruthy()

    connection.ws.onclose()
    expect(states).toEqual(['connecting', 'connect', 'disconnect'])
    expect(connection.connected).toBeFalsy()

    connection.connect()
    connection.ws.onclose()
    expect(states).toEqual([
      'connecting', 'connect', 'disconnect', 'connecting', 'disconnect'
    ])
    expect(connection.connected).toBeFalsy()
  })
})

it('closes WebSocket', function () {
  global.WebSocket = FakeWebSocket
  var connection = new WsConnection('ws://locahost')

  return connection.connect().then(function () {
    var ws = connection.ws
    ws.close = jest.fn(function () {
      ws.onclose()
    })

    connection.disconnect()
    expect(ws.close).toHaveBeenCalled()
    expect(connection.connected).toBeFalsy()
  })
})

it('receives messages', function () {
  global.WebSocket = FakeWebSocket
  var connection = new WsConnection('ws://locahost')

  var received = []
  connection.on('message', function (msg) {
    received.push(msg)
  })

  return connection.connect().then(function () {
    connection.ws.onmessage({ data: '["test"]' })
    expect(received).toEqual([['test']])
  })
})

it('sends messages', function () {
  global.WebSocket = FakeWebSocket
  var connection = new WsConnection('ws://locahost')

  return connection.connect().then(function () {
    connection.send(['test'])
    expect(connection.ws.sent).toEqual(['["test"]'])
  })
})

it('uses custom WebSocket implementation', function () {
  var connection = new WsConnection('ws://locahost', FakeWebSocket)

  return connection.connect().then(function () {
    connection.send(['test'])
    expect(connection.ws.sent).toEqual(['["test"]'])
  })
})

it('passes extra option for WebSocket', function () {
  var connection = new WsConnection('ws://locahost', FakeWebSocket, { a: 1 })
  return connection.connect().then(function () {
    expect(connection.ws.opts).toEqual({ a: 1 })
  })
})

it('does not send to closed socket', function () {
  global.WebSocket = FakeWebSocket
  var connection = new WsConnection('ws://locahost')

  var errors = []
  connection.on('error', function (e) {
    errors.push(e.message)
  })

  return connection.connect().then(function () {
    connection.ws.readyState = 2
    connection.send(['test'])
    expect(errors).toEqual(['WS was closed'])
  })
})
