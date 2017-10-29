var WebSocket = require('ws')
var delay = require('nanodelay')

var BrowserConnection = require('../browser-connection')
var ServerConnection = require('../server-connection')

var wss
afterEach(function () {
  wss.close()
})

it('works in real protocol', function () {
  window.WebSocket = WebSocket
  wss = new WebSocket.Server({ port: 8081 })

  var client = new BrowserConnection('ws://0.0.0.0:8081')
  var clientReceived = []
  client.on('message', function (msg) {
    clientReceived.push(msg)
  })

  var server
  var serverReceived = []
  return new Promise(function (resolve) {
    wss.on('connection', function (ws) {
      server = new ServerConnection(ws)
      server.on('message', function (msg) {
        serverReceived.push(msg)
      })
      resolve()
    })
    client.connect()
  }).then(function () {
    return delay(50)
  }).then(function () {
    expect(server.connected).toBeTruthy()
    expect(client.connected).toBeTruthy()
    client.send(['test'])
    return delay(50)
  }).then(function () {
    expect(serverReceived).toEqual([['test']])
    server.send(['test'])
    return delay(50)
  }).then(function () {
    expect(clientReceived).toEqual([['test']])
    server.disconnect()
    return delay(50)
  }).then(function () {
    expect(server.connected).toBeFalsy()
    expect(client.connected).toBeFalsy()
  })
})
