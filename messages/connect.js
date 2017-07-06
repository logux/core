var SyncError = require('../sync-error')

function auth (sync, nodeId, credentials, callback) {
  if (!sync.options.auth) {
    sync.authenticated = true
    callback()
    return
  }

  sync.authenticating = true
  sync.options.auth(credentials, nodeId).then(function (access) {
    if (access) {
      sync.authenticated = true
      sync.authenticating = false

      callback()
      for (var i = 0; i < sync.unauthenticated.length; i++) {
        sync.onMessage(sync.unauthenticated[i])
      }
      sync.unauthenticated = []
    } else {
      sync.sendError(new SyncError(sync, 'wrong-credentials'))
      sync.destroy()
    }
  })
}

function checkProtocol (sync, ver) {
  sync.remoteProtocol = ver

  if (ver >= sync.minProtocol) {
    return true
  } else {
    sync.sendError(new SyncError(sync, 'wrong-protocol', {
      supported: sync.minProtocol, used: ver
    }))
    sync.destroy()
    return false
  }
}

function emitEvent (sync) {
  try {
    sync.emitter.emit('connect')
  } catch (e) {
    if (e.name === 'SyncError') {
      sync.sendError(e)
      return false
    } else {
      throw e
    }
  }
  return true
}

module.exports = {

  sendConnect: function sendConnect () {
    var message = [
      'connect',
      this.localProtocol,
      this.localNodeId,
      this.lastReceived
    ]

    var options = { }
    if (this.options.credentials) {
      options.credentials = this.options.credentials
    }
    if (this.options.subprotocol) {
      options.subprotocol = this.options.subprotocol
    }
    if (Object.keys(options).length > 0) message.push(options)

    if (this.options.fixTime) this.connectSended = this.now()
    this.startTimeout()
    this.send(message)
  },

  sendConnected: function sendConnected (start, end) {
    var message = [
      'connected',
      this.localProtocol,
      this.localNodeId,
      [start, end]
    ]

    var options = { }
    if (this.options.credentials) {
      options.credentials = this.options.credentials
    }
    if (this.options.subprotocol) {
      options.subprotocol = this.options.subprotocol
    }
    if (Object.keys(options).length > 0) message.push(options)

    this.send(message)
  },

  connectMessage: function connectMessage (ver, nodeId, synced, options) {
    var start = this.now()
    if (!options) options = { }

    this.remoteNodeId = nodeId
    if (!checkProtocol(this, ver)) return

    this.remoteSubprotocol = options.subprotocol || '0.0.0'

    if (!emitEvent(this)) {
      this.destroy()
      return
    }

    var sync = this
    auth(this, nodeId, options.credentials, function () {
      sync.sendConnected(start, sync.now())
      sync.syncSince(synced)
    })
  },

  connectedMessage: function connectedMessage (ver, nodeId, time, options) {
    if (!options) options = { }

    this.endTimeout()
    this.remoteNodeId = nodeId
    if (!checkProtocol(this, ver)) return

    if (this.options.fixTime) {
      var now = this.now()
      var authTime = time[1] - time[0]
      var roundTrip = now - this.connectSended - authTime
      this.timeFix = Math.floor(this.connectSended - time[0] + (roundTrip / 2))
    }

    this.remoteSubprotocol = options.subprotocol || '0.0.0'

    if (!emitEvent(this)) {
      this.destroy()
      return
    }

    var sync = this
    auth(this, nodeId, options.credentials, function () {
      sync.syncSince(sync.lastSent)
    })
  }

}
