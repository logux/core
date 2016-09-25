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
      this.other().connected = true
      this.connected = true
      this.other().emitter.emit('connect')
      this.emitter.emit('connect')
    }
  },

  disconnect: function disconnect () {
    if (this.connected) {
      this.connected = false
      this.other().connected = false
      this.emitter.emit('disconnect')
      this.other().emitter.emit('disconnect')
    } else {
      throw new Error('Connection already finished')
    }
  },

  send: function send (message) {
    if (this.connected) {
      this.other().emitter.emit('message', message)
    } else {
      throw new Error('Connection should be started before sending a message')
    }
  }

}

/**
 * Two paired loopback connections to be used in Logux tests
 *
 * @example
 * import { LocalPair } from 'logux-sync'
 * const pair = new LocalPair()
 * const client = new ActiveSync(pair.left)
 * const server = new PassiveSync(pair.right)
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
   * new ActiveSync(pair.left)
   */
  this.left = new LocalConnection(this, 'left')
  /**
   * Second connection. Will be connected to {@link LocalPair#left} one
   * after {@link Connection#connect}.
   * @type {Connection}
   *
   * @example
   * new PassiveSync(pair.right)
   */
  this.right = new LocalConnection(this, 'right')
}

LocalPair.prototype = { }

module.exports = LocalPair
