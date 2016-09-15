var SortedArray = require('sorted-array')

var compareTime = require('./compare-time')

function compareCreated (a, b) {
  return compareTime(b[1].created, a[1].created)
}

/**
 * Simpliest memory-based events store.
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
  this.created = new SortedArray([], compareCreated)
  this.added = []
}

MemoryStore.prototype = {

  get: function get (order) {
    if (order === 'added') {
      return Promise.resolve({ data: this.added })
    } else {
      return Promise.resolve({ data: this.created.array })
    }
  },

  add: function add (entry) {
    this.created.insert(entry)
    this.added.unshift(entry)
  },

  remove: function remove (entry) {
    this.created.remove(entry)
    for (var i = this.added.length - 1; i >= 0; i--) {
      if (compareTime(this.added[i][1].created, entry[1].created) === 0) {
        this.added.splice(i, 1)
        break
      }
    }
  }

}

module.exports = MemoryStore
