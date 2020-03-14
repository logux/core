import { BaseNode } from '../base-node'

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
export class ClientNode extends BaseNode { }
