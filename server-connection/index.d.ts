import type WebSocket from 'ws'

import { Connection } from '../base-node/index.js'

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
   * WebSocket connection instance
   */
  ws: WebSocket

  /**
   * @param ws WebSocket connection instance
   */
  constructor(ws: WebSocket)
}
