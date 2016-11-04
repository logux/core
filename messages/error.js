var SyncError = require('../sync-error')

module.exports = {

  sendError: function sendError (type, options) {
    var message = ['error', type]
    if (typeof options !== 'undefined') message.push(options)
    this.send(message)

    var error = new SyncError(this, type, options)
    this.emitter.emit('clientError', error)
  },

  errorMessage: function errorMessage (type, options) {
    this.error(type, options, true)
  }

}
