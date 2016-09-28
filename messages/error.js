module.exports = {

  sendError: function sendError (desc, type) {
    this.send(['error', desc, type])
    this.emitter.emit('sendedError', desc, type)
  },

  errorMessage: function errorMessage (desc, type) {
    this.error(desc, type, true)
  }

}
