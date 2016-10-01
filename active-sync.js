var assign = require('object-assign')

var BaseSync = require('./base-sync')

/**
 * Active node in synchronization pair.
 *
 * Instead of passive node, it initializes synchronization,
 * remembers synchronization state.
 *
 * For example, active sync is used for browser clients and passive for servers.
 *
 * @param {string} host Unique current host name.
 * @param {Log} log Logux log instance to sync with other node log.
 * @param {Connection} connection Connection to other node.
 * @param {object} [options] Synchronization options.
 * @param {object} [option.credentials] This sync node credentials.
 *                                      For example, access token.
 * @param {authCallback} [option.auth] Function to check
 *                                     other node credentials.
 * @param {boolean} [options.fixTime=false] Enables log’s event time fixes
 *                                          to prevent problems
 *                                          because of wrong client time zone.
 * @param {number} [option.timeout=0] Timeout in milliseconds
 *                                    to disconnect connection.
 * @param {number} [option.ping=0] Milliseconds since last message to test
 *                                 connection by sending ping.
 * @param {filter} [option.inFilter] Function to filter events
 *                                   from other client. Best place
 *                                   for access control.
 * @param {mapper} [option.inMap] Map function to change event
 *                                before put it to current log.
 * @param {filter} [option.outFilter] Filter function to select events
 *                                    to synchronization.
 * @param {mapper} [option.outMap] Map function to change event
 *                                 before sending it to other client.
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
    BaseSync.prototype.onConnect.apply(this, arguments)
    this.sendConnect()
    this.syncSince(this.synced)
  }

}

ActiveSync.prototype = assign({ }, BaseSync.prototype, ActiveSync.prototype)

module.exports = ActiveSync
