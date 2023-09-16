import { createNanoEvents } from 'nanoevents'

import {
  connectedMessage,
  connectMessage,
  sendConnect,
  sendConnected
} from '../connect/index.js'
import { debugMessage, sendDebug } from '../debug/index.js'
import { errorMessage, sendError } from '../error/index.js'
import { headersMessage, sendHeaders } from '../headers/index.js'
import { LoguxError } from '../logux-error/index.js'
import { pingMessage, pongMessage, sendPing } from '../ping/index.js'
import {
  sendSync,
  sendSynced,
  syncedMessage,
  syncMessage
} from '../sync/index.js'

const NOT_TO_THROW = {
  'timeout': true,
  'wrong-protocol': true,
  'wrong-subprotocol': true
}

const BEFORE_AUTH = ['connect', 'connected', 'error', 'debug', 'headers']

function syncEvent(node, action, meta, added) {
  if (typeof added === 'undefined') {
    let lastAdded = node.lastAddedCache
    added = lastAdded > node.lastSent ? lastAdded : node.lastSent
  }
  node.sendSync(added, [[action, meta]])
}

export class BaseNode {
  constructor(nodeId, log, connection, options = {}) {
    this.remoteNodeId = undefined
    this.remoteProtocol = undefined
    this.remoteSubprotocol = undefined

    this.minProtocol = 3
    this.localProtocol = 4
    this.localNodeId = nodeId

    this.log = log
    this.connection = connection
    this.options = options

    if (this.options.ping && !this.options.timeout) {
      throw new Error('You must set timeout option to use ping')
    }

    this.connected = false
    this.authenticated = false
    this.unauthenticated = []

    this.timeFix = 0
    this.syncing = 0
    this.received = {}

    this.lastSent = 0
    this.lastReceived = 0

    this.state = 'disconnected'

    this.emitter = createNanoEvents()
    this.timeouts = []
    this.throwsError = true

    this.unbind = [
      log.on('add', (action, meta) => {
        this.onAdd(action, meta)
      }),
      connection.on('connecting', () => {
        this.onConnecting()
      }),
      connection.on('connect', () => {
        this.onConnect()
      }),
      connection.on('message', message => {
        this.onMessage(message)
      }),
      connection.on('error', error => {
        if (error.message === 'Wrong message format') {
          this.sendError(new LoguxError('wrong-format', error.received))
          this.connection.disconnect('error')
        } else {
          this.error(error)
        }
      }),
      connection.on('disconnect', () => {
        this.onDisconnect()
      })
    ]

    this.initialized = false
    this.lastAddedCache = 0
    this.initializing = this.initialize()
    this.localHeaders = {}
    this.remoteHeaders = {}
  }

  catch(listener) {
    this.throwsError = false
    let unbind = this.on('error', listener)
    return () => {
      this.throwsError = true
      unbind()
    }
  }

  delayPing() {
    if (!this.options.ping) return
    if (this.pingTimeout) clearTimeout(this.pingTimeout)

    this.pingTimeout = setTimeout(() => {
      if (this.connected && this.authenticated) this.sendPing()
    }, this.options.ping)
  }

  destroy() {
    if (this.connection.destroy) {
      this.connection.destroy()
    } else if (this.connected) {
      this.connection.disconnect('destroy')
    }
    for (let i of this.unbind) i()
    clearTimeout(this.pingTimeout)
    this.endTimeout()
  }

  duilianMessage(line) {
    if (DUILIANS[line]) {
      this.send(['duilian', DUILIANS[line]])
    }
  }

  endTimeout() {
    if (this.timeouts.length > 0) {
      clearTimeout(this.timeouts.shift())
    }
  }

  error(err) {
    this.emitter.emit('error', err)
    this.connection.disconnect('error')
    if (this.throwsError) {
      throw err
    }
  }

  async initialize() {
    let [synced, added] = await Promise.all([
      this.log.store.getLastSynced(),
      this.log.store.getLastAdded()
    ])
    this.initialized = true
    this.lastSent = synced.sent
    this.lastReceived = synced.received
    this.lastAddedCache = added
    if (this.connection.connected) this.onConnect()
  }

  now() {
    return Date.now()
  }

  on(event, listener) {
    return this.emitter.on(event, listener)
  }

  async onAdd(action, meta) {
    if (!this.authenticated) return
    if (this.lastAddedCache < meta.added) {
      this.lastAddedCache = meta.added
    }

    if (this.received && this.received[meta.id]) {
      delete this.received[meta.id]
      return
    }

    if (this.options.onSend) {
      try {
        let added = meta.added
        let result = await this.options.onSend(action, meta)
        if (result) {
          syncEvent(this, result[0], result[1], added)
        }
      } catch (e) {
        this.error(e)
      }
    } else {
      syncEvent(this, action, meta, meta.added)
    }
  }

  onConnect() {
    this.delayPing()
    this.connected = true
  }

  onConnecting() {
    this.setState('connecting')
  }

  onDisconnect() {
    while (this.timeouts.length > 0) {
      this.endTimeout()
    }
    if (this.pingTimeout) clearTimeout(this.pingTimeout)
    this.authenticated = false
    this.connected = false
    this.syncing = 0
    this.setState('disconnected')
  }

  onMessage(msg) {
    this.delayPing()
    let name = msg[0]

    if (!this.authenticated && !BEFORE_AUTH.includes(name)) {
      this.unauthenticated.push(msg)
      return
    }

    this[name + 'Message'](...msg.slice(1))
  }

  send(msg) {
    if (!this.connected) return
    this.delayPing()
    try {
      this.connection.send(msg)
    } catch (e) {
      this.error(e)
    }
  }

  sendDuilian() {
    this.send(['duilian', Object.keys(DUILIANS)[0]])
  }

  setLastReceived(value) {
    if (this.lastReceived < value) this.lastReceived = value
    this.log.store.setLastSynced({ received: value })
  }

  setLastSent(value) {
    if (this.lastSent < value) {
      this.lastSent = value
      this.log.store.setLastSynced({ sent: value })
    }
  }

  setLocalHeaders(headers) {
    this.localHeaders = headers
    if (this.connected) {
      this.sendHeaders(headers)
    }
  }

  setState(state) {
    if (this.state !== state) {
      this.state = state
      this.emitter.emit('state')
    }
  }

  startTimeout() {
    if (!this.options.timeout) return

    let ms = this.options.timeout
    let timeout = setTimeout(() => {
      if (this.connected) this.connection.disconnect('timeout')
      this.syncError('timeout', ms)
    }, ms)

    this.timeouts.push(timeout)
  }

  syncError(type, options, received) {
    let err = new LoguxError(type, options, received)
    this.emitter.emit('error', err)
    if (!NOT_TO_THROW[type] && this.throwsError) {
      throw err
    }
  }

  syncFilter() {
    return true
  }

  async syncSince(lastSynced) {
    let data = await this.syncSinceQuery(lastSynced)
    if (!this.connected) return
    if (data.entries.length > 0) {
      this.sendSync(data.added, data.entries)
    } else {
      this.setState('synchronized')
    }
  }

  async syncSinceQuery(lastSynced) {
    let promises = []
    let maxAdded = 0
    await this.log.each({ order: 'added' }, (action, meta) => {
      if (meta.added <= lastSynced) return false
      if (!this.syncFilter(action, meta)) return undefined
      if (this.options.onSend) {
        promises.push(
          (async () => {
            try {
              let result = await this.options.onSend(action, meta)
              if (result) {
                if (meta.added > maxAdded) {
                  maxAdded = meta.added
                }
              }
              return result
            } catch (e) {
              this.error(e)
              return false
            }
          })()
        )
      } else {
        if (meta.added > maxAdded) {
          maxAdded = meta.added
        }
        promises.push(Promise.resolve([action, meta]))
      }
      return true
    })

    let entries = await Promise.all(promises)
    return {
      added: maxAdded,
      entries: entries.filter(entry => entry !== false)
    }
  }

  waitFor(state) {
    if (this.state === state) {
      return Promise.resolve()
    }
    return new Promise(resolve => {
      let unbind = this.on('state', () => {
        if (this.state === state) {
          unbind()
          resolve()
        }
      })
    })
  }
}

BaseNode.prototype.sendConnect = sendConnect
BaseNode.prototype.sendConnected = sendConnected
BaseNode.prototype.connectMessage = connectMessage
BaseNode.prototype.connectedMessage = connectedMessage

BaseNode.prototype.sendSync = sendSync
BaseNode.prototype.sendSynced = sendSynced
BaseNode.prototype.syncMessage = syncMessage
BaseNode.prototype.syncedMessage = syncedMessage

BaseNode.prototype.sendPing = sendPing
BaseNode.prototype.pingMessage = pingMessage
BaseNode.prototype.pongMessage = pongMessage

BaseNode.prototype.sendDebug = sendDebug
BaseNode.prototype.debugMessage = debugMessage

BaseNode.prototype.sendError = sendError
BaseNode.prototype.errorMessage = errorMessage

BaseNode.prototype.sendHeaders = sendHeaders
BaseNode.prototype.headersMessage = headersMessage

const DUILIANS = {
  金木水火土: '板城烧锅酒'
}
