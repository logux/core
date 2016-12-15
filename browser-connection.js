var NanoEvents = require('nanoevents')

/**
 * Logux connection for browser WebSocket.
 *
 * @param {string} url WebSocket server URL.
 *
 * @example
 * import { BrowserConnection } from 'logux-websocket'
 *
 * const connection = new BrowserConnection('wss://logux.example.com/')
 * const sync = new ClientSync(nodeId, log, connection, opts)
 *
 * @class
 */
function BrowserConnection (url) {
  /**
   * Is connection is enabled.
   * @type {boolean}
   */
  this.connected = false
  this.emitter = new NanoEvents()

  this.url = url
}

BrowserConnection.prototype = {

  /**
   * Start connection. Connection should be in disconnected state
   * from the beginning and start connection only on this method call.
   *
   * This method could be called again if connection moved
   * to disconnected state.
   *
   * @return {undefined}
   */
  connect: function connect () {
    if (!window.WebSocket) {
      throw new Error('Browser has no WebSocket support')
    }

    this.emitter.emit('connecting')
    this.ws = new window.WebSocket(this.url)
    var self = this

    this.ws.onopen = function () {
      self.connected = true
      self.emitter.emit('connect')
    }

    this.ws.onclose = function () {
      self.connected = false
      self.emitter.emit('disconnect')
    }

    this.ws.onmessage = function (event) {
      var data
      try {
        data = JSON.parse(event.data)
      } catch (e) {
        self.error(event.data)
        return
      }
      self.emitter.emit('message', data)
    }
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
    if (this.ws) {
      this.ws.close()
      this.ws.onclose()
      this.ws = undefined
    }
  },

  /*
   * Subscribe for connection events. It should implement nanoevents API.
   * Supported events:
   *
   * * `connecting`: connection establishing was started.
   * * `connect`: connection was established by any side.
   * * `disconnect`: connection was closed by any side.
   * * `message`: message was receive from other node.
   * * `error`: message was wrong.
   *
   * @param {"connecting"|"connect"|"disconnect"|"message"|"error"} event Event.
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
    if (this.ws) {
      this.ws.send(JSON.stringify(message))
    } else {
      throw new Error('Start a connection before send a message')
    }
  },

  error: function error (message) {
    var err = new Error('Wrong message format')
    err.received = message
    this.emitter.emit('error', err)
  }

}

module.exports = BrowserConnection
