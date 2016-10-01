function auth (sync, host, credentials, callback) {
  if (!sync.options.auth) {
    sync.authenticated = true
    callback()
    return
  }

  sync.authenticating = true
  sync.options.auth(credentials, host).then(function (access) {
    if (access) {
      sync.authenticated = true
      sync.authenticating = false

      callback()
      for (var i = 0; i < sync.unauthenticated.length; i++) {
        sync.onMessage(sync.unauthenticated[i])
      }
      sync.unauthenticated = []
    } else {
      sync.sendError('Wrong credentials', 'auth')
      sync.destroy()
    }
  })
}

module.exports = {

  sendConnect: function sendConnect () {
    var message = ['connect', this.protocol, this.host, this.otherSynced]
    if (this.options.credentials) message.push(this.options.credentials)
    if (this.options.fixTime) this.connectSended = this.log.timer()[0]
    this.startTimeout()
    this.send(message)
  },

  sendConnected: function sendConnected (start, end) {
    var message = ['connected', this.protocol, this.host, [start, end]]
    if (this.options.credentials) message.push(this.options.credentials)
    this.send(message)
  },

  connectMessage: function connectMessage (ver, host, synced, credentials) {
    this.otherHost = host
    this.otherProtocol = ver

    var major = this.protocol[0]
    if (major !== ver[0]) {
      this.sendError('Only ' + major + '.x protocols are supported, ' +
                     'but you use ' + ver.join('.'), 'protocol')
      this.destroy()
      return
    }

    var sync = this
    var start = this.log.timer()[0]
    auth(this, host, credentials, function () {
      sync.sendConnected(start, sync.log.timer()[0])
      sync.syncSince(synced)
    })
  },

  connectedMessage: function connectedMessage (ver, host, time, credentials) {
    this.endTimeout()
    this.otherHost = host
    this.otherProtocol = ver

    if (this.options.fixTime) {
      var now = this.log.timer()[0]
      var authTime = time[1] - time[0]
      var roundTrip = now - this.connectSended - authTime
      this.timeFix = this.connectSended - time[0] + roundTrip / 2
    }

    var sync = this
    auth(this, host, credentials, function () {
      sync.syncSince(sync.synced)
    })
  }

}
