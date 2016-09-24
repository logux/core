var NanoEvents = require('nanoevents')

/**
 * Loopback connection to be used in test.
 * It should be created by @{link LocalPair}.
 *
 * @param {LocalPair} pair Pair that created this connection.
 * @param {"left"|"right"} type Current connect type to find other.
 *
 * @class
 */
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
      this.connected = true
      this.other().connected = true
      this.emitter.emit('connect')
      this.other().emitter.emit('connect')
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
   * First connection
   * @type {LocalConnection}
   *
   * @example
   * new ActiveSync(pair.left)
   */
  this.left = new LocalConnection(this, 'left')
  /**
   * Second connection
   * @type {LocalConnection}
   *
   * @example
   * new PassiveSync(pair.right)
   */
  this.right = new LocalConnection(this, 'right')
}

LocalPair.prototype = { }

module.exports = LocalPair
