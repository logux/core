function sendHeaders (data) {
  this.send(['headers', data])
}

function headersMessage (data) {
  this.remoteHeaders = data
  this.emitter.emit('headers', data)
}

module.exports = { sendHeaders, headersMessage }
