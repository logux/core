module.exports = {

  sendSync: function sendSync (added, entries) {
    this.startTimeout()

    var data = []
    for (var i = 0; i < entries.length; i++) {
      var originMeta = entries[i][1]

      var meta = { }
      for (var key in originMeta) {
        if (key === 'id') {
          meta.id = originMeta.id.split(' ')
        } else if (key !== 'added') {
          meta[key] = originMeta[key]
        }
      }

      if (this.timeFix) meta.time -= this.timeFix
      meta.id[0] = parseInt(meta.id[0]) - this.baseTime
      meta.id[2] = parseInt(meta.id[2])
      meta.time -= this.baseTime

      if (meta.id[1] === this.localNodeId) {
        if (meta.id[2] === 0) {
          meta.id = meta.id[0]
        } else {
          meta.id = [meta.id[0], meta.id[2]]
        }
      }

      data.unshift(entries[i][0], meta)
    }

    this.syncing += 1
    this.setState('sending')
    this.send(['sync', added].concat(data))
  },

  sendSynced: function sendSynced (added) {
    this.send(['synced', added])
  },

  syncMessage: function syncMessage (added) {
    var node = this
    var promises = []

    for (var i = 1; i < arguments.length - 1; i += 2) {
      var action = arguments[i]
      var meta = arguments[i + 1]

      if (typeof meta.id === 'number') {
        meta.id = (meta.id + this.baseTime) + ' ' + this.remoteNodeId + ' ' + 0
      } else {
        meta.id[0] = meta.id[0] + this.baseTime
        if (meta.id.length === 2) {
          meta.id = meta.id[0] + ' ' + this.remoteNodeId + ' ' + meta.id[1]
        } else {
          meta.id = meta.id.join(' ')
        }
      }

      meta.time = meta.time + this.baseTime

      var process
      if (this.options.inFilter) {
        process = node.options.inFilter(action, meta).then(function (res) {
          return res ? [action, meta] : false
        }).catch(function (e) {
          node.error(e)
        })
      } else {
        process = Promise.resolve([action, meta])
      }

      process.then(function (data) {
        if (!data) return false

        if (node.timeFix) data[1].time = data[1].time + node.timeFix
        if (node.options.inMap) {
          return node.options.inMap(data[0], data[1]).catch(function (e) {
            node.error(e)
          })
        } else {
          return data
        }
      }).then(function (changed) {
        if (!changed) return false
        node.received[changed[1].id] = true
        return node.log.add(changed[0], changed[1])
      })

      promises.push(process)
    }

    Promise.all(promises).then(function () {
      node.setLastReceived(added)
      node.sendSynced(added)
    })
  },

  syncedMessage: function syncedMessage (synced) {
    this.endTimeout()
    this.setLastSent(synced)
    if (this.syncing > 0) this.syncing -= 1
    if (this.syncing === 0) {
      this.setState('synchronized')
    }
  }

}
