import { Log, Meta } from '../log/index.js'
import { BaseNode } from '../base-node/index.js'

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
 */
export class ServerNode<
  Headers extends object = {},
  NodeLog extends Log = Log<Meta>
> extends BaseNode<Headers, NodeLog> {}
