var assign = require('object-assign')

var BaseSync = require('./base-sync')

/**
 * Passive node in synchronization pair.
 *
 * Instead of active node, it doesn’t initialize synchronization
 * and doesn’t remember synchronization state. It destroy itself on disconnect.
 *
 * For example, passive sync is used for server and active for browser clients.
 *
 * @param {string} host Unique current host name.
 * @param {Log} log Logux log instance to sync with other node log.
 * @param {Connection} connection Connection to other node.
 * @param {object} [options] Synchronization options.
 * @param {object} [option.credentials] This sync node credentials.
 *                                      For example, access token.
 * @param {authCallback} [option.auth] Function to check
 *                                     other node credentials.
 *
 * @example
 * import { PassiveSync } from 'logux-sync'
 * startServer(ws => {
 *   const connection = new WSServerConnection(ws)
 *   const sync = new PassiveSync('server' + id, log, connection)
 * })
 *
 * @extends BaseSync
 * @class
 */
function PassiveSync (host, log, connection, options) {
  BaseSync.call(this, host, log, connection, options)
  if (this.options.fixTime) {
    throw new Error(
      'PassiveSync could not fix time. Set opts.fixTime for ActiveSync node.')
  }
}

PassiveSync.prototype = {

  onDisconnect: function onDisconnect () {
    BaseSync.prototype.onDisconnect.call(this)
    this.destroy()
  }

}

PassiveSync.prototype = assign({ }, BaseSync.prototype, PassiveSync.prototype)

module.exports = PassiveSync
