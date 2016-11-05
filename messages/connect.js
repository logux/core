function auth (sync, uniqName, credentials, callback) {
  if (!sync.options.auth) {
    sync.authenticated = true
    callback()
    return
  }

  sync.authenticating = true
  sync.options.auth(credentials, uniqName).then(function (access) {
    if (access) {
      sync.authenticated = true
      sync.authenticating = false

      callback()
      for (var i = 0; i < sync.unauthenticated.length; i++) {
        sync.onMessage(sync.unauthenticated[i])
      }
      sync.unauthenticated = []
    } else {
      sync.sendError('wrong-credentials')
      sync.destroy()
    }
  })
}

function checkSubprotocol (sync, subprotocol) {
  if (!subprotocol) subprotocol = [0, 0]
  sync.otherSubprotocol = subprotocol

  if (!sync.options.supports) {
    return true
  } else {
    var supported = sync.options.supports.some(function (i) {
      return i === subprotocol[0]
    })

    if (!supported) {
      sync.sendError('wrong-subprotocol', {
        supported: sync.options.supports,
        used: subprotocol
      })
      sync.destroy()
    }
    return supported
  }
}

module.exports = {

  sendConnect: function sendConnect () {
    var message = ['connect', this.protocol, this.uniqName, this.otherSynced]

    var options = { }
    if (this.options.credentials) {
      options.credentials = this.options.credentials
    }
    if (this.options.subprotocol) {
      options.subprotocol = this.options.subprotocol
    }
    if (Object.keys(options).length > 0) message.push(options)

    if (this.options.fixTime) this.connectSended = this.log.timer()[0]
    if (this.log.lastAdded > this.synced) this.setState('sending')
    this.startTimeout()
    this.send(message)
  },

  sendConnected: function sendConnected (start, end) {
    var message = ['connected', this.protocol, this.uniqName, [start, end]]

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

  connectMessage: function connectMessage (ver, uniqName, synced, options) {
    if (!options) options = { }

    this.otherUniqName = uniqName
    this.otherProtocol = ver

    var major = this.protocol[0]
    if (major !== ver[0]) {
      this.sendError('wrong-protocol', { supported: [major], used: ver })
      this.destroy()
      return
    }

    if (!checkSubprotocol(this, options.subprotocol)) {
      return
    }

    var sync = this
    var start = this.log.timer()[0]
    auth(this, uniqName, options.credentials, function () {
      sync.sendConnected(start, sync.log.timer()[0])
      sync.syncSince(synced)
    })
  },

  connectedMessage: function connectedMessage (ver, uniqName, time, options) {
    if (!options) options = { }

    this.endTimeout()
    this.otherUniqName = uniqName
    this.otherProtocol = ver

    if (this.options.fixTime) {
      var now = this.log.timer()[0]
      var authTime = time[1] - time[0]
      var roundTrip = now - this.connectSended - authTime
      this.timeFix = this.connectSended - time[0] + roundTrip / 2
    }

    if (!checkSubprotocol(this, options.subprotocol)) {
      return
    }

    var sync = this
    auth(this, uniqName, options.credentials, function () {
      sync.syncSince(sync.synced)
    })
  }

}
