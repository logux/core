import { LogStore, Action, Meta } from '../log/index.js'

/**
 * Simple memory-based log store.
 *
 * It is good for tests, but not for server or client usage,
 * because it store all data in memory and will lose log on exit.
 *
 * ```js
 * import { MemoryStore } from '@logux/core'
 *
 * var log = new Log({
 *   nodeId: 'server',
 *   store: new MemoryStore()
 * })
 * ```
 */
export class MemoryStore extends LogStore {
  /**
   * Actions in the store.
   */
  entries: [Action, Meta][]
}
