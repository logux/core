var assign = require('object-assign')

var BaseSync = require('./base-sync')

/**
 * Active node in synchronization pair.
 *
 * Instead of passive node, it initializes synchronization.
 *
 * For example, active sync is used for browser clients and passive for servers.
 *
 * @param {string} host Unique current host name.
 * @param {Log} log Logux log instance to sync with other node log.
 * @param {Connection} connection Connection to other node.
 * @param {object} [options] Synchronization options.
 * @param {object} [options.credentials] This node credentials.
 *                                       For example, access token.
 * @param {authCallback} [options.auth] Function to check
 *                                      other node credentials.
 * @param {boolean} [options.fixTime=false] Enables log’s event time fixes
 *                                          to prevent problems
 *                                          because of wrong client time zone.
 * @param {number} [options.timeout=0] Timeout in milliseconds
 *                                     to disconnect connection.
 * @param {number} [options.ping=0] Milliseconds since last message to test
 *                                  connection by sending ping.
 * @param {filter} [options.inFilter] Function to filter events
 *                                    from other client. Best place
 *                                    for access control.
 * @param {mapper} [options.inMap] Map function to change event
 *                                 before put it to current log.
 * @param {filter} [options.outFilter] Filter function to select events
 *                                     to synchronization.
 * @param {mapper} [options.outMap] Map function to change event
 *                                  before sending it to other client.
 * @param {number} [options.synced=0] Events with lower `added` time in current
 *                                    log will not be synchronized.
 * @param {number} [options.otherSynced=0] Events with lower `added` time
 *                                         in other node’s log
 *                                         will not be synchronized.
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
  }

}

ActiveSync.prototype = assign({ }, BaseSync.prototype, ActiveSync.prototype)

module.exports = ActiveSync
