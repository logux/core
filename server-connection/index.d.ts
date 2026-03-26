import type WebSocket from 'ws'

import { WsBinaryConnection } from '../ws-binary-connection/index.js'

/**
 * Logux connection for server WebSocket.
 *
 * Automatically handles both binary and text protocol clients.
 * When a text-based client connects, it falls back to JSON encoding.
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
export class ServerConnection extends WsBinaryConnection {
  /**
   * WebSocket connection instance
   */
  ws: WebSocket

  /**
   * @param ws WebSocket connection instance
   */
  constructor(ws: WebSocket)
}
