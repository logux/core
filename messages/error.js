var SyncError = require('../sync-error')

module.exports = {

  sendError: function sendError (desc, type) {
    this.send(['error', desc, type])
    this.emitter.emit('sendedError', desc, type)
  },

  errorMessage: function errorMessage (desc, type) {
    var error = new SyncError(this, ['error', desc, type])
    this.emitter.emit('error', error)
    if (this.throwsError) {
      throw error
    }
  }

}
