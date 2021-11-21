import { spyOn, restoreAll } from 'nanospy'
import { equal, is, throws } from 'uvu/assert'
import WebSocket from 'ws'
import { test } from 'uvu'

import { WsConnection, Message } from '../index.js'

class FakeWebSocket {
  opts: object

  sent: string[]

  readyState?: number

  onopen?: () => void

  onmessage?: (event: object) => void

  onerror?: (event: object) => void

  onclose?: () => void

  constructor(url: string, protocols: string, opts: object) {
    this.opts = opts
    this.sent = []
    setTimeout(() => {
      this.onopen?.()
    }, 1)
  }

  send(msg: string): void {
    this.sent.push(msg)
  }

  emit(name: string, data?: string | Error): void {
    if (name === 'open') {
      if (typeof this.onopen === 'undefined') {
        throw new Error(`No ${name} event listener`)
      } else {
        this.onopen()
      }
    } else if (name === 'message') {
      if (typeof this.onmessage === 'undefined') {
        throw new Error(`No ${name} event listener`)
      } else {
        this.onmessage({ data })
      }
    } else if (name === 'error') {
      if (typeof this.onerror === 'undefined') {
        throw new Error(`No ${name} event listener`)
      } else {
        this.onerror({ error: data })
      }
    } else if (name === 'close') {
      if (typeof this.onclose !== 'undefined') {
        this.onclose()
      }
    }
  }

  close(): void {
    this.emit('close')
  }
}

function privateMethods(obj: object): any {
  return obj
}

function setWebSocket(ws: object | undefined): void {
  // @ts-expect-error
  global.WebSocket = ws
}

test.after.each(() => {
  restoreAll()
  setWebSocket(undefined)
})

function emit(
  ws: WebSocket | undefined,
  name: string,
  data?: string | Error
): void {
  if (typeof ws === 'undefined') {
    throw new Error('WebSocket was not created')
  }
  ws.emit(name, data)
}

test('throws a error on lack of WebSocket support', () => {
  throws(() => {
    new WsConnection('ws://localhost')
  }, /WebSocket/)
})

test('emits error on wrong format', async () => {
  setWebSocket(FakeWebSocket)
  let connection = new WsConnection('ws://localhost')
  let error: Error | undefined
  connection.on('error', err => {
    error = err
  })

  await connection.connect()

  emit(connection.ws, 'message', '{')
  if (typeof error === 'undefined') throw new Error('Error was not sent')
  equal(error.message, 'Wrong message format')
  equal(privateMethods(error).received, '{')
})

test('emits error on error', async () => {
  setWebSocket(FakeWebSocket)
  let connection = new WsConnection('ws://localhost')
  let error: Error | undefined
  connection.on('error', err => {
    error = err
  })

  await connection.connect()

  emit(connection.ws, 'error', new Error('test'))
  if (typeof error === 'undefined') throw new Error('Error was not sent')
  equal(error.message, 'test')
  emit(connection.ws, 'error')
  equal(error.message, 'WS Error')
})

test('emits connection states', async () => {
  setWebSocket(FakeWebSocket)
  let connection = new WsConnection('ws://localhost')

  let states: string[] = []
  connection.on('connecting', () => {
    states.push('connecting')
  })
  connection.on('connect', () => {
    states.push('connect')
  })
  connection.on('disconnect', () => {
    states.push('disconnect')
  })

  equal(states, [])
  is(connection.connected, false)

  let connecting = connection.connect()

  equal(states, ['connecting'])
  is(connection.connected, false)

  await connecting
  equal(states, ['connecting', 'connect'])
  is(connection.connected, true)

  emit(connection.ws, 'close')
  equal(states, ['connecting', 'connect', 'disconnect'])
  is(connection.connected, false)

  connection.connect()
  emit(connection.ws, 'close')
  equal(states, [
    'connecting',
    'connect',
    'disconnect',
    'connecting',
    'disconnect'
  ])
  is(connection.connected, false)
})

test('closes WebSocket', async () => {
  setWebSocket(FakeWebSocket)
  let connection = new WsConnection('ws://localhost')

  await connection.connect()
  if (typeof connection.ws === 'undefined') {
    throw new Error('WebSocket was not created')
  }

  let ws = connection.ws
  let close = spyOn(ws, 'close')

  connection.disconnect()
  equal(close.callCount, 1)
  is(connection.connected, false)
})

test('close WebSocket 2 times', async () => {
  setWebSocket(FakeWebSocket)
  let connection = new WsConnection('ws://localhost')

  await connection.connect()
  if (typeof connection.ws === 'undefined') {
    throw new Error('WebSocket was not created')
  }

  let ws = connection.ws
  let close = spyOn(ws, 'close')

  connection.disconnect()
  connection.disconnect()
  equal(close.callCount, 1)
  is(connection.connected, false)
})

test('receives messages', async () => {
  setWebSocket(FakeWebSocket)
  let connection = new WsConnection('ws://localhost')

  let received: Message[] = []
  connection.on('message', msg => {
    received.push(msg)
  })

  await connection.connect()

  emit(connection.ws, 'message', '["ping",1]')
  equal(received, [['ping', 1]])
})

test('sends messages', async () => {
  setWebSocket(FakeWebSocket)
  let connection = new WsConnection<FakeWebSocket>('ws://localhost')

  await connection.connect()
  if (typeof connection.ws === 'undefined') {
    throw new Error('WebSocket was not created')
  }

  connection.send(['ping', 1])
  equal(connection.ws.sent, ['["ping",1]'])
})

test('uses custom WebSocket implementation', async () => {
  let connection = new WsConnection<FakeWebSocket>(
    'ws://localhost',
    FakeWebSocket
  )

  await connection.connect()
  if (typeof connection.ws === 'undefined') {
    throw new Error('WebSocket was not created')
  }

  connection.send(['ping', 1])
  equal(connection.ws.sent, ['["ping",1]'])
})

test('passes extra option for WebSocket', async () => {
  let connection = new WsConnection<FakeWebSocket>(
    'ws://localhost',
    FakeWebSocket,
    { a: 1 }
  )
  await connection.connect()
  if (typeof connection.ws === 'undefined') {
    throw new Error('WebSocket was not created')
  }

  equal(connection.ws.opts, { a: 1 })
})

test('does not send to closed socket', async () => {
  setWebSocket(FakeWebSocket)
  let connection = new WsConnection<FakeWebSocket>('ws://localhost')

  let errors: string[] = []
  connection.on('error', e => {
    errors.push(e.message)
  })

  await connection.connect()
  if (typeof connection.ws === 'undefined') {
    throw new Error('WebSocket was not created')
  }

  connection.ws.readyState = 2
  connection.send(['ping', 1])
  equal(errors, ['WS was closed'])
})

test('ignores double connect call', async () => {
  setWebSocket(FakeWebSocket)
  let connection = new WsConnection('ws://localhost')

  let connected = 0
  connection.on('connecting', () => {
    connected += 1
  })

  await connection.connect()
  await connection.connect()

  is(connection.connected, true)
  equal(connected, 1)
})

test.run()
