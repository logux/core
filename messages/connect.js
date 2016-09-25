module.exports = {

  sendConnect: function sendConnect () {
    this.send([
      'connect',
      this.protocol,
      this.host
    ])
  },

  sendConnected: function sendConnected () {
    this.send([
      'connected',
      this.protocol,
      this.host
    ])
  },

  connectMessage: function connectMessage (protocol, host) {
    this.otherHost = host
    this.otherProtocol = protocol

    var major = this.protocol[0]
    if (major !== protocol[0]) {
      this.sendError('Only ' + major + '.x protocols are supported, ' +
                     'but you use ' + protocol.join('.'), 'protocol')
    } else {
      this.sendConnected()
    }
  },

  connectedMessage: function connectedMessage (protocol, host) {
    this.otherHost = host
    this.otherProtocol = protocol
  }

}
