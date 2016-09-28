module.exports = {

  sendPing: function sendPing () {
    this.startTimeout()
    this.send(['ping'])
  },

  pingMessage: function pingMessage (time) {
    this.send(['pong'])
  },

  pongMessage: function pongMessage (time) {
    this.endTimeout()
  }

}
