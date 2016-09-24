module.exports = {
  createTestTimer: require('./create-test-timer'),
  createTimer: require('./create-timer'),
  MemoryStore: require('./memory-store'),
  Log: require('./log')
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
 *
 * @typedef {array} Time
 *
 * @example
 * [1, 'host']
 */

/**
 * Event metadata.
 *
 * @typedef {object} Meta
 * @property {Time} created Event occurred time. {@link Log#add} will fill it,
 *                          if field will be empty.
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
 * Add new event to store. Event always will have type and time properties.
 *
 * @param {Entry} entry Array with event and meta.
 *
 * @return {boolean} `false` if event with same `meta.created` was already
 *                   in store
 *
 * @name add
 * @function
 * @memberof Store#
 */
/**
 * Remove event from store. Because every even has unique creation time,
 * this times is used as event ID.
 *
 * @param {Time} time Event’s creation time.
 *
 * @return {undefined}
 *
 * @name remove
 * @function
 * @memberof Store#
 */
/**
 * Return a Promise with first {@link Page}. Page object has `data` property
 * with part of events list and `next` property with function to load next page.
 * If it was a last page of events, `next` property should be empty.
 *
 * This tricky API is used, because store could have a lot of events. So we need
 * pagination to keep them in memory.
 *
 * @param {"created"|"added"} order What time should be used in events sorting.
 *
 * @return {Promise} Promise with first {@link Page}.
 *
 * @name get
 * @function
 * @memberof Store#
 */

/**
 * Returns current time. Time should be unique for every call.
 *
 * @typedef {function} Timer
 * @return {Time}
 */
