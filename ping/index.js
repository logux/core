export function sendPing() {
  this.startTimeout()
  this.send(['ping', this.lastAddedCache])
  if (this.pingTimeout) clearTimeout(this.pingTimeout)
}

export function pingMessage(synced) {
  if (this.connected && this.authenticated) {
    this.send(['pong', this.lastAddedCache])
  }
  this.saveReceived(synced)
}

export function pongMessage(synced) {
  this.endTimeout()
  this.saveReceived(synced)
}
