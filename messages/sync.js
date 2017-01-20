module.exports = {

  sendSync: function sendSync () {
    this.startTimeout()

    var max = 0
    var data = []
    for (var i = 0; i < arguments.length - 1; i += 2) {
      var meta = arguments[i + 1]
      var time = meta.time
      if (this.timeFix) time = time - this.timeFix
      if (max < meta.added) max = meta.added
      data.push(arguments[i], { id: meta.id, time: time })
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
      var action = arguments[i]
      var meta = arguments[i + 1]

      var process = Promise.resolve([action, meta])
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

        if (sync.timeFix) data[1].time = data[1].time + sync.timeFix
        if (sync.options.inMap) {
          return sync.options.inMap(data[0], data[1])
        } else {
          return data
        }
      }).then(function (changed) {
        if (!changed) return false
        sync.received[changed[1].id.join('\t')] = true
        return sync.log.add(changed[0], changed[1])
      })

      promises.push(process)
    }

    Promise.all(promises).then(function () {
      sync.setOtherSynced(added)
      sync.sendSynced(added)
    })
  },

  syncedMessage: function syncedMessage (synced) {
    this.setSynced(synced)
    if (this.syncing > 0) this.syncing -= 1
    if (this.syncing === 0) {
      this.endTimeout()
      this.setState('synchronized')
    }
  }

}
