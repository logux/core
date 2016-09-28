function auth (sync, host, credentials, callback) {
  if (!sync.options.auth) {
    sync.authenticated = true
    if (callback) callback()
    return
  }

  sync.authenticating = true
  sync.options.auth(credentials, host).then(function (access) {
    if (access) {
      sync.authenticated = true
      sync.authenticating = false

      if (callback) callback()
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
    var message = ['connect', this.protocol, this.host]
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

  connectMessage: function connectMessage (protocol, host, credentials) {
    this.otherHost = host
    this.otherProtocol = protocol

    var major = this.protocol[0]
    if (major !== protocol[0]) {
      this.sendError('Only ' + major + '.x protocols are supported, ' +
                     'but you use ' + protocol.join('.'), 'protocol')
      this.destroy()
      return
    }

    var sync = this
    var start = this.log.timer()[0]
    auth(this, host, credentials, function () {
      sync.sendConnected(start, sync.log.timer()[0])
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

    auth(this, host, credentials)
  }

}
