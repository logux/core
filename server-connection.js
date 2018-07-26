var NanoEvents = require('nanoevents')

var WsConnection = require('./ws-connection')
var merge = require('./merge')

/**
 * Logux connection for server WebSocket.
 *
 * @param {WebSocket} ws WebSocket instance
 *
 * @example
 * import { ServerConnection } from 'logux-core'
 * import { Server } from 'ws'
 *
 * wss.on('connection', function connection(ws) {
 *   const connection = new ServerConnection(ws)
 *   const node = new ServerNode('server', log, connection, opts)
 * })
 *
 * @class
 * @extends WsConnection
 */
function ServerConnection (ws) {
  this.connected = true
  this.emitter = new NanoEvents()
  this.init(ws)
}

ServerConnection.prototype = {

  connect: function connect () {
    throw new Error('ServerConnection accepts already connected WebSocket ' +
                    'instance and could not reconnect it')
  }

}

ServerConnection.prototype = merge(
  ServerConnection.prototype, WsConnection.prototype)

module.exports = ServerConnection
