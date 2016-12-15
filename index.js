var createTestTimer = require('./create-test-timer')
var isFirstOlder = require('./is-first-older')
var createTimer = require('./create-timer')
var MemoryStore = require('./memory-store')
var cleanEvery = require('./clean-every')
var getTime = require('./get-time')
var Log = require('./log')

module.exports = {
  createTestTimer: createTestTimer,
  isFirstOlder: isFirstOlder,
  createTimer: createTimer,
  MemoryStore: MemoryStore,
  cleanEvery: cleanEvery,
  getTime: getTime,
  Log: Log
}

/**
* Log’s event.
*
* @typedef {object} Event
* @property {string} type Event type name.
*
* @example
* { type: 'add', id: 'project:12:price' value: 12 }
*/

/**
 * Unique event ID.
 * Array of comparable native types (like number or string).
 * Every next event ID should be bigger than previous.
 *
 * @typedef {array} ID
 *
 * @example
 * [1, 'server', 0]
 */

/**
 * Event metadata.
 *
 * @typedef {object} Meta
 * @property {ID} id Event unique ID. {@link Log#add} set it automatically.
 * @property {number} added Event added sequence number.
 *                          {@link Log#add} will fill it.
 */

/**
 * Array with {@link Event} and its {@link Meta}.
 *
 * @typedef {Array} Entry
 * @property {Event} 0 Event object.
 * @property {Meta} 1 Event metadata.
 */

/**
 * @callback next
 * @return {Promise} Promise with next {@link Page}.
 */

/**
 * Part of events in {@link Store}.
 *
 * @typedef {object} Page
 * @property {Entry[]} entries Part of events in store.
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
 * Add new event to store. Event always will have `type` property.
 *
 * @param {Entry} entry Array with event and meta.
 *
 * @return {Promise} Promise with `false` if event with same `meta.id`
 *                   was already in store
 *
 * @name add
 * @function
 * @memberof Store#
 */
/**
 * Remove event from store.
 *
 * @param {ID} id Event ID.
 *
 * @return {undefined}
 *
 * @name remove
 * @function
 * @memberof Store#
 */
/**
 * Return a Promise with first {@link Page}. Page object has `entries` property
 * with part of events list and `next` property with function to load next page.
 * If it was a last page of events, `next` property should be empty.
 *
 * This tricky API is used, because store could have a lot of events. So we need
 * pagination to keep them in memory.
 *
 * @param {"created"|"added"} order Sort events by created time
 *                                  or when they was added to current log.
 *
 * @return {Promise} Promise with first {@link Page}.
 *
 * @name get
 * @function
 * @memberof Store#
 */

/**
 * Returns next event ID. It should return unique ID on every call.
 * Every next ID should be bigger than previous one.
 *
 * @typedef {function} Timer
 * @return {ID}
 */
