var assign = require('object-assign')

var BaseSync = require('./base-sync')

var DEFAULT_OPTIONS = {
  timeout: 20000,
  ping: 10000
}

/**
 * Server node in synchronization pair.
 *
 * Instead of client node, it doesn’t initialize synchronization
 * and destroy itself on disconnect.
 *
 * @param {string|number} nodeId Unique current machine name.
 * @param {Log} log Logux log instance to sync with other node log.
 * @param {Connection} connection Connection to other node.
 * @param {object} [options] Synchronization options.
 * @param {object} [options.credentials] Server credentials.
 *                                       For example, access token.
 * @param {authCallback} [options.auth] Function to check client credentials.
 * @param {number} [options.timeout=20000] Timeout in milliseconds
 *                                         to wait answer before disconnect.
 * @param {number} [options.ping=10000] Milliseconds since last message to test
 *                                      connection by sending ping.
 * @param {filter} [options.inFilter] Function to filter actions from client.
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
 * import { ServerSync } from 'logux-sync'
 * startServer(ws => {
 *   const connection = new ServerConnection(ws)
 *   const sync = new ServerSync('server' + id, log, connection)
 * })
 *
 * @extends BaseSync
 * @class
 */
function ServerSync (nodeId, log, connection, options) {
  options = assign({ }, DEFAULT_OPTIONS, options)
  BaseSync.call(this, nodeId, log, connection, options)

  if (this.options.fixTime) {
    throw new Error(
      'Logux Server could not fix time. Set opts.fixTime for Client node.')
  }

  this.state = 'connecting'
}

ServerSync.prototype = {

  onConnect: function onConnect () {
    BaseSync.prototype.onConnect.call(this)
    this.startTimeout()
  },

  onDisconnect: function onDisconnect () {
    BaseSync.prototype.onDisconnect.call(this)
    this.destroy()
  },

  connectMessage: function connectMessage () {
    BaseSync.prototype.connectMessage.apply(this, arguments)
    this.endTimeout()
  },

  initialize: function initialize () {
    var sync = this
    return this.log.store.getLastAdded().then(function (added) {
      sync.lastAddedCache = added
      if (sync.connection.connected) sync.onConnect()
    })
  }

}

ServerSync.prototype = assign({ }, BaseSync.prototype, ServerSync.prototype)

module.exports = ServerSync
