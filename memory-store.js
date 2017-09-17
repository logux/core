var isFirstOlder = require('./is-first-older')

function convert (list) {
  return list.map(function (i) {
    return [i[0], i[1]]
  })
}

function insert (store, entry) {
  store.lastAdded += 1
  entry[1].added = store.lastAdded
  store.added.unshift(entry)
  return Promise.resolve(entry[1])
}

function find (list, id) {
  var num = id[0]
  var cache = id.slice(1).join('\t')
  var m = 0
  var n = list.length - 1
  while (m <= n) {
    var i = (n + m) >> 1
    var entry = list[i]
    var otherNum = entry[1].id[0]
    if (otherNum > num) {
      m = i + 1
    } else if (otherNum < num) {
      n = i - 1
    } else if (entry[2] > cache) {
      m = i + 1
    } else if (entry[2] < cache) {
      n = i - 1
    } else {
      return i
    }
  }
  return -1
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
    var cache = meta.id.slice(1).join('\t')
    var entry = [action, meta, cache]

    var list = this.created
    for (var i = 0; i < list.length; i++) {
      var other = list[i]
      if (meta.id[0] === other[1].id[0] && cache === other[2]) {
        return Promise.resolve(false)
      } else if (isFirstOlder(other[1], meta) > 0) {
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

  remove: function remove (id) {
    var created = find(this.created, id)
    if (created === -1) return Promise.resolve(false)

    var entry = [this.created[created][0], this.created[created][1]]
    this.created.splice(created, 1)

    var added = entry[1].added
    var m = 0
    var n = this.added.length - 1
    while (m <= n) {
      var i = (n + m) >> 1
      var otherAdded = this.added[i][1].added
      if (otherAdded > added) {
        m = i + 1
      } else if (otherAdded < added) {
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
    return Promise.resolve({ entries: convert(entries) })
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
    this.created = this.created.filter(function (entry) {
      var meta = entry[1]
      var c = criteria

      if (meta.reasons.indexOf(reason) === -1) {
        return true
      }
      if (typeof c.minAdded !== 'undefined' && meta.added < c.minAdded) {
        return true
      }
      if (typeof c.maxAdded !== 'undefined' && meta.added > c.maxAdded) {
        return true
      }

      var reasons = meta.reasons
      reasons.splice(reasons.indexOf(reason), 1)
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
