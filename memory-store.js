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

  removeReason: function (reason, criteria, callback) {
    var removed = []
    this.created = this.created.filter(function (entry) {
      var meta = entry[1]
      if (meta.reasons.indexOf(reason) === -1) return true
      if (criteria.minAdded && meta.added < criteria.minAdded) return true
      if (criteria.maxAdded && meta.added > criteria.maxAdded) return true

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
    var index = this.find(id)
    if (index === -1) {
      return Promise.resolve(false)
    } else {
      var meta = this.created[index][1]
      for (var key in diff) meta[key] = diff[key]
      return Promise.resolve(true)
    }
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
