module.exports = {

  sendPing: function sendPing () {
    this.startTimeout()
    this.send(['ping', this.log.lastAdded])
  },

  pingMessage: function pingMessage (synced) {
    if (this.otherSynced < synced) this.otherSynced = synced
    this.send(['pong', this.log.lastAdded])
  },

  pongMessage: function pongMessage (synced) {
    if (this.otherSynced < synced) this.otherSynced = synced
    this.endTimeout()
  }

}
