var BrowserConnection = require('../browser-connection')

function FakeWebSocket () { }
FakeWebSocket.prototype = {
  close: function () { }
}

it('throws a error on lack of WebSocket support', function () {
  delete window.WebSocket
  var connection = new BrowserConnection('ws://locahost')
  expect(function () {
    connection.connect()
  }).toThrowError(/WebSocket/)
})

it('throws on message in disconnected state', function () {
  var connection = new BrowserConnection('ws://locahost')
  expect(function () {
    connection.send(['test'])
  }).toThrowError(/connection/)
})

it('emits error on wrong format', function () {
  window.WebSocket = FakeWebSocket
  var connection = new BrowserConnection('ws://locahost')
  var error
  connection.on('error', function (err) {
    error = err
  })

  connection.connect()
  connection.ws.onmessage({ data: '{' })

  expect(error.message).toEqual('Wrong message format')
  expect(error.received).toEqual('{')
})

it('emits connection states', function () {
  window.WebSocket = FakeWebSocket
  var connection = new BrowserConnection('ws://locahost')

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

  connection.connect()
  expect(states).toEqual(['connecting'])
  expect(connection.connected).toBeFalsy()

  connection.ws.onopen()
  expect(states).toEqual(['connecting', 'connect'])
  expect(connection.connected).toBeTruthy()

  connection.disconnect()
  expect(states).toEqual(['connecting', 'connect', 'disconnect'])
  expect(connection.connected).toBeFalsy()
})

it('closes WebSocket', function () {
  window.WebSocket = FakeWebSocket
  var connection = new BrowserConnection('ws://locahost')

  connection.connect()
  var ws = connection.ws
  ws.close = jest.fn(function () {
    ws.onclose()
  })

  connection.disconnect()
  expect(ws.close).toHaveBeenCalled()
  expect(connection.connected).toBeFalsy()
})

it('receives messages', function () {
  window.WebSocket = FakeWebSocket
  var connection = new BrowserConnection('ws://locahost')

  var received = []
  connection.on('message', function (msg) {
    received.push(msg)
  })

  connection.connect()
  connection.ws.onmessage({ data: '["test"]' })
  expect(received).toEqual([['test']])
})

it('sends messages', function () {
  window.WebSocket = FakeWebSocket
  var connection = new BrowserConnection('ws://locahost')

  connection.connect()
  var sent = []
  connection.ws.send = function (msg) {
    sent.push(msg)
  }

  connection.send(['test'])
  expect(sent).toEqual(['["test"]'])
})
