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
      var self = this
      return new Promise(function (resolve) {
        setTimeout(function () {
          self.other().connected = true
          self.connected = true
          self.other().emitter.emit('connect')
          self.emitter.emit('connect')
          resolve()
        }, 1)
      })
    }
  },

  disconnect: function disconnect () {
    if (!this.connected) {
      throw new Error('Connection already finished')
    } else {
      this.connected = false
      this.emitter.emit('disconnect')
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
      }, 1)
    } else {
      throw new Error('Connection should be started before sending a message')
    }
  }

}

/**
 * Two paired loopback connections.
 *
 * @example
 * import { LocalPair } from 'logux-sync'
 * const pair = new LocalPair()
 * const client = new ClientSync(pair.left)
 * const server = new ServerSync(pair.right)
 *
 * @class
 */
function LocalPair () {
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
