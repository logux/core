function sendDebug (type, data) {
  this.send(['debug', type, data])
}

function debugMessage (type, data) {
  this.emitter.emit('debug', type, data)
}

module.exports = { sendDebug, debugMessage }
