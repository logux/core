import type WebSocket from 'ws'

import { WsConnection } from '../ws-connection/index.js'

/**
 * Logux connection for WebSocket using binary protocol.
 *
 * Automatically detects text-based peers and falls back to JSON encoding,
 * so it can be used in ServerConnection to handle both binary and text clients.
 *
 * ```js
 * import { WsBinaryConnection } from '@logux/core'
 *
 * const connection = new WsBinaryConnection('wss://logux.example.com/')
 * const node = new ClientNode(nodeId, log, connection, opts)
 * ```
 */
export class WsBinaryConnection<WS = WebSocket> extends WsConnection<WS> {
  /**
   * @param url WebSocket server URL.
   * @param WS WebSocket class if you want change implementation.
   * @param opts Extra option for WebSocket constructor.
   */
  constructor(url: string, Class?: unknown, opts?: unknown)
}
