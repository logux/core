function fixTime (created, fix) {
  return [created[0] + fix].concat(created.slice(1))
}

module.exports = {

  sendSync: function sendSync () {
    this.startTimeout()

    var max = 0
    var data = []
    for (var i = 0; i < arguments.length - 1; i += 2) {
      var created = arguments[i + 1].created
      var added = arguments[i + 1].added
      if (this.timeFix) created = fixTime(created, -this.timeFix)
      if (max < added) max = added
      data.push(arguments[i], created)
    }

    this.syncing += 1
    this.setState('sending')
    this.send(['sync', max].concat(data))
  },

  sendSynced: function sendSynced (added) {
    this.send(['synced', added])
  },

  syncMessage: function syncMessage (added) {
    var promises = []
    for (var i = 1; i < arguments.length - 1; i += 2) {
      var event = arguments[i]
      var meta = { created: arguments[i + 1] }

      if (this.options.inFilter && !this.options.inFilter(event, meta)) {
        return
      }

      if (this.timeFix) meta.created = fixTime(meta.created, this.timeFix)
      if (this.options.inMap) {
        var changed = this.options.inMap(event, meta)
        event = changed[0]
        meta = changed[1]
      }

      this.received[this.log.lastAdded + 1] = true
      promises.push(this.log.add(event, meta))
    }

    var sync = this
    Promise.all(promises).then(function () {
      if (sync.otherSynced < added) sync.otherSynced = added
      sync.sendSynced(added)
    })
  },

  syncedMessage: function syncedMessage (synced) {
    if (this.synced < synced) this.synced = synced
    if (this.syncing > 0) this.syncing -= 1
    if (this.syncing === 0) {
      this.endTimeout()
      this.setState('synchronized')
    }
  }

}
