function fixTime (created, fix) {
  return [created[0] + fix].concat(created.slice(1))
}

module.exports = {

  sendSync: function sendSync (event, meta) {
    this.startTimeout()

    var created = meta.created
    if (this.timeFix) created = fixTime(meta.created, -this.timeFix)

    this.send(['sync', event, created, meta.added])
  },

  sendSynced: function sendSynced (added) {
    this.send(['synced', added])
  },

  syncMessage: function syncMessage (event, created, added) {
    var meta = { created: created }
    if (this.options.inFilter && !this.options.inFilter(event, meta)) {
      return
    }

    if (this.timeFix) meta.created = fixTime(meta.created, this.timeFix)

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
