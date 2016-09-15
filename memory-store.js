var SortedArray = require('sorted-array')

var compareTime = require('./compare-time')

function compareCreated (a, b) {
  return compareTime(b[1].created, a[1].created)
}

function compareAdded (a, b) {
  return b[1].added - a[1].added
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
  this.added = new SortedArray([], compareAdded)
}

MemoryStore.prototype = {

  get: function get (order) {
    var data = order === 'added' ? this.added : this.created
    return Promise.resolve({ data: data.array })
  },

  add: function add (entry) {
    this.created.insert(entry)
    this.added.insert(entry)
  },

  remove: function remove (entry) {
    this.created.remove(entry)
    this.added.remove(entry)
  }

}

module.exports = MemoryStore
