module.exports = {

  sendPing: function sendPing () {
    this.startTimeout()
    this.send(['ping', this.log.lastAdded])
  },

  pingMessage: function pingMessage () {
    this.send(['pong', this.log.lastAdded])
  },

  pongMessage: function pongMessage () {
    this.endTimeout()
  }

}
