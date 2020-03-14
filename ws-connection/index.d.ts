import { Connection } from '../base-node'

/**
 * Logux connection for browser WebSocket.
 *
 * ```js
 * import { WsConnection } from '@logux/core'
 *
 * const connection = new WsConnection('wss://logux.example.com/')
 * const node = new ClientNode(nodeId, log, connection, opts)
 * ```
 */
export class WsConnection extends Connection {
  /**
   * @param url WebSocket server URL.
   * @param WS WebSocket class if you want change implementation.
   * @param opts Extra option for WebSocket constructor.
   */
  constructor (url: string, WS?: any, opts?: any)
}
