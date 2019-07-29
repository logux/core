let WsConnection = require('../ws-connection')

function FakeWebSocket (url, protocols, opts) {
  this.opts = opts
  this.sent = []
  let self = this
  setTimeout(() => {
    self.onopen()
  }, 1)
}
FakeWebSocket.prototype = {
  send (msg) {
    this.sent.push(msg)
  },
  close () { }
}

afterEach(() => {
  delete global.WebSocket
})

it('throws a error on lack of WebSocket support', () => {
  expect(() => {
    new WsConnection('ws://locahost')
  }).toThrowError(/WebSocket/)
})

it('emits error on wrong format', async () => {
  global.WebSocket = FakeWebSocket
  let connection = new WsConnection('ws://locahost')
  let error
  connection.on('error', err => {
    error = err
  })

  await connection.connect()
  connection.ws.onmessage({ data: '{' })
  expect(error.message).toEqual('Wrong message format')
  expect(error.received).toEqual('{')
})

it('emits error on error', async () => {
  global.WebSocket = FakeWebSocket
  let connection = new WsConnection('ws://locahost')
  let error
  connection.on('error', err => {
    error = err
  })

  await connection.connect()
  connection.ws.onerror({ error: new Error('test') })
  expect(error.message).toEqual('test')
  connection.ws.onerror({ })
  expect(error.message).toEqual('WS Error')
})

it('emits connection states', async () => {
  global.WebSocket = FakeWebSocket
  let connection = new WsConnection('ws://locahost')

  let states = []
  connection.on('connecting', () => {
    states.push('connecting')
  })
  connection.on('connect', () => {
    states.push('connect')
  })
  connection.on('disconnect', () => {
    states.push('disconnect')
  })

  expect(states).toEqual([])
  expect(connection.connected).toBeFalsy()

  let connecting = connection.connect()
  expect(states).toEqual(['connecting'])
  expect(connection.connected).toBeFalsy()

  await connecting
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

it('closes WebSocket', async () => {
  global.WebSocket = FakeWebSocket
  let connection = new WsConnection('ws://locahost')

  await connection.connect()
  let ws = connection.ws
  ws.close = () => {
    ws.onclose()
  }
  jest.spyOn(ws, 'close')

  connection.disconnect()
  expect(ws.close).toHaveBeenCalled()
  expect(connection.connected).toBeFalsy()
})

it('receives messages', async () => {
  global.WebSocket = FakeWebSocket
  let connection = new WsConnection('ws://locahost')

  let received = []
  connection.on('message', msg => {
    received.push(msg)
  })

  await connection.connect()
  connection.ws.onmessage({ data: '["test"]' })
  expect(received).toEqual([['test']])
})

it('sends messages', async () => {
  global.WebSocket = FakeWebSocket
  let connection = new WsConnection('ws://locahost')

  await connection.connect()
  connection.send(['test'])
  expect(connection.ws.sent).toEqual(['["test"]'])
})

it('uses custom WebSocket implementation', async () => {
  let connection = new WsConnection('ws://locahost', FakeWebSocket)

  await connection.connect()
  connection.send(['test'])
  expect(connection.ws.sent).toEqual(['["test"]'])
})

it('passes extra option for WebSocket', async () => {
  let connection = new WsConnection('ws://locahost', FakeWebSocket, { a: 1 })
  await connection.connect()
  expect(connection.ws.opts).toEqual({ a: 1 })
})

it('does not send to closed socket', async () => {
  global.WebSocket = FakeWebSocket
  let connection = new WsConnection('ws://locahost')

  let errors = []
  connection.on('error', e => {
    errors.push(e.message)
  })

  await connection.connect()
  connection.ws.readyState = 2
  connection.send(['test'])
  expect(errors).toEqual(['WS was closed'])
})
