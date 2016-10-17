/**
 * Wrapper for {@link Connection} to try reconnect it on evert disconnect.
 *
 * @param {Connection} connection The connection to be reconnectable
 * @param {object} options options
 *
 * @example
 * import { Reconnect } from 'logux-sync'
 * const recon = new Reconnect(connection)
 * ClientHost(uniqHost, log, recon, options)
 *
 * @class
 * @extends Connection
 */
function Reconnect (connection, options) {
  this.connection = connection
  this.options = options || { }

  /**
   * Should we reconnect connection on next connection break.
   * Next {@link Reconnect#connect} call will set to `true`.
   * @type {boolean}
   *
   * @example
   * function pause() {
   *   recon.reconnecting = false
   *   recon.disconnect()
   * }
   */
  this.reconnecting = connection.connected

  this.unbind = []
  var self = this

  this.unbind.push(this.connection.on('message', function (msg) {
    if (msg[0] === 'error' && msg[2] === 'protocol') {
      self.reconnecting = false
    }
  }))
  this.unbind.push(this.connection.on('disconnect', function () {
    if (self.reconnecting) self.reconnect()
  }))
}

Reconnect.prototype = {

  connect: function connect () {
    this.reconnecting = true
    return this.connection.connect()
  },

  disconnect: function disconnect () {
    this.reconnecting = false
    return this.connection.disconnect()
  },

  /**
   * Unbind all listeners and disconnect. Use it if you will not need
   * this class anymore.
   *
   * {@link BaseSync#destroy} will call this method instead
   * of {@link Reconnect#disconnect}.
   *
   * @return {undefined}
   */
  destroy: function destroy () {
    for (var i = 0; i < this.unbind.length; i++) {
      this.unbind[i]()
    }
    this.disconnect()
  },

  reconnect: function reconnect () {
    this.connect()
  },

  send: function send () {
    return this.connection.send.apply(this.connection, arguments)
  },

  on: function on () {
    return this.connection.on.apply(this.connection, arguments)
  }

}

Object.defineProperty(Reconnect.prototype, 'connected', {
  get: function () {
    return this.connection.connected
  }
})

module.exports = Reconnect
