var assign = require('object-assign')

var BaseSync = require('./base-sync')

var DEFAULT_OPTIONS = {
  fixTime: true,
  timeout: 20000,
  ping: 5000
}

/**
 * Client node in synchronization pair.
 *
 * Instead of server node, it initializes synchronization
 * and sends connect message.
 *
 * @param {string|number} nodeId Unique current machine name.
 * @param {Log} log Logux log instance to sync with other node log.
 * @param {Connection} connection Connection to other node.
 * @param {object} [options] Synchronization options.
 * @param {object} [options.credentials] Client credentials.
 *                                       For example, access token.
 * @param {authCallback} [options.auth] Function to check server credentials.
 * @param {boolean} [options.fixTime=true] Detect difference between client
 *                                         and server and fix time
 *                                         in synchronized actions.
 * @param {number} [options.timeout=20000] Timeout in milliseconds
 *                                         to wait answer before disconnect.
 * @param {number} [options.ping=5000] Milliseconds since last message to test
 *                                     connection by sending ping.
 * @param {filter} [options.inFilter] Function to filter actions from server.
 *                                    Best place for permissions control.
 * @param {mapper} [options.inMap] Map function to change other node’s action
 *                                 before put it to current log.
 * @param {filter} [options.outFilter] Filter function to select actions
 *                                     to synchronization.
 * @param {mapper} [options.outMap] Map function to change action
 *                                  before sending it to other client.
 * @param {number[]} [options.subprotocol] Application subprotocol version.
 * @param {string} [options.subprotocol] Application subprotocol version
 *                                       in SemVer format.
 *
 * @example
 * import { ClientSync } from 'logux-sync'
 * const connection = new BrowserConnection(url)
 * const sync = new ClientSync(nodeId, log, connection)
 *
 * @extends BaseSync
 * @class
 */
function ClientSync (nodeId, log, connection, options) {
  options = assign({ }, DEFAULT_OPTIONS, options)
  BaseSync.call(this, nodeId, log, connection, options)
}

ClientSync.prototype = {

  onConnect: function onConnect () {
    if (!this.connected) {
      this.connected = true
      var sync = this
      this.initializing = this.initializing.then(function () {
        sync.sendConnect()
      })
    }
  }

}

ClientSync.prototype = assign({ }, BaseSync.prototype, ClientSync.prototype)

module.exports = ClientSync
