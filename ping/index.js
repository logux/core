function sendPing () {
  this.startTimeout()
  this.send(['ping', this.lastAddedCache])
  if (this.pingTimeout) clearTimeout(this.pingTimeout)
}

function pingMessage (synced) {
  this.setLastReceived(synced)
  if (this.connected && this.authenticated) {
    this.send(['pong', this.lastAddedCache])
  }
}

function pongMessage (synced) {
  this.setLastReceived(synced)
  this.endTimeout()
}

module.exports = { sendPing, pingMessage, pongMessage }
