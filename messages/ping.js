module.exports = {

  sendPing: function sendPing () {
    this.startTimeout()
    this.send(['ping', this.lastAddedCache])
    if (this.pingTimeout) clearTimeout(this.pingTimeout)
  },

  pingMessage: function pingMessage (synced) {
    this.setLastReceived(synced)
    this.send(['pong', this.lastAddedCache])
  },

  pongMessage: function pongMessage (synced) {
    this.setLastReceived(synced)
    this.endTimeout()
  }

}
