var isFirstOlder = require('./is-first-older')

function convert (list) {
  return list.map(function (i) {
    return [i[0], i[1]]
  })
}

/**
 * Simple memory-based log store.
 *
 * It is good for tests, but not for server or client usage,
 * because it doesn’t save log to file or localStorage.
 *
 * Think about this store as a basic store realization.
 *
 * Every Store class should provide 5 standard methods:
 * add, get, remove, getLatestSynced and setLatestSynced.
 *
 * @example
 * import { MemoryStore } from 'logux-core'
 *
 * var log = new Log({
 *   store: new MemoryStore(),
 *   timer: createTestTimer()
 * })
 *
 * @class
 * @extends Store
 */
function MemoryStore () {
  this.created = []
  this.added = []
  this.latestReceived = 0
  this.latestSent = 0
}

MemoryStore.prototype = {

  get: function get (order) {
    if (order === 'created') {
      return Promise.resolve({ entries: convert(this.created) })
    } else {
      return Promise.resolve({ entries: convert(this.added) })
    }
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
        this.added.unshift(entry)
        return Promise.resolve(true)
      }
    }

    list.push(entry)
    this.added.unshift(entry)
    return Promise.resolve(true)
  },

  remove: function remove (id) {
    var num = id[0]
    var cache = id.slice(1).join('\t')
    var i, entry
    for (i = this.created.length - 1; i >= 0; i--) {
      entry = this.created[i]
      if (entry[1].id[0] === num && entry[2] === cache) {
        this.created.splice(i, 1)
        break
      }
    }
    for (i = this.added.length - 1; i >= 0; i--) {
      entry = this.added[i]
      if (entry[1].id[0] === num && entry[2] === cache) {
        this.added.splice(i, 1)
        break
      }
    }
  },

  getLatestSynced: function getLatestSynced () {
    return Promise.resolve({
      received: this.latestReceived,
      sent: this.latestSent
    })
  },

  setLatestSynced: function setLatestSynced (values) {
    if (typeof values.sent !== 'undefined') {
      this.latestSent = values.sent
    }
    if (typeof values.received !== 'undefined') {
      this.latestReceived = values.received
    }
    return Promise.resolve()
  }

}

module.exports = MemoryStore
