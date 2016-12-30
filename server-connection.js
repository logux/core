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
 */
function ServerConnection (ws) {
  /**
   * Is connection is enabled.
   * @type {boolean}
   */
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

  /**
   * Part of Connection API, but could not be released for this connection.
   *
   * @return {undefined}
   */
  connect: function connect () {
    throw new Error('ServerConnection accepts already connected WebSocket ' +
                    'instance and could not reconnect it')
  },

  /**
   * Finish current connection.
   *
   * After disconnection, connection could be started again
   * by @{link Connection#connect}.
   *
   * @return {undefined}
   */
  disconnect: function disconnect () {
    this.ws.close()
  },

  /*
   * Subscribe for connection events. It should implement nanoevents API.
   * Supported events:
   *
   * * `disconnect`: connection was closed by any side.
   * * `message`: message was receive from other node.
   * * `error`: message was wrong.
   *
   * @param {"disconnect"|"message"|"error"} event The event name.
   * @param {function} listener The listener function.
   *
   * @return {function} Unbind listener from event.
   */
  on: function on (event, listener) {
    return this.emitter.on(event, listener)
  },

  /**
   * Send message to connection.
   *
   * @param {Message} message Message to be sent
   *
   * @return {undefined}
   */
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
