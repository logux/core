export async function sendReady() {
  if (this.readySent) return
  this.readySent = true

  if (this.options.ready) {
    try {
      await this.options.ready()
    } catch (e) {
      this.error(e)
      return
    }
  }

  // `ready` must not overtake `sync` messages, which are still in `onSend()`
  await this.sending

  this.send(['ready', this.lastAddedCache])
}

export async function readyMessage(added) {
  await this.receiving

  if (added > this.lastReceived) this.setLastReceived(added)
  if (!this.remoteReady) {
    this.remoteReady = true
    this.emitter.emit('ready')
  }
}
