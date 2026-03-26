import { delay } from 'nanodelay'
import { deepStrictEqual, equal } from 'node:assert'
import { afterEach, test } from 'node:test'
import WebSocket, { WebSocketServer } from 'ws'

import {
  type Message,
  ServerConnection,
  WsBinaryConnection,
  WsConnection
} from '../index.js'

let wss: WebSocketServer
afterEach(() => {
  wss.close()
})

function createPair(
  Client: typeof WsBinaryConnection | typeof WsConnection
): Promise<{
  client: WsBinaryConnection | WsConnection
  clientReceived: Message[]
  server: ServerConnection
  serverReceived: Message[]
}> {
  wss = new WebSocketServer({ port: 0 })
  let port = (wss.address() as { port: number }).port

  let client = new Client(`ws://0.0.0.0:${port}`, WebSocket)
  let clientReceived: Message[] = []
  client.on('message', msg => {
    clientReceived.push(msg)
  })

  return new Promise(resolve => {
    wss.on('connection', ws => {
      let server = new ServerConnection(ws)
      let serverReceived: Message[] = []
      server.on('message', msg => {
        serverReceived.push(msg)
      })
      resolve({ client, clientReceived, server, serverReceived })
    })
    client.connect()
  })
}

test('binary client and binary server exchange messages', async () => {
  let { client, clientReceived, server, serverReceived } =
    await createPair(WsBinaryConnection)

  await delay(100)
  equal(server.connected, true)
  equal(client.connected, true)
  equal(client.textMode, false)
  equal(server.textMode, false)

  client.send(['ping', 1])
  await delay(100)
  deepStrictEqual(serverReceived, [['ping', 1]])

  server.send(['pong', 1])
  await delay(100)
  deepStrictEqual(clientReceived, [['pong', 1]])

  equal(client.textMode, false)
  equal(server.textMode, false)

  server.disconnect()
  await delay(100)
  equal(server.connected, false)
  equal(client.connected, false)
})

test('text client triggers textMode on binary server', async () => {
  let { client, clientReceived, server, serverReceived } =
    await createPair(WsConnection)

  await delay(100)
  equal(server.connected, true)
  equal(client.connected, true)

  client.send(['ping', 1])
  await delay(100)
  deepStrictEqual(serverReceived, [['ping', 1]])
  equal(server.textMode, true)

  server.send(['pong', 1])
  await delay(100)
  deepStrictEqual(clientReceived, [['pong', 1]])

  server.disconnect()
  await delay(100)
  equal(server.connected, false)
  equal(client.connected, false)
})
