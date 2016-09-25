var assign = require('object-assign')

var BaseSync = require('./base-sync')

/**
 * Active client in synchronization pair.
 *
 * Instead of passive client, it initializes synchronization,
 * remembers synchronization state.
 *
 * For example, active sync is used for browser clients and passive for servers.
 *
 * @param {string} host Unique current host name.
 * @param {Log} log Logux log instance to sync with other client log.
 * @param {Connection} connection Connection to other client.
 * @param {object} [options] Synchronization options.
 *
 * @example
 * import { ActiveSync } from 'logux-sync'
 * const connection = new WebSocketsConnection(destination)
 * const sync = new ActiveSync('user' + id, log, connection)
 *
 * @extends BaseSync
 * @class
 */
function ActiveSync (host, log, connection, options) {
  BaseSync.call(this, host, log, connection, options)
}

ActiveSync.prototype = {

  onConnect: function onConnect () {
    BaseSync.prototype.onConnect.call(this)
    this.sendConnect()
  }

}

ActiveSync.prototype = assign({ }, BaseSync.prototype, ActiveSync.prototype)

module.exports = ActiveSync
