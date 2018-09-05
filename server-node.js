var BaseNode = require('./base-node')
var validate = require('./validate')
var merge = require('./merge')

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
 * @param {string} nodeId Unique current machine name.
 * @param {Log} log Logux log instance to be synchronized.
 * @param {Connection} connection Connection to remote node.
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
 * @param {mapper} [options.inMap] Map function to change remote node’s action
 *                                 before put it to current log.
 * @param {filter} [options.outFilter] Filter function to select actions
 *                                     to synchronization.
 * @param {mapper} [options.outMap] Map function to change action
 *                                  before sending it to remote client.
 * @param {string} [options.subprotocol] Application subprotocol version
 *                                       in SemVer format.
 *
 * @example
 * import { ServerNode } from 'logux-core'
 * startServer(ws => {
 *   const connection = new ServerConnection(ws)
 *   const node = new ServerNode('server' + id, log, connection)
 * })
 *
 * @extends BaseNode
 * @class
 */
function ServerNode (nodeId, log, connection, options) {
  options = merge(options, DEFAULT_OPTIONS)
  BaseNode.call(this, nodeId, log, connection, options)

  if (this.options.fixTime) {
    throw new Error(
      'Logux Server could not fix time. Set opts.fixTime for Client node.')
  }

  this.state = 'connecting'
}

ServerNode.prototype = {

  onConnect: function onConnect () {
    if (this.initialized) {
      BaseNode.prototype.onConnect.call(this)
      this.startTimeout()
    }
  },

  onDisconnect: function onDisconnect () {
    BaseNode.prototype.onDisconnect.call(this)
    this.destroy()
  },

  onMessage: function onMessage (msg) {
    if (validate(this, msg)) {
      BaseNode.prototype.onMessage.call(this, msg)
    }
  },

  connectMessage: function connectMessage () {
    var node = this
    var args = arguments
    this.initializing.then(function () {
      BaseNode.prototype.connectMessage.apply(node, args)
      node.endTimeout()
    })
  },

  initialize: function initialize () {
    var node = this
    return this.log.store.getLastAdded().then(function (added) {
      node.initialized = true
      node.lastAddedCache = added
      if (node.connection.connected) node.onConnect()
    })
  }

}

ServerNode.prototype = merge(ServerNode.prototype, BaseNode.prototype)

module.exports = ServerNode
