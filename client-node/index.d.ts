import { BaseNode } from '../base-node/index.js'
import type { Log } from '../log/index.js'

/**
 * Client node in synchronization pair.
 *
 * Instead of server node, it initializes synchronization
 * and sends connect message.
 *
 * ```js
 * import { ClientNode } from '@logux/core'
 * const connection = new BrowserConnection(url)
 * const node = new ClientNode(nodeId, log, connection)
 * ```
 */
export class ClientNode<
  Headers extends object = object,
  NodeLog extends Log = Log
> extends BaseNode<Headers, NodeLog> {}
