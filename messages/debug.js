module.exports = {

  sendDebug: function sendDebug (type, data) {
    this.send(['debug', type, data])
  },

  debugMessage: function debugMessage (type, data) {
    this.emitter.emit('debug', type, data)
  }

}
