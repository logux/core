import { BaseNode } from '../base-node'
import { Meta } from '../log'

/**
 * Server node in synchronization pair.
 *
 * Instead of client node, it doesn’t initialize synchronization
 * and destroy itself on disconnect.
 *
 * ```js
 * import { ServerNode } from '@logux/core'
 * startServer(ws => {
 *   const connection = new ServerConnection(ws)
 *   const node = new ServerNode('server' + id, log, connection)
 * })
 * ```
 *
 * @template M Meta’s type.
 */
export class ServerNode<M extends Meta = Meta> extends BaseNode<M> {}
