var SyncError = require('../sync-error')

function auth (node, nodeId, credentials, callback) {
  if (!node.options.auth) {
    node.authenticated = true
    callback()
    return
  }

  node.authenticating = true
  node.options.auth(credentials, nodeId).then(function (access) {
    if (access) {
      node.authenticated = true
      node.authenticating = false

      callback()
      for (var i = 0; i < node.unauthenticated.length; i++) {
        node.onMessage(node.unauthenticated[i])
      }
      node.unauthenticated = []
    } else {
      node.sendError(new SyncError('wrong-credentials'))
      node.destroy()
    }
  }).catch(function (e) {
    if (e.name === 'SyncError') {
      node.sendError(e)
      node.destroy()
    } else {
      node.error(e)
    }
  })
}

function checkProtocol (node, ver) {
  node.remoteProtocol = ver

  if (ver >= node.minProtocol) {
    return true
  } else {
    node.sendError(new SyncError('wrong-protocol', {
      supported: node.minProtocol, used: ver
    }))
    node.destroy()
    return false
  }
}

function emitEvent (node) {
  try {
    node.emitter.emit('connect')
  } catch (e) {
    if (e.name === 'SyncError') {
      node.sendError(e)
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

    var node = this
    auth(this, nodeId, options.credentials, function () {
      node.baseTime = node.now()
      node.sendConnected(start, node.baseTime)
      node.syncSince(synced)
    })
  },

  connectedMessage: function connectedMessage (ver, nodeId, time, options) {
    if (!options) options = { }

    this.endTimeout()
    this.remoteNodeId = nodeId
    if (!checkProtocol(this, ver)) return

    this.baseTime = time[1]

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

    var node = this
    auth(this, nodeId, options.credentials, function () {
      node.syncSince(node.lastSent)
    })
  }

}
