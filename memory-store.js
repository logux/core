var SortedArray = require('sorted-array')

var compareTime = require('./compare-time')

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
    return compareTime(b.time, a.time)
  }
}

module.exports = MemoryStore
