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
 */
function MemoryStore () {
  this.created = []
  this.added = []
}

MemoryStore.prototype = {

  get: function get (order) {
    if (order === 'created') {
      return Promise.resolve({ data: this.created })
    } else {
      return Promise.resolve({ data: this.added })
    }
  },

  add: function add (entry) {
    this.added.unshift(entry)

    var time = entry[1].created
    var list = this.created
    for (var i = 0; i < list.length; i++) {
      var compare = compareTime(time, list[i][1].created)
      if (compare > 0) {
        list.splice(i, 0, entry)
        return true
      } else if (compare === 0) {
        return false
      }
    }
    list.push(entry)
    return true
  },

  search: function search (time) {
    var list = this.created
    var high = list.length
    var low = 0

    while (high > low) {
      var i = (high + low) / 2 >>> 0
      var compare = compareTime(time, list[i][1].created)

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

  remove: function remove (time) {
    var index = this.search(time)
    if (index === -1) return
    this.created.splice(index, 1)

    for (var i = this.added.length - 1; i >= 0; i--) {
      if (compareTime(this.added[i][1].created, time) === 0) {
        this.added.splice(i, 1)
        break
      }
    }
  }

}

module.exports = MemoryStore
