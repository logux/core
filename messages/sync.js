module.exports = {

  sendSync: function sendSync (added, entries) {
    this.startTimeout()

    var data = []
    for (var i = 0; i < entries.length; i++) {
      var originMeta = entries[i][1]

      var meta = { }
      for (var key in originMeta) {
        if (key !== 'added') {
          meta[key] = originMeta[key]
        }
      }

      if (this.timeFix) meta.time -= this.timeFix
      meta.id[0] -= this.baseTime
      meta.time -= this.baseTime

      if (meta.id[1] === this.localNodeId) {
        if (meta.id[2] === 0) {
          meta.id = meta.id[0]
        } else {
          meta.id = [meta.id[0], meta.id[2]]
        }
      }

      data.push(entries[i][0], meta)
    }

    this.syncing += 1
    this.setState('sending')
    this.send(['sync', added].concat(data))
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

      if (typeof meta.id === 'number') {
        meta.id = [meta.id, this.remoteNodeId, 0]
      } else if (meta.id.length === 2) {
        meta.id = [meta.id[0], this.remoteNodeId, meta.id[1]]
      }

      meta.id[0] = meta.id[0] + this.baseTime
      meta.time = meta.time + this.baseTime

      var process = Promise.resolve([action, meta])
      if (this.options.inFilter) {
        process = process.then(function (data) {
          return sync.options.inFilter(data[0], data[1]).then(function (res) {
            if (res) {
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
      sync.setLastReceived(added)
      sync.sendSynced(added)
    })
  },

  syncedMessage: function syncedMessage (synced) {
    this.setLastSent(synced)
    if (this.syncing > 0) this.syncing -= 1
    if (this.syncing === 0) {
      this.endTimeout()
      this.setState('synchronized')
    }
  }

}
