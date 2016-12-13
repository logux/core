var compareTime = require('./compare-time')

/**
 * Simple memory-based events store.
 *
 * It is good for tests, but not for server or client usage,
 * because it doesn’t save events to file or localStorage.
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
}

MemoryStore.prototype = {

  get: function get (order) {
    if (order === 'created') {
      return Promise.resolve({ entries: this.created.slice(0) })
    } else {
      return Promise.resolve({ entries: this.added.slice(0) })
    }
  },

  add: function add (entry) {
    this.added.unshift(entry)

    var list = this.created
    var id = entry[1].id
    for (var i = 0; i < list.length; i++) {
      var compare = compareTime(id, list[i][1].id)
      if (compare > 0) {
        list.splice(i, 0, entry)
        return Promise.resolve(true)
      } else if (compare === 0) {
        return Promise.resolve(false)
      }
    }
    list.push(entry)
    return Promise.resolve(true)
  },

  search: function search (id) {
    var list = this.created
    var high = list.length
    var low = 0

    while (high > low) {
      var i = (high + low) / 2 >>> 0
      var compare = compareTime(id, list[i][1].id)

      if (compare < 0) {
        low = i + 1
      } else if (compare > 0) {
        high = i
      } else {
        return i
      }
    }

    return -1
  },

  remove: function remove (id) {
    var index = this.search(id)
    if (index === -1) return
    this.created.splice(index, 1)

    for (var i = this.added.length - 1; i >= 0; i--) {
      if (compareTime(this.added[i][1].id, id) === 0) {
        this.added.splice(i, 1)
        break
      }
    }
  }

}

module.exports = MemoryStore
