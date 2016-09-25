module.exports = {

  sendError: function sendError (desc) {
    this.send(['error', desc])
  },

  errorMessage: function errorMessage (desc) {
    this.emitter.emit('error', desc)
    if (this.throwsError) {
      throw new Error('Logux received a error: ' + desc)
    }
  }

}
