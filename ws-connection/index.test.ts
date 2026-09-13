import { restoreAll, spyOn } from 'nanospy'
import { deepStrictEqual, equal } from 'node:assert'
import { afterEach, test } from 'node:test'

import { BaseNode, type Message, TestTime, WsConnection } from '../index.js'
import { FakeWebSocket } from '../test/fake-ws.js'

function privateMethods(obj: object): any {
  return obj
}

function setWebSocket(ws: object | undefined): void {
  // @ts-expect-error
  global.WebSocket = ws
}

afterEach(() => {
  restoreAll()
  setWebSocket(undefined)
})

function emit(
  ws: FakeWebSocket | undefined,
  name: string,
  data?: Error | string
): void {
  if (typeof ws === 'undefined') {
    throw new Error('WebSocket was not created')
  }
  ws.emit(name, data)
}

test('emits error on wrong format', async () => {
  setWebSocket(FakeWebSocket)
  let connection = new WsConnection<FakeWebSocket>('ws://localhost')
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
  let connection = new WsConnection<FakeWebSocket>('ws://localhost')
  let error: Error | undefined
  connection.on('error', err => {
    error = err
  })

  await connection.connect()

  emit(connection.ws, 'error', new Error('test'))
  if (typeof error === 'undefined') throw new Error('Error was not sent')
  equal(error.message, 'test')
  error = undefined
  emit(connection.ws, 'error')
  equal(error, undefined)
})

test('disconnects node with error only on error with details', async () => {
  setWebSocket(FakeWebSocket)
  let connection = new WsConnection<FakeWebSocket>('ws://localhost')
  let node = new BaseNode('client', TestTime.getLog(), connection)
  let errors: string[] = []
  node.catch(err => {
    errors.push(err.message)
  })
  let states: string[] = []
  node.on('state', () => {
    states.push(node.state)
  })

  await connection.connect()
  equal(node.connected, true)
  deepStrictEqual(states, ['connecting'])

  emit(connection.ws, 'error', new Error('test'))
  equal(node.connected, false)
  equal(node.state, 'disconnected')
  deepStrictEqual(errors, ['test'])
  equal(connection.ws, undefined)

  await connection.connect()
  equal(node.connected, true)
  equal(node.state, 'connecting')

  emit(connection.ws, 'error')
  equal(node.connected, true)
  equal(node.state, 'connecting')
  deepStrictEqual(errors, ['test'])

  // Browser’s WebSocket always sends close event after error event
  emit(connection.ws, 'close')
  equal(node.connected, false)
  equal(node.state, 'disconnected')
  deepStrictEqual(errors, ['test'])

  await connection.connect()
  equal(node.connected, true)
  equal(node.state, 'connecting')

  // Chrome switches readyState to CLOSING before sending close event
  connection.ws!.readyState = 2
  privateMethods(node).send(['ping', 0])
  equal(node.connected, false)
  equal(node.state, 'disconnected')
  deepStrictEqual(errors, ['test'])
  deepStrictEqual(states, [
    'connecting',
    'disconnected',
    'connecting',
    'disconnected',
    'connecting',
    'disconnected'
  ])

  node.destroy()
})

test('emits connection states', async () => {
  setWebSocket(FakeWebSocket)
  let connection = new WsConnection<FakeWebSocket>('ws://localhost')

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

  deepStrictEqual(states, [])
  equal(connection.connected, false)

  let connecting = connection.connect()

  deepStrictEqual(states, ['connecting'])
  equal(connection.connected, false)

  await connecting
  deepStrictEqual(states, ['connecting', 'connect'])
  equal(connection.connected, true)

  emit(connection.ws, 'close')
  deepStrictEqual(states, ['connecting', 'connect', 'disconnect'])
  equal(connection.connected, false)

  connection.connect()
  emit(connection.ws, 'close')
  deepStrictEqual(states, [
    'connecting',
    'connect',
    'disconnect',
    'connecting',
    'disconnect'
  ])
  equal(connection.connected, false)
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
  equal(connection.connected, false)
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
  equal(connection.connected, false)
})

test('receives messages', async () => {
  setWebSocket(FakeWebSocket)
  let connection = new WsConnection<FakeWebSocket>('ws://localhost')

  let received: Message[] = []
  connection.on('message', msg => {
    received.push(msg)
  })

  await connection.connect()

  emit(connection.ws, 'message', '["ping",1]')
  deepStrictEqual(received, [['ping', 1]])
})

test('sends messages', async () => {
  setWebSocket(FakeWebSocket)
  let connection = new WsConnection<FakeWebSocket>('ws://localhost')

  await connection.connect()
  if (typeof connection.ws === 'undefined') {
    throw new Error('WebSocket was not created')
  }

  connection.send(['ping', 1])
  deepStrictEqual(connection.ws.sent, ['["ping",1]'])
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
  deepStrictEqual(connection.ws.sent, ['["ping",1]'])
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

  deepStrictEqual(connection.ws.opts, { a: 1 })
})

test('disconnects on sending to closed socket', async () => {
  setWebSocket(FakeWebSocket)
  let connection = new WsConnection<FakeWebSocket>('ws://localhost')

  let errors: string[] = []
  connection.on('error', e => {
    errors.push(e.message)
  })
  let disconnects = 0
  connection.on('disconnect', () => {
    disconnects += 1
  })

  await connection.connect()
  if (typeof connection.ws === 'undefined') {
    throw new Error('WebSocket was not created')
  }

  let ws = connection.ws
  ws.readyState = 2
  connection.send(['ping', 1])
  deepStrictEqual(ws.sent, [])
  deepStrictEqual(errors, [])
  equal(disconnects, 1)
  equal(connection.connected, false)
  equal(connection.ws, undefined)
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

  equal(connection.connected, true)
  equal(connected, 1)
})
