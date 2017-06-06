var NanoEvents = require('nanoevents')

function LocalConnection (pair, type) {
  this.connected = false
  this.emitter = new NanoEvents()
  this.type = type
  this.pair = pair
}

LocalConnection.prototype = {

  other: function other () {
    if (this.type === 'left') {
      return this.pair.right
    } else {
      return this.pair.left
    }
  },

  on: function on (event, listener) {
    return this.emitter.on(event, listener)
  },

  connect: function connect () {
    if (this.connected) {
      throw new Error('Connection already established')
    } else {
      this.emitter.emit('connecting')
      var self = this
      return new Promise(function (resolve) {
        setTimeout(function () {
          self.other().connected = true
          self.connected = true
          self.other().emitter.emit('connect')
          self.emitter.emit('connect')
          resolve()
        }, self.pair.delay)
      })
    }
  },

  disconnect: function disconnect (reason) {
    if (!this.connected) {
      throw new Error('Connection already finished')
    } else {
      this.connected = false
      this.emitter.emit('disconnect', reason)
      var self = this
      return new Promise(function (resolve) {
        setTimeout(function () {
          self.other().connected = false
          self.other().emitter.emit('disconnect')
          resolve()
        }, 1)
      })
    }
  },

  send: function send (message) {
    if (this.connected) {
      var self = this
      setTimeout(function () {
        self.other().emitter.emit('message', message)
      }, self.pair.delay)
    } else {
      throw new Error('Connection should be started before sending a message')
    }
  }

}

/**
 * Two paired loopback connections.
 *
 * @param {number} [delay=1] Delay for connection and send events.
 *
 * @example
 * import { LocalPair } from 'logux-sync'
 * const pair = new LocalPair()
 * const client = new ClientSync(pair.left)
 * const server = new ServerSync(pair.right)
 *
 * @class
 */
function LocalPair (delay) {
  /**
   * Delay for connection and send events to emulate real connection latency.
   * @type {number}
   */
  this.delay = delay || 1
  /**
   * First connection. Will be connected to {@link LocalPair#right} one
   * after {@link Connection#connect}.
   * @type {Connection}
   *
   * @example
   * new ClientSync(pair.left)
   */
  this.left = new LocalConnection(this, 'left')
  /**
   * Second connection. Will be connected to {@link LocalPair#left} one
   * after {@link Connection#connect}.
   * @type {Connection}
   *
   * @example
   * new ServerSync(pair.right)
   */
  this.right = new LocalConnection(this, 'right')
}

LocalPair.prototype = { }

module.exports = LocalPair
