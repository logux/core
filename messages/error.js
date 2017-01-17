module.exports = {

  sendError: function sendError (error) {
    var message = ['error', error.type]
    if (typeof error.options !== 'undefined') message.push(error.options)
    this.send(message)

    this.emitter.emit('clientError', error)
  },

  errorMessage: function errorMessage (type, options) {
    this.syncError(type, options, true)
  }

}
