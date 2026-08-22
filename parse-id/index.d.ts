interface IDComponents {
  clientId: string
  nodeId: string
  userId: string | undefined
}

/**
 * Parse `meta.id` or Node ID into component: user ID, client ID, node ID.
 *
 * ```js
 * import { parseId } from '@logux/core'
 * const { userId, clientId } = parseId(meta.id)
 * ```
 *
 * @param id Action or Node ID
 */
export function parseId(id: string): IDComponents

/**
 * Faster alternative for `parseId(meta.id).clientId === clientId` check.
 *
 * It doesn’t create any object or string during the check.
 *
 * ```js
 * import { isSameClient } from '@logux/core'
 * if (isSameClient(meta.id, ctx.clientId)) {
 *   // Action was created by this client
 * }
 * ```
 *
 * @param id Action or Node ID
 * @param clientId Client ID to compare with
 */
export function isSameClient(id: string, clientId: string): boolean
