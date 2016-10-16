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
    var sync = this
    var promises = []
    for (var i = 1; i < arguments.length - 1; i += 2) {
      var event = arguments[i]
      var meta = { created: arguments[i + 1] }

      var process = Promise.resolve([event, meta])
      if (this.options.inFilter) {
        process = process.then(function (data) {
          return sync.options.inFilter(data[0], data[1])
            .then(function (result) {
              if (result) {
                return data
              } else {
                return false
              }
            })
        })
      }

      process.then(function (data) {
        if (!data) return false

        if (sync.timeFix) meta.created = fixTime(meta.created, sync.timeFix)
        if (sync.options.inMap) {
          return sync.options.inMap(data[0], data[1])
        } else {
          return data
        }
      }).then(function (changed) {
        if (!changed) return false
        sync.received[sync.log.lastAdded + 1] = true
        return sync.log.add(changed[0], changed[1])
      })

      promises.push(process)
    }

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
