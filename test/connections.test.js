let WebSocket = require('ws')
let delay = require('nanodelay')

let ServerConnection = require('../server-connection')
let WsConnection = require('../ws-connection')

let wss
afterEach(() => {
  wss.close()
})

it('works in real protocol', async () => {
  wss = new WebSocket.Server({ port: 8081 })

  let client = new WsConnection('ws://0.0.0.0:8081', WebSocket)
  let clientReceived = []
  client.on('message', msg => {
    clientReceived.push(msg)
  })

  let server
  let serverReceived = []
  await new Promise(resolve => {
    wss.on('connection', ws => {
      server = new ServerConnection(ws)
      server.on('message', msg => {
        serverReceived.push(msg)
      })
      resolve()
    })
    client.connect()
  })
  await delay(100)
  expect(server.connected).toBe(true)
  expect(client.connected).toBe(true)
  client.send(['test'])
  await delay(100)
  expect(serverReceived).toEqual([['test']])
  server.send(['test'])
  await delay(100)
  expect(clientReceived).toEqual([['test']])
  server.disconnect()
  await delay(100)
  expect(server.connected).toBe(false)
  expect(client.connected).toBe(false)
})
