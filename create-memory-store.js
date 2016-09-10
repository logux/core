/**
 * Return simpliest memory-based events store.
 *
 * It is good for tests, but not for server or client usage,
 * because it doesn’t save events to file or localStorage.
 *
 * @example
 * import createMemoryStore from 'logux-core/create-memory-store'
 * var log = createLog({
 *   store: createMemoryStore(),
 *   timer: createTestTimer()
 * })
 *
 * @return {Store} store
 */
function createMemoryStore () {
  var store = []

  var get = function () {
    return Promise.resolve({ data: store })
  }

  var add = function (event) {
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

  return { get: get, add: add }
}

module.exports = createMemoryStore
