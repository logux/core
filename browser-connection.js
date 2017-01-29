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
 * @extends Connection
 */
function BrowserConnection (url) {
  this.connected = false
  this.emitter = new NanoEvents()

  this.url = url
}

BrowserConnection.prototype = {

  connect: function connect () {
    if (!window.WebSocket) {
      throw new Error('Browser has no WebSocket support')
    }

    this.emitter.emit('connecting')
    this.ws = new window.WebSocket(this.url)
    var self = this

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

    return new Promise(function (resolve) {
      self.ws.onopen = function () {
        self.connected = true
        self.emitter.emit('connect')
        resolve()
      }
    })
  },

  disconnect: function disconnect () {
    if (this.ws) {
      this.ws.close()
      this.ws.onclose()
      this.ws = undefined
    }
  },

  on: function on (event, listener) {
    return this.emitter.on(event, listener)
  },

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
