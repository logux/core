var NanoEvents = require('nanoevents')

/**
 * Logux connection for server WebSocket.
 *
 * @param {WebSocket} ws WebSocket instance
 *
 * @example
 * import { ServerConnection } from 'logux-websocket'
 * import { Server } from 'ws'
 *
 * wss.on('connection', function connection(ws) {
 *   const connection = new ServerConnection(ws)
 *   const sync = new ServerSync('server', log, connection, opts)
 * })
 *
 * @class
 * @extends Connection
 */
function ServerConnection (ws) {
  this.connected = true
  this.emitter = new NanoEvents()
  this.ws = ws
  var self = this

  this.ws.on('message', function (msg) {
    var data
    try {
      data = JSON.parse(msg)
    } catch (e) {
      self.error(msg)
      return
    }
    self.emitter.emit('message', data)
  })

  this.ws.on('close', function () {
    self.connected = false
    self.emitter.emit('disconnect')
  })
}

ServerConnection.prototype = {

  connect: function connect () {
    throw new Error('ServerConnection accepts already connected WebSocket ' +
                    'instance and could not reconnect it')
  },

  disconnect: function disconnect () {
    this.ws.close()
  },

  on: function on (event, listener) {
    return this.emitter.on(event, listener)
  },

  send: function send (message) {
    var json = JSON.stringify(message)
    try {
      this.ws.send(json)
    } catch (e) {
      this.emitter.emit('error', e)
    }
  },

  error: function error (message) {
    var err = new Error('Wrong message format')
    err.received = message
    this.emitter.emit('error', err)
  }

}

module.exports = ServerConnection
