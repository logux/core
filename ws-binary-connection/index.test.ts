import { restoreAll, spyOn } from 'nanospy'
import { deepStrictEqual, equal, ok } from 'node:assert'
import { afterEach, test } from 'node:test'

import { type Message, WsBinaryConnection } from '../index.js'
import { FakeWebSocket } from '../test/fake-ws.js'

interface WsBinaryInternals {
  baseTime: number
  connectedSubprotocol: number
  localNodeId: string | undefined
  remoteNodeId: string | undefined
  textMode: boolean
}

interface ErrorWithReceived extends Error {
  received: string
}

function internal(obj: object): WsBinaryInternals {
  return obj as unknown as WsBinaryInternals
}

function emit(
  ws: FakeWebSocket | undefined,
  name: string,
  data?: ArrayBufferLike | Error | string
): void {
  if (typeof ws === 'undefined') {
    throw new Error('WebSocket was not created')
  }
  ws.emit(name, data)
}

async function createConnection(): Promise<{
  connection: WsBinaryConnection<FakeWebSocket>
  received: Message[]
}> {
  let connection = new WsBinaryConnection<FakeWebSocket>(
    'ws://localhost',
    FakeWebSocket
  )
  let received: Message[] = []
  connection.on('message', msg => received.push(msg))
  await connection.connect()
  return { connection, received }
}

afterEach(() => {
  restoreAll()
})

test('sets binaryType on WebSocket', async () => {
  let { connection } = await createConnection()
  equal(connection.ws!.binaryType, 'arraybuffer')
})

test('sends binary data', async () => {
  let { connection } = await createConnection()
  connection.send(['ping', 1])
  ok(connection.ws!.sent[0] instanceof Uint8Array)
})

test('round-trips ping message', async () => {
  let { connection, received } = await createConnection()

  connection.send(['ping', 42])
  let binary = connection.ws!.sent[0] as Uint8Array
  emit(connection.ws, 'message', binary.buffer)

  deepStrictEqual(received, [['ping', 42]])
})

test('round-trips pong message', async () => {
  let { connection, received } = await createConnection()

  connection.send(['pong', 100])
  let binary = connection.ws!.sent[0] as Uint8Array
  emit(connection.ws, 'message', binary.buffer)

  deepStrictEqual(received, [['pong', 100]])
})

test('round-trips synced message', async () => {
  let { connection, received } = await createConnection()

  connection.send(['synced', 5])
  let binary = connection.ws!.sent[0] as Uint8Array
  emit(connection.ws, 'message', binary.buffer)

  deepStrictEqual(received, [['synced', 5]])
})

test('round-trips error message without options', async () => {
  let { connection, received } = await createConnection()

  connection.send(['error', 'wrong-format'])
  let binary = connection.ws!.sent[0] as Uint8Array
  emit(connection.ws, 'message', binary.buffer)

  deepStrictEqual(received, [['error', 'wrong-format']])
})

test('round-trips error message with options', async () => {
  let { connection, received } = await createConnection()

  connection.send(['error', 'wrong-protocol', { supported: 5, used: 3 }])
  let binary = connection.ws!.sent[0] as Uint8Array
  emit(connection.ws, 'message', binary.buffer)

  deepStrictEqual(received, [
    ['error', 'wrong-protocol', { supported: 5, used: 3 }]
  ])
})

test('round-trips headers message', async () => {
  let { connection, received } = await createConnection()

  connection.send(['headers', { language: 'en', version: 2 }])
  let binary = connection.ws!.sent[0] as Uint8Array
  emit(connection.ws, 'message', binary.buffer)

  deepStrictEqual(received, [['headers', { language: 'en', version: 2 }]])
})

test('round-trips debug message', async () => {
  let { connection, received } = await createConnection()

  connection.send(['debug', 'error', 'some error details'])
  let binary = connection.ws!.sent[0] as Uint8Array
  emit(connection.ws, 'message', binary.buffer)

  deepStrictEqual(received, [['debug', 'error', 'some error details']])
})

test('round-trips connect message without options', async () => {
  let { connection, received } = await createConnection()

  connection.send(['connect', 5, 'client:abc', 0])
  let binary = connection.ws!.sent[0] as Uint8Array
  emit(connection.ws, 'message', binary.buffer)

  deepStrictEqual(received, [['connect', 5, 'client:abc', 0]])
})

test('round-trips connect message with options', async () => {
  let { connection, received } = await createConnection()

  connection.send([
    'connect',
    5,
    'client:abc',
    10,
    { subprotocol: 3, token: 'secret' }
  ])
  let binary = connection.ws!.sent[0] as Uint8Array
  emit(connection.ws, 'message', binary.buffer)

  deepStrictEqual(received, [
    ['connect', 5, 'client:abc', 10, { subprotocol: 3, token: 'secret' }]
  ])
})

test('round-trips connected message without options', async () => {
  let { connection, received } = await createConnection()

  connection.send(['connected', 5, 'server:abc', [1000, 2000]])
  let binary = connection.ws!.sent[0] as Uint8Array
  emit(connection.ws, 'message', binary.buffer)

  deepStrictEqual(received, [['connected', 5, 'server:abc', [1000, 2000]]])
})

test('round-trips connected message with options', async () => {
  let { connection, received } = await createConnection()

  connection.send([
    'connected',
    5,
    'server:abc',
    [1000, 2000],
    { subprotocol: 2, token: 'tk' }
  ])
  let binary = connection.ws!.sent[0] as Uint8Array
  emit(connection.ws, 'message', binary.buffer)

  deepStrictEqual(received, [
    [
      'connected',
      5,
      'server:abc',
      [1000, 2000],
      { subprotocol: 2, token: 'tk' }
    ]
  ])
})

test('round-trips sync message with JSON action', async () => {
  let { connection, received } = await createConnection()

  connection.send([
    'sync',
    5,
    { name: 'Alice', type: 'user/add' },
    { id: 100, time: 200 }
  ])
  let binary = connection.ws!.sent[0] as Uint8Array
  emit(connection.ws, 'message', binary.buffer)

  deepStrictEqual(received, [
    ['sync', 5, { name: 'Alice', type: 'user/add' }, { id: 100, time: 200 }]
  ])
})

test('round-trips sync with multiple actions', async () => {
  let { connection, received } = await createConnection()

  connection.send([
    'sync',
    10,
    { type: 'a' },
    { id: 1, time: 2 },
    { type: 'b' },
    { id: [3, 4], time: 5 }
  ] as unknown as Message)
  let binary = connection.ws!.sent[0] as Uint8Array
  emit(connection.ws, 'message', binary.buffer)

  deepStrictEqual(received, [
    [
      'sync',
      10,
      { type: 'a' },
      { id: 1, time: 2 },
      { type: 'b' },
      { id: [3, 4], time: 5 }
    ]
  ])
})

test('round-trips sync with meta containing nodeId', async () => {
  let { connection, received } = await createConnection()

  connection.send([
    'sync',
    1,
    { type: 'test' },
    { id: [10, 'other:node', 2], subprotocol: 3, time: 50 }
  ] as unknown as Message)
  let binary = connection.ws!.sent[0] as Uint8Array
  emit(connection.ws, 'message', binary.buffer)

  deepStrictEqual(received, [
    [
      'sync',
      1,
      { type: 'test' },
      { id: [10, 'other:node', 2], subprotocol: 3, time: 50 }
    ]
  ])
})

test('round-trips logux/processed action', async () => {
  let { connection, received } = await createConnection()

  internal(connection).baseTime = 1000
  internal(connection).localNodeId = 'server:abc'
  internal(connection).remoteNodeId = 'server:abc'

  connection.send([
    'sync',
    1,
    { id: '1100 server:abc 0', type: 'logux/processed' },
    { id: 5, time: 10 }
  ])
  let binary = connection.ws!.sent[0] as Uint8Array
  emit(connection.ws, 'message', binary.buffer)

  deepStrictEqual(received, [
    [
      'sync',
      1,
      { id: '1100 server:abc 0', type: 'logux/processed' },
      { id: 5, time: 10 }
    ]
  ])
})

test('round-trips logux/processed with different nodeId', async () => {
  let { connection, received } = await createConnection()

  internal(connection).baseTime = 1000
  internal(connection).localNodeId = 'server:abc'
  internal(connection).remoteNodeId = 'server:abc'

  connection.send([
    'sync',
    1,
    { id: '1200 client:xyz 3', type: 'logux/processed' },
    { id: 5, time: 10 }
  ])
  let binary = connection.ws!.sent[0] as Uint8Array
  emit(connection.ws, 'message', binary.buffer)

  deepStrictEqual(received, [
    [
      'sync',
      1,
      { id: '1200 client:xyz 3', type: 'logux/processed' },
      { id: 5, time: 10 }
    ]
  ])
})

test('round-trips 0/clean action', async () => {
  let { connection, received } = await createConnection()

  internal(connection).baseTime = 1000
  internal(connection).localNodeId = 'server:abc'
  internal(connection).remoteNodeId = 'server:abc'

  connection.send([
    'sync',
    1,
    { id: '1050 server:abc 0', type: '0/clean' },
    { id: 3, time: 7 }
  ])
  let binary = connection.ws!.sent[0] as Uint8Array
  emit(connection.ws, 'message', binary.buffer)

  deepStrictEqual(received, [
    [
      'sync',
      1,
      { id: '1050 server:abc 0', type: '0/clean' },
      { id: 3, time: 7 }
    ]
  ])
})

test('round-trips encrypted 0 action without compression', async () => {
  let { connection, received } = await createConnection()

  let iv = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
  let d = new Uint8Array([100, 200, 50])

  connection.send(['sync', 1, { d, iv, type: '0' }, { id: 5, time: 10 }])
  let binary = connection.ws!.sent[0] as Uint8Array
  emit(connection.ws, 'message', binary.buffer)

  let syncMsg = received[0] as unknown as [
    string,
    number,
    { compressed?: boolean; d: Uint8Array; iv: Uint8Array; type: string },
    { id: number; time: number }
  ]
  equal(syncMsg[0], 'sync')
  equal(syncMsg[1], 1)
  equal(syncMsg[2].type, '0')
  deepStrictEqual(syncMsg[2].iv, iv)
  deepStrictEqual(syncMsg[2].d, d)
  equal(syncMsg[2].compressed, undefined)
  deepStrictEqual(syncMsg[3], { id: 5, time: 10 })
})

test('round-trips encrypted 0 action with compression', async () => {
  let { connection, received } = await createConnection()

  let iv = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
  let d = new Uint8Array([100, 200, 50])

  connection.send([
    'sync',
    1,
    { compressed: true, d, iv, type: '0' },
    { id: 5, time: 10 }
  ])
  let binary = connection.ws!.sent[0] as Uint8Array
  emit(connection.ws, 'message', binary.buffer)

  let syncMsg = received[0] as unknown as [
    string,
    number,
    { compressed?: boolean }
  ]
  equal(syncMsg[2].compressed, true)
})

test('handles large varint values', async () => {
  let { connection, received } = await createConnection()

  connection.send([
    'connected',
    5,
    'server:abc',
    [1774000000000, 1774000001000]
  ])
  let binary = connection.ws!.sent[0] as Uint8Array
  emit(connection.ws, 'message', binary.buffer)

  deepStrictEqual(received, [
    ['connected', 5, 'server:abc', [1774000000000, 1774000001000]]
  ])
})

test('handles varint boundary values', async () => {
  let { connection, received } = await createConnection()

  connection.send(['ping', 127])
  emit(connection.ws, 'message', (connection.ws!.sent[0] as Uint8Array).buffer)
  connection.send(['ping', 128])
  emit(connection.ws, 'message', (connection.ws!.sent[1] as Uint8Array).buffer)
  connection.send(['ping', 16383])
  emit(connection.ws, 'message', (connection.ws!.sent[2] as Uint8Array).buffer)
  connection.send(['ping', 16384])
  emit(connection.ws, 'message', (connection.ws!.sent[3] as Uint8Array).buffer)

  deepStrictEqual(received, [
    ['ping', 127],
    ['ping', 128],
    ['ping', 16383],
    ['ping', 16384]
  ])
})

test('receives text JSON messages as fallback', async () => {
  let { connection, received } = await createConnection()

  emit(connection.ws, 'message', '["ping",1]')

  deepStrictEqual(received, [['ping', 1]])
})

test('receives text protocol in binary frame', async () => {
  let { connection, received } = await createConnection()

  let textEncoder = new TextEncoder()
  let data = textEncoder.encode('["ping",1]')
  emit(connection.ws, 'message', data.buffer)

  deepStrictEqual(received, [['ping', 1]])
})

test('emits error on invalid binary data', async () => {
  let { connection } = await createConnection()
  let error: Error | undefined
  connection.on('error', err => {
    error = err
  })

  let invalid = new Uint8Array([0xff, 0x00]).buffer
  emit(connection.ws, 'message', invalid)

  if (typeof error === 'undefined') throw new Error('Error was not sent')
  equal(error.message, 'Wrong message format')
  equal((error as ErrorWithReceived).received, 'ff 00')
})

test('emits error on invalid text data', async () => {
  let { connection } = await createConnection()
  let error: Error | undefined
  connection.on('error', err => {
    error = err
  })

  emit(connection.ws, 'message', '{invalid')

  if (typeof error === 'undefined') throw new Error('Error was not sent')
  equal(error.message, 'Wrong message format')
  equal((error as ErrorWithReceived).received, '{invalid')
})

test('emits connection states', async () => {
  let connection = new WsBinaryConnection<FakeWebSocket>(
    'ws://localhost',
    FakeWebSocket
  )

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
})

test('closes WebSocket', async () => {
  let { connection } = await createConnection()
  let ws = connection.ws!
  let close = spyOn(ws, 'close')

  connection.disconnect()
  equal(close.callCount, 1)
  equal(connection.connected, false)
})

test('does not send to closed socket', async () => {
  let { connection } = await createConnection()
  let errors: string[] = []
  connection.on('error', e => {
    errors.push(e.message)
  })

  connection.ws!.readyState = 2
  connection.send(['ping', 1])
  deepStrictEqual(errors, ['WS was closed'])
})

test('tracks context from connect/connected messages', async () => {
  let { connection } = await createConnection()

  connection.send(['connect', 5, 'client:abc', 0])
  equal(internal(connection).localNodeId, 'client:abc')

  connection.send([
    'connected',
    5,
    'server:xyz',
    [1000, 2000],
    { subprotocol: 3 }
  ])
  equal(internal(connection).localNodeId, 'server:xyz')
  equal(internal(connection).baseTime, 2000)
  equal(internal(connection).connectedSubprotocol, 3)
})

test('tracks context from incoming connect/connected', async () => {
  let { connection } = await createConnection()

  connection.send(['connect', 5, 'client:abc', 0])
  let connectBinary = connection.ws!.sent[0] as Uint8Array
  emit(connection.ws, 'message', connectBinary.buffer)
  equal(internal(connection).remoteNodeId, 'client:abc')
})

test('meta format 4 with subprotocol', async () => {
  let { connection, received } = await createConnection()

  internal(connection).connectedSubprotocol = 1

  connection.send([
    'sync',
    1,
    { type: 'test' },
    { id: [5, 2], subprotocol: 7, time: 10 }
  ] as unknown as Message)
  let binary = connection.ws!.sent[0] as Uint8Array
  emit(connection.ws, 'message', binary.buffer)

  deepStrictEqual(received, [
    ['sync', 1, { type: 'test' }, { id: [5, 2], subprotocol: 7, time: 10 }]
  ])
})

test('meta omits subprotocol when matching connected value', async () => {
  let { connection, received } = await createConnection()

  internal(connection).connectedSubprotocol = 5

  connection.send([
    'sync',
    1,
    { type: 'test' },
    { id: [3, 2], subprotocol: 5, time: 10 }
  ] as unknown as Message)
  let binary = connection.ws!.sent[0] as Uint8Array
  emit(connection.ws, 'message', binary.buffer)

  let syncMsg = received[0] as unknown as [
    string,
    number,
    unknown,
    { subprotocol?: number }
  ]
  equal(syncMsg[3].subprotocol, undefined)
})

test('handles unicode strings', async () => {
  let { connection, received } = await createConnection()

  connection.send(['connect', 5, 'клиент:日本語', 0])
  let binary = connection.ws!.sent[0] as Uint8Array
  emit(connection.ws, 'message', binary.buffer)

  deepStrictEqual(received, [['connect', 5, 'клиент:日本語', 0]])
})

test('encodes ping as 2 bytes for small values', async () => {
  let { connection } = await createConnection()

  connection.send(['ping', 0])
  let binary = connection.ws!.sent[0] as Uint8Array
  // 'p' (0x70) + varint(0) = 2 bytes
  equal(binary.length, 2)
  equal(binary[0], 0x70)
  equal(binary[1], 0)
})

test('switches to text mode on receiving text message', async () => {
  let { connection } = await createConnection()

  equal(connection.textMode, false)

  emit(connection.ws, 'message', '["ping",1]')
  equal(connection.textMode, true)

  connection.send(['pong', 1])
  let sent = connection.ws!.sent[0]
  equal(typeof sent, 'string')
  equal(sent, '["pong",1]')
})

test('switches to text mode on receiving text in binary frame', async () => {
  let { connection } = await createConnection()

  let textEncoder = new TextEncoder()
  let data = textEncoder.encode('["ping",1]')
  emit(connection.ws, 'message', data.buffer)
  equal(connection.textMode, true)

  connection.send(['pong', 1])
  let sent = connection.ws!.sent[0]
  equal(typeof sent, 'string')
})

test('stays in binary mode on receiving binary message', async () => {
  let { connection } = await createConnection()

  connection.send(['ping', 1])
  let binary = connection.ws!.sent[0] as Uint8Array
  emit(connection.ws, 'message', binary.buffer)
  equal(connection.textMode, false)

  connection.send(['pong', 1])
  ok(connection.ws!.sent[1] instanceof Uint8Array)
})
