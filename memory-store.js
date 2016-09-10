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
  this.store = []
}

MemoryStore.prototype = {

  get: function get () {
    return Promise.resolve({ data: this.store })
  },

  add: function add (event) {
    var store = this.store
    var time = event.time
    var insert
    for (var i = 0; i < store.length; i++) {
      insert = false
      var other = store[i].time

      for (var j = 0; j < time.length; j++) {
        if (time[j] > other[j]) {
          insert = true
          break
        } else if (time[j] < other[j]) {
          break
        }
      }

      if (insert) {
        store.splice(i, 0, event)
        break
      }
    }
    if (!insert) store.push(event)
  }
}

module.exports = MemoryStore
