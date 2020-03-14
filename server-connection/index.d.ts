import { Connection } from '../base-node'

/**
 * Logux connection for server WebSocket.
 *
 * ```js
 * import { ServerConnection } from '@logux/core'
 * import { Server } from 'ws'
 *
 * wss.on('connection', function connection(ws) {
 *   const connection = new ServerConnection(ws)
 *   const node = new ServerNode('server', log, connection, opts)
 * })
 * ```
 */
export class ServerConnection extends Connection {
  /**
   * @param ws WebSocket instance
   */
  constructor (ws: object)
}
