var isFirstOlder = require('./is-first-older')
var MemoryStore = require('./memory-store')
var TestTime = require('./test-time')
var Log = require('./log')

module.exports = {
  isFirstOlder: isFirstOlder,
  MemoryStore: MemoryStore,
  TestTime: TestTime,
  Log: Log
}

/**
* Action from the log.
*
* @typedef {object} Action
* @property {string} type Action type name.
*
* @example
* { type: 'add', id: 'project:12:price' value: 12 }
*/

/**
 * Unique action ID.
 * Array of comparable native types (like number or string).
 * Every next action ID should be bigger than previous.
 *
 * @typedef {array} ID
 *
 * @example
 * [1, 'server', 0]
 */

/**
 * Action’s metadata.
 *
 * @typedef {object} Meta
 * @property {ID} id Action unique ID. {@link Log#add} set it automatically.
 * @property {number} added Sequence number of action in current log.
 *                          {@link Log#add} will fill it.
 */

/**
 * @callback listener
 * @param {Action} action New action.
 * @param {Meta} meta The action’s metadata.
 */

/**
 * Array with {@link Action} and its {@link Meta}.
 *
 * @typedef {Array} Entry
 * @property {Action} 0 Action’s object.
 * @property {Meta} 1 Action’s metadata.
 */

/**
 * @callback next
 * @return {Promise} Promise with next {@link Page}.
 */

/**
 * Part of log from {@link Store}.
 *
 * @typedef {object} Page
 * @property {Entry[]} entries Pagination page.
 * @property {next|undefined}
 */

/**
 * The `added` values for latest synchronized received/sent events.
 *
 * @typedef {object} LastSynced
 * @property {string} received The `added` value of latest received event.
 * @property {string} sent The `added` value of latest sent event.
 */

/**
 * Every Store class should provide 8 standard methods:
 * `add`, `has`, `get`, `remove`, `changeMeta`, `removeReason`,
 * `getLastAdded`, `getLastSynced`, `setLastSynced`.
 *
 * See {@link MemoryStore} sources for example.
 *
 * @name Store
 * @class
 * @abstract
 */
/**
 * Add action to store. Action always will have `type` property.
 *
 * @param {Action} action The action to add.
 * @param {Meta} meta Action’s metadata.
 *
 * @return {Promise} Promise with `meta` for new action or `false`
 *                   if action with same `meta.id` was already in store.
 *
 * @name add
 * @function
 * @memberof Store#
 */
/**
 * Does store already has action with this ID.
 *
 * @param {ID} id Action ID.
 *
 * @return {Promise} Promise with boolean
 *
 * @name has
 * @function
 * @memberof Store#
 */
/**
 * Remove action from store.
 *
 * @param {ID} id Action ID.
 *
 * @return {Promise} Promise with entry if action was in store.
 *
 * @name remove
 * @function
 * @memberof Store#
 */
/**
 * Return a Promise with first {@link Page}. Page object has `entries` property
 * with part of actions and `next` property with function to load next page.
 * If it was a last page, `next` property should be empty.
 *
 * This tricky API is used, because log could be very big. So we need
 * pagination to keep them in memory.
 *
 * @param {object} opts Query options.
 * @param {"created"|"added"} [opts.order] Sort entries by created time or
 *                                         when they was added to current log.
 *
 * @return {Promise} Promise with first {@link Page}.
 *
 * @name get
 * @function
 * @memberof Store#
 */
/**
 * Change action metadata.
 *
 * @param {ID} id Action ID.
 * @param {object} diff Object with values to change in action metadata.
 *
 * @return {Promise} Promise with `true` if metadata was changed
 *                   or `false` on unknown ID.
 *
 * @name changeMeta
 * @function
 * @memberof Store#
 */
/**
 * Remove reason from action’s metadata and remove actions without reasons.
 *
 * @param {string} reason The reason name.
 * @param {object} criteria Actions criteria.
 * @param {number} [criteria.minAdded] Remove reason only for actions
 *                                     with bigger `added`.
 * @param {number} [criteria.maxAdded] Remove reason only for actions
 *                                     with lower `added`.
 * @param {listener} callback Callback for every removed action.
 *
 * @return {Promise} Promise when cleaning will be finished.
 *
 * @name removeReason
 * @function
 * @memberof Store#
 */
/**
 * Return biggest `added` number in store.
 * All actions in this log have less or same `added` time.
 *
 * @return {Promise} Promise with biggest `added` number.
 *
 * @name getLastAdded
 * @function
 * @memberof Store#
 */
/**
 * Get `added` values for latest synchronized received/sent events.
 *
 * @return {Promise} Promise with {@link LastSynced}.
 *
 * @name getLastSynced
 * @function
 * @memberof Store#
 */
/**
 * Set `added` value for latest synchronized received or/and sent events.
 *
 * @param {LastSynced} values Object with latest sent or received values.
 *
 * @return {Promise} Promise when values will be saved to store.
 *
 * @name setLastSynced
 * @function
 * @memberof Store#
 */
