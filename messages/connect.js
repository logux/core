function handshake (sync, type) {
  var message = [type, sync.protocol, sync.host]
  if (sync.options.credentials) message.push(sync.options.credentials)
  return message
}

function auth (sync, host, credentials, callback) {
  if (!sync.options.auth) {
    sync.authenticated = true
    if (callback) callback()
    return
  }

  sync.options.auth(credentials, host).then(function (access) {
    if (access) {
      sync.authenticated = true
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
    this.send(handshake(this, 'connect'))
  },

  sendConnected: function sendConnected () {
    this.send(handshake(this, 'connected'))
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
    auth(this, host, credentials, function () {
      sync.sendConnected()
    })
  },

  connectedMessage: function connectedMessage (protocol, host, credentials) {
    this.otherHost = host
    this.otherProtocol = protocol
    auth(this, host, credentials)
  }

}
