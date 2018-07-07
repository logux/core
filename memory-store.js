var isFirstOlder = require('./is-first-older')

function insert (store, entry) {
  store.lastAdded += 1
  entry[1].added = store.lastAdded
  store.added.push(entry)
  return Promise.resolve(entry[1])
}

function find (list, id) {
  for (var i = list.length - 1; i >= 0; i--) {
    if (id === list[i][1].id) {
      return i
    }
  }
  return -1
}

function isDefined (value) {
  return typeof value !== 'undefined'
}

/**
 * Simple memory-based log store.
 *
 * It is good for tests, but not for server or client usage,
 * because it store all data in memory and will lose log on exit.
 *
 * @example
 * import { MemoryStore } from 'logux-core'
 *
 * var log = new Log({
 *   nodeId: 'server',
 *   store: new MemoryStore()
 * })
 *
 * @class
 * @extends Store
 */
function MemoryStore () {
  this.created = []
  this.added = []
  this.lastReceived = 0
  this.lastAdded = 0
  this.lastSent = 0
}

MemoryStore.prototype = {

  add: function add (action, meta) {
    var entry = [action, meta]
    var id = meta.id

    var list = this.created
    for (var i = 0; i < list.length; i++) {
      var other = list[i]
      if (id === other[1].id) {
        return Promise.resolve(false)
      } else if (!isFirstOlder(other[1], meta)) {
        list.splice(i, 0, entry)
        return insert(this, entry)
      }
    }

    list.push(entry)
    return insert(this, entry)
  },

  byId: function byId (id) {
    var created = find(this.created, id)
    if (created === -1) {
      return Promise.resolve([null, null])
    } else {
      var entry = this.created[created]
      return Promise.resolve([entry[0], entry[1]])
    }
  },

  remove: function remove (id, created) {
    if (typeof created === 'undefined') {
      created = find(this.created, id)
      if (created === -1) return Promise.resolve(false)
    }

    var entry = [this.created[created][0], this.created[created][1]]
    this.created.splice(created, 1)

    var added = entry[1].added
    var m = 0
    var n = this.added.length - 1
    while (m <= n) {
      var i = (n + m) >> 1
      var otherAdded = this.added[i][1].added
      if (otherAdded < added) {
        m = i + 1
      } else if (otherAdded > added) {
        n = i - 1
      } else {
        this.added.splice(i, 1)
        break
      }
    }

    return Promise.resolve(entry)
  },

  get: function get (opts) {
    var entries
    if (opts.order === 'created') {
      entries = this.created
    } else {
      entries = this.added
    }
    return Promise.resolve({ entries: entries.slice(0) })
  },

  changeMeta: function changeMeta (id, diff) {
    var index = find(this.created, id)
    if (index === -1) {
      return Promise.resolve(false)
    } else {
      var meta = this.created[index][1]
      for (var key in diff) meta[key] = diff[key]
      return Promise.resolve(true)
    }
  },

  removeReason: function removeReason (reason, criteria, callback) {
    var removed = []
    var meta, reasonPos

    if (criteria.id) {
      var index = find(this.created, criteria.id)
      if (index !== -1) {
        meta = this.created[index][1]
        reasonPos = meta.reasons.indexOf(reason)
        if (reasonPos !== -1) {
          meta.reasons.splice(reasonPos, 1)
          if (meta.reasons.length === 0) {
            callback(this.created[index][0], meta)
            this.remove(criteria.id)
          }
        }
      }
    } else {
      this.created = this.created.filter(function (entry) {
        meta = entry[1]
        var c = criteria

        reasonPos = meta.reasons.indexOf(reason)
        if (reasonPos === -1) {
          return true
        }
        if (isDefined(c.olderThan) && !isFirstOlder(meta, c.olderThan)) {
          return true
        }
        if (isDefined(c.youngerThan) && !isFirstOlder(c.youngerThan, meta)) {
          return true
        }
        if (isDefined(c.minAdded) && meta.added < c.minAdded) {
          return true
        }
        if (isDefined(c.maxAdded) && meta.added > c.maxAdded) {
          return true
        }

        meta.reasons.splice(reasonPos, 1)
        if (meta.reasons.length === 0) {
          callback(entry[0], meta)
          removed.push(meta.added)
          return false
        } else {
          return true
        }
      })
      this.added = this.added.filter(function (entry) {
        return removed.indexOf(entry[1].added) === -1
      })
    }
    return Promise.resolve()
  },

  clean: function clean () {
    this.created = []
    this.added = []
    this.lastReceived = 0
    this.lastAdded = 0
    this.lastSent = 0
    return Promise.resolve()
  },

  getLastAdded: function getLastAdded () {
    return Promise.resolve(this.lastAdded)
  },

  getLastSynced: function getLastSynced () {
    return Promise.resolve({
      received: this.lastReceived,
      sent: this.lastSent
    })
  },

  setLastSynced: function setLastSynced (values) {
    if (typeof values.sent !== 'undefined') {
      this.lastSent = values.sent
    }
    if (typeof values.received !== 'undefined') {
      this.lastReceived = values.received
    }
    return Promise.resolve()
  }

}

module.exports = MemoryStore
