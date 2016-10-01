var NanoEvents = require('nanoevents')
var assign = require('object-assign')

var SyncError = require('./sync-error')
var connect = require('./messages/connect')
var error = require('./messages/error')
var ping = require('./messages/ping')
var sync = require('./messages/sync')

var BEFORE_AUTH = ['connect', 'connected', 'error']

/**
 * Base methods for synchronization nodes. Active and passive nodes
 * are based on this module.
 *
 * @param {string|number} host Unique current host name.
 * @param {Log} log Logux log instance to sync with other node log.
 * @param {Connection} connection Connection to other node.
 * @param {object} [options] Synchronization options.
 * @param {object} [option.credentials] This node credentials.
 *                                      For example, access token.
 * @param {authCallback} [option.auth] Function to check
 *                                     other node credentials.
 * @param {boolean} [options.fixTime=false] Enables log’s event time fixes
 *                                          to prevent problems
 *                                          because of wrong client time zone.
 * @param {number} [option.timeout=0] Timeout in milliseconds
 *                                    to disconnect connection.
 * @param {number} [option.ping=0] Milliseconds since last message to test
 *                                 connection by sending ping.
 * @param {filter} [option.inFilter] Function to filter events
 *                                   from other client. Best place
 *                                   for access control.
 * @param {mapper} [option.inMap] Map function to change event
 *                                before put it to current log.
 * @param {filter} [option.outFilter] Filter function to select events
 *                                    to synchronization.
 * @param {mapper} [option.outMap] Map function to change event
 *                                 before sending it to other client.
 *
 * @abstract
 * @class
 */
function BaseSync (host, log, connection, options) {
  /**
   * Unique current host name.
   * @type {string|number}
   */
  this.host = host
  /**
   * Log to synchronization.
   * @type {Log}
   */
  this.log = log
  /**
   * Connection used to communicate to other node.
   * @type {Connection}
   */
  this.connection = connection
  /**
   * Options used to create node.
   * @type {object}
   */
  this.options = options || { }

  if (this.options.ping && !this.options.timeout) {
    throw new Error('You must set timeout option to use ping')
  }
  if (this.options.ping && this.options.ping < 2 * this.options.timeout) {
    throw new Error('Ping should be at least 2 times longer than timeout')
  }

  /**
   * Is synchronization in process.
   * @type {boolean}
   *
   * @example
   * sync.on('disconnect', () => {
   *   sync.connected //=> false
   * })
   */
  this.connected = false

  /**
   * Did other node finish authenticated.
   * @type {boolean}
   */
  this.authenticated = false
  this.authenticating = false
  this.unauthenticated = []

  this.timeFix = 0
  this.syncing = 0
  this.received = 0

  this.synced = 0
  this.otherSynced = 0

  /**
   * Current synchronization state.
   *
   * * `disconnected`: no connection, but no new events to synchronization.
   * * `wait`: new events for synchronization but there is no connection.
   * * `connecting`: connection was established and we wait for node answer.
   * * `sending`: new events was sent, waiting for answer.
   * * `synchronized`: all events was synchronized and we keep connection.
   *
   * @type {"disconnected"|"wait"|"sending"|"synchronized"}
   *
   * @example
   * sync.on('state', () => {
   *   console.log('Synchronization ' + sync.state)
   * })
   */
  this.state = 'disconnected'
  if (this.log.lastAdded > this.synced) this.state = 'wait'

  this.throwsError = true
  this.emitter = new NanoEvents()

  this.unbind = []
  var sync = this
  this.unbind.push(log.on('event', function (event, meta) {
    sync.onEvent(event, meta)
  }))
  this.unbind.push(connection.on('connect', function () {
    sync.onConnect()
  }))
  this.unbind.push(connection.on('message', function (message) {
    sync.onMessage(message)
  }))
  this.unbind.push(connection.on('disconnect', function () {
    sync.onDisconnect()
  }))
}

BaseSync.prototype = {

  /**
   * Unique host name of other node.
   * It is undefined until nodes handshake.
   *
   * @type {string|number|undefined}
   *
   * @example
   * console.log('Connected to ' + sync.otherHost)
   */
  otherHost: undefined,

  /**
   * Array with major and minor versions of other node protocol.
   * @type {number[]}
   *
   * @example
   * if (sync.otherProtocol[1] >= 5) {
   *   useNewAPI()
   * } else {
   *   useOldAPI()
   * }
   */
  otherProtocol: undefined,

  /**
   * Array with major and minor versions of used protocol.
   * @type {number[]}
   *
   * @example
   * if (tool.sync.protocol[0] !== 1) {
   *   throw new Error('Unsupported Logux protocol')
   * }
   */
  protocol: [0, 0],

  /**
   * Subscribe for synchronization events. It implements nanoevents API.
   * Supported events:
   *
   * * `state`: synchronization state changes.
   * * `sendedError`: when error was sent to other node.
   *
   * @param {"state"|"sendedError"} event The event name.
   * @param {listener} listener The listener function.
   *
   * @return {function} Unbind listener from event.
   *
   * @example
   * sync.on('disconnect', error => {
   *   showDisconnectBadge()
   * })
   */
  on: function on (event, listener) {
    return this.emitter.on(event, listener)
  },

  /**
   * Add one-time listener for synchronization events.
   * See {@link PassiveSync#on} for supported events.
   *
   * @param {"state"|"sendedError"} event The event name.
   * @param {listener} listener The listener function.
   *
   * @return {function} Unbind listener from event.
   *
   * @example
   * sync.once('error', () => {
   *   everythingFine = false
   * })
   */
  once: function once (event, listener) {
    return this.emitter.once(event, listener)
  },

  /**
   * Disable throwing a error on error message and create error listener.
   *
   * @param {errorListener} listener The listener function.
   *
   * @return {undefined}
   *
   * @example
   * sync.catch(error => {
   *   console.error(error)
   * })
   */
  catch: function (listener) {
    this.throwsError = false
    this.on('error', listener)
  },

  /**
   * Shut down the connection and unsubscribe from log events.
   *
   * @return {undefined}
   *
   * @example
   * connection.on('disconnect', () => {
   *   server.destroy()
   * })
   */
  destroy: function destory () {
    if (this.connected) this.connection.disconnect()
    for (var i = 0; i < this.unbind.length; i++) {
      this.unbind[i]()
    }
  },

  send: function send (msg) {
    if (this.connected) {
      this.delayPing()
      this.connection.send(msg)
    } else {
      var json = JSON.stringify(msg)
      throw new Error('Could not send ' + json + ' to disconnected connection')
    }
  },

  onConnect: function onConnect () {
    this.delayPing()
    this.connected = true
  },

  onDisconnect: function onDisconnect () {
    this.endTimeout()
    if (this.pingTimeout) clearTimeout(this.pingTimeout)
    this.connected = false

    if (this.log.lastAdded > this.synced) {
      this.setState('wait')
    } else {
      this.setState('disconnected')
    }
  },

  onMessage: function onMessage (msg) {
    this.delayPing()

    if (typeof msg !== 'object' || typeof msg.length !== 'number') {
      var json = JSON.stringify(msg)
      this.sendError('Wrong message format in ' + json, 'protocol')
      return
    }
    if (msg.length < 1 || typeof msg[0] !== 'string') {
      this.sendError('Wrong type in message ' + JSON.stringify(msg), 'protocol')
      return
    }

    var name = msg[0]
    var method = name + 'Message'
    if (typeof this[method] !== 'function') {
      this.sendError('Unknown message type `' + name + '`', 'protocol')
      return
    }

    if (!this.authenticated && BEFORE_AUTH.indexOf(name) === -1) {
      if (this.authenticating) {
        this.unauthenticated.push(msg)
      } else {
        this.sendError(
          'Start authentication before sending `' + name + '` message',
          'protocol')
      }
      return
    }

    var args = new Array(msg.length - 1)
    for (var i = 1; i < msg.length; i++) {
      args[i - 1] = msg[i]
    }
    this[method].apply(this, args)
  },

  onEvent: function onEvent (event, meta) {
    if (!this.connected) {
      this.setState('wait')
      return
    }
    if (meta.added === this.received) {
      return
    }
    if (this.options.outFilter && !this.options.outFilter(event, meta)) {
      return
    }

    if (this.options.outMap) {
      var changed = this.options.outMap(event, meta)
      event = changed[0]
      meta = changed[1]
    }

    this.sendSync(event, meta)
  },

  error: function error (desc, type, received) {
    var err = new SyncError(this, desc, type, received)
    this.emitter.emit('error', err)
    if (this.throwsError) {
      throw err
    }
  },

  setState: function setState (state) {
    if (this.state !== state) {
      this.state = state
      this.emitter.emit('state')
    }
  },

  startTimeout: function startTimeout () {
    if (!this.options.timeout) return
    this.endTimeout()

    var ms = this.options.timeout
    var sync = this
    this.lastTimeout = setTimeout(function () {
      var desc = 'A timeout was riched (' + ms + 'ms)'
      if (sync.connected) {
        sync.sendError(desc, 'protocol')
        sync.connection.disconnect()
      }
      sync.error(desc, 'connection', false)
    }, this.options.timeout)
  },

  endTimeout: function endTimeout () {
    if (this.lastTimeout) {
      clearTimeout(this.lastTimeout)
      this.lastTimeout = false
    }
  },

  delayPing: function delayPing () {
    if (!this.options.ping) return
    if (this.pingTimeout) clearTimeout(this.pingTimeout)

    var sync = this
    this.pingTimeout = setTimeout(function () {
      sync.sendPing()
    }, this.options.ping)
  },

  syncSince: function syncEventSince (lastSynced) {
    var data = []
    var sync = this
    this.log.each({ order: 'added' }, function (event, meta) {
      if (meta.added <= lastSynced) return false
      data.push(event, meta)
    }).then(function () {
      if (!sync.connected) return
      if (data.length > 0) {
        sync.sendSync.apply(sync, data)
      } else {
        sync.setState('synchronized')
      }
    })
  }

}

BaseSync.prototype = assign(BaseSync.prototype, error, connect, ping, sync)

module.exports = BaseSync

/**
 * @callback errorListener
 * @param {string} error The error description.
 */

/**
 * @callback authCallback
 * @param {object} credentials Other credentials.
 * @param {string} host Unique host name of other sync instance.
 * @return {Promise} Promise with boolean value.
 */

/**
 * @callback filter
 * @param {Event} event New event from log.
 * @param {Meta} meta New event metadata.
 * @return {boolean} Should event be synchronized with other log.
 */

/**
 * @callback mapper
 * @param {Event} event New event from log.
 * @param {Meta} meta New event metadata.
 * @return {Entry} Array with changed event and changed metadata.
 */
