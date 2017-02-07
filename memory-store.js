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

  get: function get (opts) {
    var entries
    if (opts.order === 'created') {
      entries = this.created
    } else {
      entries = this.added
    }
    if (opts.reason) {
      entries = entries.filter(function (i) {
        return i[1].reasons.indexOf(opts.reason) !== -1
      })
    }
    return Promise.resolve({ entries: convert(entries) })
  },

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

  remove: function remove (id) {
    var created = this.find(id)
    if (created === -1) return
    var added = this.created[created][1].added
    this.created.splice(created, 1)

    for (var i = this.added.length - 1; i >= 0; i--) {
      if (this.added[i][1].added === added) {
        this.added.splice(i, 1)
        break
      }
    }
  },

  has: function (id) {
    return Promise.resolve(this.find(id) !== -1)
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
  },

  changeMeta: function changeMeta (id, diff) {
    var num = id[0]
    var cache = id.slice(1).join('\t')
    var i, entry, meta
    for (i = this.created.length - 1; i >= 0; i--) {
      entry = this.created[i]
      meta = entry[1]
      if (meta.id[0] === num && entry[2] === cache) {
        for (var key in diff) meta[key] = diff[key]
        return Promise.resolve(true)
      }
    }
    return Promise.resolve(false)
  },

  find: function find (id) {
    var list = this.created
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

}

module.exports = MemoryStore
