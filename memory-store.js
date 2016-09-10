var SortedArray = require('sorted-array')

/**
 * Simpliest memory-based events store.
 *
 * It is good for tests, but not for server or client usage,
 * because it doesn’t save events to file or localStorage.
 *
 * @example
 * import MemoryStore from 'logux-core/memory-store'
 *
 * var log = new Log({
 *   store: new MemoryStore(),
 *   timer: createTestTimer()
 * })
 *
 * @class
 */
function MemoryStore () {
  this.store = new SortedArray([], this.compare)
}

MemoryStore.prototype = {

  get: function get () {
    return Promise.resolve({ data: this.store.array })
  },

  add: function add (event) {
    this.store.insert(event)
  },

  compare: function compare (a, b) {
    var aTime = a.time
    var bTime = b.time
    for (var i = 0; i < aTime.length; i++) {
      if (aTime[i] > bTime[i]) {
        return -1
      } else if (aTime[i] < bTime[i]) {
        return 1
      }
    }
    return 0
  }
}

module.exports = MemoryStore
