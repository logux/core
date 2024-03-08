import { delay } from 'nanodelay'
import { deepStrictEqual, equal } from 'node:assert'
import { afterEach, test } from 'node:test'
import WebSocket, { WebSocketServer } from 'ws'

import { type Message, ServerConnection, WsConnection } from '../index.js'

let wss: WebSocket.Server
afterEach(() => {
  wss.close()
})

function connect(
  server: WebSocket.Server,
  client: WsConnection
): Promise<ServerConnection> {
  return new Promise(resolve => {
    server.on('connection', ws => {
      let connection = new ServerConnection(ws)
      resolve(connection)
    })
    client.connect()
  })
}

test('works in real protocol', async () => {
  wss = new WebSocketServer({ port: 8081 })

  let client = new WsConnection('ws://0.0.0.0:8081', WebSocket)
  let clientReceived: Message[] = []
  client.on('message', msg => {
    clientReceived.push(msg)
  })

  let server = await connect(wss, client)

  let serverReceived: Message[] = []
  server.on('message', msg => {
    serverReceived.push(msg)
  })

  await delay(100)
  equal(server.connected, true)
  equal(client.connected, true)

  client.send(['ping', 1])
  await delay(100)
  deepStrictEqual(serverReceived, [['ping', 1]])

  server.send(['pong', 1])
  await delay(100)
  deepStrictEqual(clientReceived, [['pong', 1]])

  server.disconnect()
  await delay(100)
  equal(server.connected, false)
  equal(client.connected, false)
})
