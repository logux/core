var createTestTimer = require('./create-test-timer')
var isFirstOlder = require('./is-first-older')
var createTimer = require('./create-timer')
var MemoryStore = require('./memory-store')
var cleanEvery = require('./clean-every')
var Log = require('./log')

module.exports = {
  createTestTimer: createTestTimer,
  isFirstOlder: isFirstOlder,
  createTimer: createTimer,
  MemoryStore: MemoryStore,
  cleanEvery: cleanEvery,
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
 * Every log store should provide two methods: add and get.
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
 * @return {Promise} Promise with `false` if action with same `meta.id`
 *                   was already in store
 *
 * @name add
 * @function
 * @memberof Store#
 */
/**
 * Remove Action from store.
 *
 * @param {ID} id Action ID.
 *
 * @return {undefined}
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
 * @param {"created"|"added"} order Sort entries by created time
 *                                  or when they was added to current log.
 *
 * @return {Promise} Promise with first {@link Page}.
 *
 * @name get
 * @function
 * @memberof Store#
 */

/**
 * Returns next action ID. It should return unique ID on every call.
 * Every next ID should be bigger than previous one.
 *
 * @typedef {function} Timer
 * @return {ID}
 */
