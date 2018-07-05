var BrowserConnection = require('./browser-connection')
var ServerConnection = require('./server-connection')
var eachStoreCheck = require('./each-store-check')
var isFirstOlder = require('./is-first-older')
var MemoryStore = require('./memory-store')
var ClientNode = require('./client-node')
var ServerNode = require('./server-node')
var LocalPair = require('./local-pair')
var SyncError = require('./sync-error')
var Reconnect = require('./reconnect')
var TestTime = require('./test-time')
var BaseNode = require('./base-node')
var TestPair = require('./test-pair')
var Log = require('./log')

module.exports = {
  BrowserConnection: BrowserConnection,
  ServerConnection: ServerConnection,
  eachStoreCheck: eachStoreCheck,
  isFirstOlder: isFirstOlder,
  MemoryStore: MemoryStore,
  ClientNode: ClientNode,
  ServerNode: ServerNode,
  LocalPair: LocalPair,
  SyncError: SyncError,
  Reconnect: Reconnect,
  TestTime: TestTime,
  BaseNode: BaseNode,
  TestPair: TestPair,
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
 * Action’s metadata.
 *
 * @typedef {object} Meta
 * @property {string} id Action unique ID. {@link Log#add} set it automatically.
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
 * Remove action from store.
 *
 * @param {string} id Action ID.
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
 * @param {string} id Action ID.
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
 * Return action by action ID.
 *
 * @param {string} id Action ID.
 *
 * @return {Promise} Promise with array of action and metadata.
 *
 * @name byId
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
 * @param {Meta} [criteria.olderThan] Remove reason only older
 *                                    than specific action.
 * @param {Meta} [criteria.youngerThan] Remove reason only younger
 *                                      than specific action.
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

/**
 * Logux protocol message. It is a array with string of message type in first
 * position and strings/numbers/objects or arrays in next positions.
 *
 * @typedef {Array} Message
 * @property {string} 0 Message type
 */

/**
 * Abstract interface for connection to synchronize logs over it.
 * For example, WebSocket or Loopback.
 *
 * @name Connection
 * @class
 * @abstract
 */
/**
 * Send message to connection.
 *
 * @param {Message} message The message to be sent.
 *
 * @return {undefined}
 *
 * @name send
 * @function
 * @memberof Connection#
 */
/**
 * Subscribe for connection events. It implements nanoevents API.
 * Supported events:
 *
 * * `connecting`: connection establishing was started.
 * * `connect`: connection was established by any side.
 * * `disconnect`: connection was closed by any side.
 * * `message`: message was receive from remote node.
 * * `error`: error during connection, sending or receiving.
 *
 * @param {"connecting"|"connect"|"disconnect"|"message"|"error"} event Event.
 * @param {function} listener The listener function.
 *
 * @return {function} Unbind listener from event.
 *
 * @name on
 * @function
 * @memberof Connection#
 */
/**
 * Start connection. Connection should be in disconnected state
 * from the beginning and start connection only on this method call.
 *
 * This method could be called again if connection moved to disconnected state.
 *
 * @return {Promise} Promise until connection will be established.
 *
 * @name connect
 * @function
 * @memberof Connection#
 */
/**
 * Finish current connection.
 *
 * After disconnection, connection could be started again
 * by {@link Connection#connect}.
 *
 * @param {"error"|"timeout"|"destroy"} [reason] Disconnection reason.
 *                                               It will not be sent
 *                                               to other machine.
 *
 * @return {undefined}
 *
 * @name disconnect
 * @function
 * @memberof Connection#
 */
/**
 * Is connection is enabled.
 *
 * @name connected
 * @type {boolean}
 * @memberof Connection#
 */
