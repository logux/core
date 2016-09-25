var NanoEvents = require('nanoevents')
var assign = require('object-assign')

var error = require('./messages/error')

/**
 * Base methods for synchronization clients. Active and passive clients are
 * based on this module.
 *
 * @param {string} host Unique current host name.
 * @param {Log} log Logux log instance to sync with other client log.
 * @param {Connection} connection Connection to other client.
 * @param {object} [options] Synchronization options.
 *
 * @abstract
 * @class
 */
function BaseSync (host, log, connection, options) {
  /**
   * Unique current host name.
   * @type {string}
   */
  this.host = host
  /**
   * Log to synchronization.
   * @type {Log}
   */
  this.log = log
  /**
   * Connection used to communicate to other client.
   * @type {Connection}
   */
  this.connection = connection
  /**
   * Options used to create client.
   * @type {object}
   */
  this.options = options || { }

  /**
   * Is synchronization in process.
   * @type {boolean}
   *
   * @example
   * sync.on('disconnect', () => {
   *   sync.connected //=> false
   * })
   */
  this.connected = false

  this.throwsError = true
  this.emitter = new NanoEvents()

  this.unbind = []
  var self = this
  this.unbind.push(log.on('event', function () { }))
  this.unbind.push(connection.on('connect', function () {
    self.onConnect()
  }))
  this.unbind.push(connection.on('message', function (message) {
    self.onMessage(message)
  }))
  this.unbind.push(connection.on('disconnect', function () {
    self.onDisconnect()
  }))
}

BaseSync.prototype = {

  /**
   * Array with major and minor versions of used protocol.
   * @type {number[]}
   *
   * @example
   * if (sync.protocol[0] !== 1) {
   *   throw new Error('Unsupported Logux protocol')
   * }
   */
  protocol: [0, 0],

  /**
   * Subscribe for synchronization events. It implements nanoevents API.
   * Supported events:
   *
   * * `disconnect`: other client was disconnected.
   *
   * @param {"disconnect"} event The event name.
   * @param {listener} listener The listener function.
   *
   * @return {function} Unbind listener from event.
   *
   * @example
   * sync.on('disconnect', error => {
   *   showDisconnectBadge()
   * })
   */
  on: function on (event, listener) {
    return this.emitter.on(event, listener)
  },

  /**
   * Disable throwing a error on error message and create error listener.
   *
   * @param {errorListener} listener The listener function.
   *
   * @return {undefined}
   *
   * @example
   * sync.catch(error => {
   *   console.error(error)
   * })
   */
  catch: function (listener) {
    this.throwsError = false
    this.on('error', listener)
  },

  /**
   * Add one-time listener for synchronization events.
   * See {@link PassiveSync#on} for supported events.
   *
   * @param {"error"|"disconnect"} event The event name.
   * @param {listener} listener The listener function.
   *
   * @return {function} Unbind listener from event.
   *
   * @example
   * sync.once('error', () => {
   *   everythingFine = false
   * })
   */
  once: function once (event, listener) {
    return this.emitter.once(event, listener)
  },

  /**
   * Shut down the connection and unsubscribe from log events.
   *
   * @return {undefined}
   *
   * @example
   * connection.on('disconnect', () => {
   *   server.destroy()
   * })
   */
  destroy: function destory () {
    if (this.connected) this.connection.disconnect()
    for (var i = 0; i < this.unbind.length; i++) {
      this.unbind[i]()
    }
  },

  send: function send (msg) {
    if (this.connected) {
      this.connection.send(msg)
    } else {
      throw new Error('Could not send message to disconnected connection')
    }
  },

  onConnect: function onConnect () {
    this.connected = true
  },

  onDisconnect: function onDisconnect () {
    this.emitter.emit('disconnect')
    this.connected = false
  },

  onMessage: function onMessage (msg) {
    if (typeof msg !== 'object' || typeof msg.length !== 'number') {
      var json = JSON.stringify(msg)
      this.sendError('Wrong message format in ' + json, 'protocol')
      return
    }
    if (msg.length < 1 || typeof msg[0] !== 'string') {
      this.sendError('Wrong type in message ' + JSON.stringify(msg), 'protocol')
      return
    }

    var name = msg[0]
    var method = name + 'Message'
    if (typeof this[method] !== 'function') {
      this.sendError('Unknown message type `' + name + '`', 'protocol')
      return
    }

    var args = new Array(msg.length - 1)
    for (var i = 1; i < msg.length; i++) {
      args[i - 1] = msg[i]
    }
    this[method].apply(this, args)
  }

}

BaseSync.prototype = assign(BaseSync.prototype, error)

module.exports = BaseSync

/**
 * @callback errorListener
 * @param {string} error The error description.
 */
