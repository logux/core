let ServerConnection = require('../server-connection')

it('throws on connect method call', () => {
  let connection = new ServerConnection({ })
  expect(() => {
    connection.connect()
  }).toThrowError(/reconnect/)
})

it('emits connection states', () => {
  let connection = new ServerConnection({ })

  let states = []
  connection.on('disconnect', () => {
    states.push('disconnect')
  })

  expect(states).toEqual([])
  expect(connection.connected).toBeTruthy()

  connection.ws.onclose()
  expect(states).toEqual(['disconnect'])
  expect(connection.connected).toBeFalsy()
})

it('emits error on wrong format', () => {
  let connection = new ServerConnection({ })
  let error
  connection.on('error', err => {
    error = err
  })

  connection.ws.onmessage({ data: '{' })
  expect(error.message).toEqual('Wrong message format')
  expect(error.received).toEqual('{')
})

it('closes WebSocket', () => {
  let ws = {
    close: jest.fn(() => {
      ws.onclose()
    })
  }
  let connection = new ServerConnection(ws)

  connection.disconnect()
  expect(ws.close).toHaveBeenCalled()
  expect(connection.connected).toBeFalsy()
})

it('receives messages', () => {
  let connection = new ServerConnection({ })

  let received = []
  connection.on('message', msg => {
    received.push(msg)
  })

  connection.ws.onmessage({ data: '["test"]' })
  expect(received).toEqual([['test']])
})

it('sends messages', () => {
  let sent = []
  let ws = {
    send (msg) {
      sent.push(msg)
    }
  }
  let connection = new ServerConnection(ws)

  connection.send(['test'])
  expect(sent).toEqual(['["test"]'])
})

it('does not send to closed socket', () => {
  let sent = []
  let ws = {
    send (msg) {
      sent.push(msg)
    },
    close () { }
  }

  let connection = new ServerConnection(ws)

  let errors = []
  connection.on('error', e => {
    errors.push(e.message)
  })

  connection.ws.readyState = 2

  connection.send(['test'])
  expect(sent).toEqual([])
  expect(errors).toEqual(['WS was closed'])
})
