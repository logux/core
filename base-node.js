var NanoEvents = require('nanoevents')

var connectMessages = require('./messages/connect')
var errorMessages = require('./messages/error')
var debugMessages = require('./messages/debug')
var pingMessages = require('./messages/ping')
var syncMessages = require('./messages/sync')
var LoguxError = require('./logux-error')

var MIXINS = [
  errorMessages,
  connectMessages,
  pingMessages,
  syncMessages,
  debugMessages
]

var NOT_TO_THROW = {
  'wrong-subprotocol': true,
  'wrong-protocol': true,
  'timeout': true
}

var BEFORE_AUTH = ['connect', 'connected', 'error', 'debug']

function syncMappedEvent (node, action, meta) {
  var added = meta.added
  if (typeof added === 'undefined') {
    var lastAdded = node.lastAddedCache
    added = lastAdded > node.lastSent ? lastAdded : node.lastSent
  }
  if (node.options.outMap) {
    node.options.outMap(action, meta).then(function (changed) {
      node.sendSync(added, [changed])
    }).catch(function (e) {
      node.error(e)
    })
  } else {
    node.sendSync(added, [[action, meta]])
  }
}

/**
 * Base methods for synchronization nodes. Client and server nodes
 * are based on this module.
 *
 * @param {string} nodeId Unique current machine name.
 * @param {Log} log Logux log instance to be synchronized.
 * @param {Connection} connection Connection to remote node.
 * @param {object} [options] Synchronization options.
 * @param {object} [options.credentials] Client credentials.
 *                                       For example, access token.
 * @param {authCallback} [options.auth] Function to check client credentials.
 * @param {boolean} [options.fixTime=false] Detect difference between client
 *                                          and server and fix time
 *                                          in synchronized actions.
 * @param {number} [options.timeout=0] Timeout in milliseconds to wait answer
 *                                     before disconnect.
 * @param {number} [options.ping=0] Milliseconds since last message to test
 *                                  connection by sending ping.
 * @param {filter} [options.inFilter] Function to filter actions
 *                                    from remote node. Best place
 *                                    for access control.
 * @param {mapper} [options.inMap] Map function to change remote node’s action
 *                                 before put it to current log.
 * @param {filter} [options.outFilter] Filter function to select actions
 *                                     to synchronization.
 * @param {mapper} [options.outMap] Map function to change action
 *                                  before sending it to remote client.
 * @param {string} [options.subprotocol] Application subprotocol version
 *                                       in SemVer format.
 *
 * @abstract
 * @class
 */
function BaseNode (nodeId, log, connection, options) {
  /**
   * Unique current machine name.
   * @type {string}
   *
   * @example
   * console.log(node.localNodeId + ' is started')
   */
  this.localNodeId = nodeId
  /**
   * Log for synchronization.
   * @type {Log}
   */
  this.log = log
  /**
   * Connection used to communicate to remote node.
   * @type {Connection}
   */
  this.connection = connection
  /**
   * Synchronization options.
   * @type {object}
   */
  this.options = options || { }

  if (this.options.ping && !this.options.timeout) {
    throw new Error('You must set timeout option to use ping')
  }

  /**
   * Is synchronization in process.
   * @type {boolean}
   *
   * @example
   * node.on('disconnect', () => {
   *   node.connected //=> false
   * })
   */
  this.connected = false

  /**
   * Did we finish remote node authentication.
   * @type {boolean}
   */
  this.authenticated = false
  this.unauthenticated = []

  this.timeFix = 0
  this.syncing = 0
  this.received = { }

  /**
   * Latest current log `added` time, which was successfully synchronized.
   * It will be saves in log store.
   * @type {number}
   */
  this.lastSent = 0
  /**
   * Latest remote node’s log `added` time, which was successfully synchronized.
   * It will be saves in log store.
   * @type {number}
   */
  this.lastReceived = 0

  /**
   * Current synchronization state.
   *
   * * `disconnected`: no connection.
   * * `connecting`: connection was started and we wait for node answer.
   * * `sending`: new actions was sent, waiting for answer.
   * * `synchronized`: all actions was synchronized and we keep connection.
   *
   * @type {"disconnected"|"connecting"|"sending"|"synchronized"}
   *
   * @example
   * node.on('state', () => {
   *   if (node.state === 'sending') {
   *     console.log('Do not close browser')
   *   }
   * })
   */
  this.state = 'disconnected'

  this.emitter = new NanoEvents()
  this.timeouts = []
  this.throwsError = true

  this.unbind = []
  var node = this
  this.unbind.push(log.on('add', function (action, meta) {
    node.onAdd(action, meta)
  }))
  this.unbind.push(connection.on('connecting', function () {
    node.onConnecting()
  }))
  this.unbind.push(connection.on('connect', function () {
    node.onConnect()
  }))
  this.unbind.push(connection.on('message', function (message) {
    node.onMessage(message)
  }))
  this.unbind.push(connection.on('error', function (error) {
    if (error.message === 'Wrong message format') {
      node.sendError(new LoguxError('wrong-format', error.received))
      node.connection.disconnect('error')
    } else {
      node.error(error)
    }
  }))
  this.unbind.push(connection.on('disconnect', function () {
    node.onDisconnect()
  }))

  this.initialized = false
  this.lastAddedCache = 0
  this.initializing = this.initialize()
}

BaseNode.prototype = {

  /**
   * Unique name of remote machine.
   * It is undefined until nodes handshake.
   *
   * @type {string|undefined}
   *
   * @example
   * console.log('Connected to ' + node.remoteNodeId)
   */
  remoteNodeId: undefined,

  /**
   * Array with major and minor versions of used protocol.
   * @type {number}
   *
   * @example
   * if (tool.node.localProtocol !== 1) {
   *   throw new Error('Unsupported Logux protocol')
   * }
   */
  localProtocol: 2,

  /**
   * Minimum version of Logux protocol, which is supported.
   * @type {number}
   *
   * @example
   * console.log(`You need Logux protocol ${node.minProtocol} or higher`)
   */
  minProtocol: 2,

  /**
   * Array with major and minor versions of remote node protocol.
   * @type {number|undefined}
   *
   * @example
   * if (node.remoteProtocol >= 5) {
   *   useNewAPI()
   * } else {
   *   useOldAPI()
   * }
   */
  remoteProtocol: undefined,

  /**
   * Remote node’s application subprotocol version in SemVer format.
   *
   * It is undefined until nodes handshake. If remote node will not send
   * on handshake its subprotocol, it will be set to `0.0.0`.
   *
   * @type {string|undefined}
   *
   * @example
   * if (semver.satisfies(node.remoteSubprotocol, '>= 5.0.0') {
   *   useNewAPI()
   * } else {
   *   useOldAPI()
   * }
   */
  remoteSubprotocol: undefined,

  /**
   * Subscribe for synchronization events. It implements nanoevents API.
   * Supported events:
   *
   * * `state`: synchronization state was changed.
   * * `connect`: custom check before node authentication. You can throw
   *              a {@link LoguxError} to send error to remote node.
   * * `error`: synchronization error was raised.
   * * `clientError`: when error was sent to remote node.
   * * `debug`: when debug information received from remote node.
   *
   * @param {"state"|"connect"|"error"|"clientError"|"debug"} event Event name.
   * @param {listener} listener The listener function.
   *
   * @return {function} Unbind listener from event.
   *
   * @example
   * node.on('clientError', error => {
   *   logError(error)
   * })
   */
  on: function on (event, listener) {
    return this.emitter.on(event, listener)
  },

  /**
   * Disable throwing a error on error message and create error listener.
   *
   * @param {errorListener} listener The listener function.
   *
   * @return {undefined}
   *
   * @example
   * node.catch(error => {
   *   console.error(error)
   * })
   */
  catch: function (listener) {
    this.throwsError = false
    this.on('error', listener)
  },

  /**
   * Return Promise until sync will have specific state.
   *
   * If current state is correct, method will return resolved Promise.
   *
   * @param {string} state The expected synchronization state value.
   *
   * @return {Promise} Promise until specific state.
   *
   * @example
   * await node.waitFor('synchronized')
   * console.log('Everything is synchronized')
   */
  waitFor: function (state) {
    if (this.state === state) {
      return Promise.resolve()
    }

    var node = this
    return new Promise(function (resolve) {
      var unbind = node.on('state', function () {
        if (node.state === state) {
          unbind()
          resolve()
        }
      })
    })
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
  destroy: function destroy () {
    if (this.connection.destroy) {
      this.connection.destroy()
    } else if (this.connected) {
      this.connection.disconnect('destroy')
    }
    for (var i = 0; i < this.unbind.length; i++) {
      this.unbind[i]()
    }
    clearTimeout(this.pingTimeout)
    this.endTimeout()
  },

  send: function send (msg) {
    if (!this.connected) return
    this.delayPing()
    try {
      this.connection.send(msg)
    } catch (e) {
      this.error(e)
    }
  },

  onConnecting: function onConnecting () {
    this.setState('connecting')
  },

  onConnect: function onConnect () {
    this.delayPing()
    this.connected = true
  },

  onDisconnect: function onDisconnect () {
    while (this.timeouts.length > 0) {
      this.endTimeout()
    }
    if (this.pingTimeout) clearTimeout(this.pingTimeout)
    this.authenticated = false
    this.connected = false
    this.setState('disconnected')
  },

  onMessage: function onMessage (msg) {
    this.delayPing()
    var name = msg[0]

    if (!this.authenticated && BEFORE_AUTH.indexOf(name) === -1) {
      this.unauthenticated.push(msg)
      return
    }

    var args = new Array(msg.length - 1)
    for (var i = 1; i < msg.length; i++) {
      args[i - 1] = msg[i]
    }
    this[name + 'Message'].apply(this, args)
  },

  onAdd: function onAdd (action, meta) {
    if (!this.authenticated) return
    if (this.lastAddedCache < meta.added) {
      this.lastAddedCache = meta.added
    }

    if (this.received[meta.id]) {
      delete this.received[meta.id]
      return
    }

    if (this.options.outFilter) {
      var node = this
      this.options.outFilter(action, meta).then(function (result) {
        if (result) syncMappedEvent(node, action, meta)
      }).catch(function (e) {
        node.error(e)
      })
    } else {
      syncMappedEvent(this, action, meta)
    }
  },

  syncError: function syncError (type, options, received) {
    var err = new LoguxError(type, options, received)
    this.emitter.emit('error', err)
    if (!NOT_TO_THROW[type] && this.throwsError) {
      throw err
    }
  },

  error: function error (err) {
    this.emitter.emit('error', err)
    this.connection.disconnect('error')
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

    var ms = this.options.timeout
    var node = this
    var timeout = setTimeout(function () {
      if (node.connected) node.connection.disconnect('timeout')
      node.syncError('timeout', ms)
    }, ms)

    this.timeouts.push(timeout)
  },

  endTimeout: function endTimeout () {
    if (this.timeouts.length > 0) {
      clearTimeout(this.timeouts.shift())
    }
  },

  delayPing: function delayPing () {
    if (!this.options.ping) return
    if (this.pingTimeout) clearTimeout(this.pingTimeout)

    var node = this
    this.pingTimeout = setTimeout(function () {
      if (node.connected && node.authenticated) node.sendPing()
    }, this.options.ping)
  },

  syncSinceQuery: function syncSinceQuery (lastSynced) {
    var node = this
    var promises = []
    return this.log.each({ order: 'added' }, function (action, meta) {
      if (meta.added <= lastSynced) return false
      if (node.options.outFilter) {
        promises.push(node.options.outFilter(action, meta).then(function (r) {
          if (r) {
            return [action, meta]
          } else {
            return false
          }
        }).catch(function (e) {
          node.error(e)
        }))
      } else {
        promises.push(Promise.resolve([action, meta]))
      }
      return true
    }).then(function () {
      return Promise.all(promises)
    }).then(function (entries) {
      var data = { added: 0 }
      data.entries = entries.filter(function (entry) {
        if (entry && data.added < entry[1].added) {
          data.added = entry[1].added
        }
        return entry !== false
      })
      return data
    })
  },

  syncSince: function syncSince (lastSynced) {
    var node = this
    this.syncSinceQuery(lastSynced).then(function (data) {
      if (!node.connected) return
      if (data.entries.length > 0) {
        if (node.options.outMap) {
          Promise.all(data.entries.map(function (i) {
            return node.options.outMap(i[0], i[1])
          })).then(function (changed) {
            node.sendSync(data.added, changed)
          }).catch(function (e) {
            node.error(e)
          })
        } else {
          node.sendSync(data.added, data.entries)
        }
      } else {
        node.setState('synchronized')
      }
    })
  },

  setLastSent: function setLastSent (value) {
    if (this.lastSent < value) {
      this.lastSent = value
      this.log.store.setLastSynced({ sent: value })
    }
  },

  setLastReceived: function setLastReceived (value) {
    if (this.lastReceived < value) this.lastReceived = value
    this.log.store.setLastSynced({ received: value })
  },

  now: function now () {
    return Date.now()
  },

  initialize: function initialize () {
    var node = this
    return Promise.all([
      this.log.store.getLastSynced(),
      this.log.store.getLastAdded()
    ]).then(function (result) {
      node.initialized = true
      node.lastSent = result[0].sent
      node.lastReceived = result[0].received
      node.lastAddedCache = result[1]
      if (node.connection.connected) node.onConnect()
    })
  },

  sendDuilian: function sendDuilian () {
    this.send(['duilian', Object.keys(DUILIANS)[0]])
  },

  duilianMessage: function duilianMessage (line) {
    if (DUILIANS[line]) {
      this.send(['duilian', DUILIANS[line]])
    }
  }

}

for (var i = 0; i <= MIXINS.length; i++) {
  var mixin = MIXINS[i]
  for (var name in mixin) {
    BaseNode.prototype[name] = mixin[name]
  }
}

var DUILIANS = {
  金木水火土: '板城烧锅酒'
}

module.exports = BaseNode

/**
 * @callback errorListener
 * @param {string} error The error description.
 */

/**
 * @callback authCallback
 * @param {object} credentials Remote node credentials.
 * @param {string} nodeId Unique ID of remote node instance.
 * @return {Promise<boolean>} Promise with boolean value.
 */

/**
 * @callback filter
 * @param {Action} action New action from log.
 * @param {Meta} meta New action metadata.
 * @return {Promise<boolean>} Promise with `true` if action should
 *                            be synchronized with remote log.
 */

/**
 * @callback mapper
 * @param {Action} action New action from log.
 * @param {Meta} meta New action metadata.
 * @return {Promise<Entry>} Promise with array of changed action
 *                          and changed metadata.
 */
