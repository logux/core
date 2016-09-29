module.exports = {

  sendSync: function sendSync (event, meta) {
    this.startTimeout()
    this.send(['sync', event, meta.created, meta.added])
  },

  sendSynced: function sendSynced (added) {
    this.send(['synced', added])
  },

  syncMessage: function syncMessage (event, created, added) {
    var meta = { created: created }
    if (this.options.inFilter && !this.options.inFilter(event, meta)) {
      return
    }

    if (this.options.inMap) {
      var changed = this.options.inMap(event, meta)
      event = changed[0]
      meta = changed[1]
    }

    this.received = this.log.lastAdded + 1
    this.log.add(event, meta)
    this.sendSynced(added)
  },

  syncedMessage: function syncedMessage () {
    this.endTimeout()
  }

}
