var assign = require('object-assign')

var BaseSync = require('./base-sync')

/**
 * Passive client in synchronization pair.
 *
 * Instead of active client, it doesn’t initialize synchronization
 * and doesn’t remember synchronization state. It destroy itself on disconnect.
 *
 * For example, passive sync is used for server and active for browser clients.
 *
 * @param {string} host Unique current host name.
 * @param {Log} log Logux log instance to sync with other client log.
 * @param {Connection} connection Connection to other client.
 * @param {object} [options] Synchronization options.
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
}

PassiveSync.prototype = {

  onDisconnect: function onDisconnect () {
    BaseSync.prototype.onDisconnect.call(this)
    this.destroy()
  }

}

PassiveSync.prototype = assign({ }, BaseSync.prototype, PassiveSync.prototype)

module.exports = PassiveSync
