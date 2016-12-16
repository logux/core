var compareTime = require('./compare-time')

/**
 * Simple memory-based events store.
 *
 * It is good for tests, but not for server or client usage,
 * because it doesn’t save events to file or localStorage.
 *
 * Think about this store as a basic store realization.
 *
 * Every Store class should provide three standard methods:
 * add, get and remove.
 *
 * Every Store for client should provide two more methods:
 * getLatestSynced, setLatestSynced.
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

  /**
   * Method `getLatestSynced` used to get tuple of latest synced added number
   * for current and for other's node log
   *
   * @example
   * log.store.getLatestSynced().then(function(synced) {
   *   if (log.lastAdded > synced.latestReceived) sync.state = 'wait'
   * })
   *
   * @return {object} Object with latest sent/received values.
   */
  getLatestSynced: function getLatestSynced () {
    return Promise.resolve({
      latestReceived: this.latestReceived,
      latestSent: this.latestSent
    })
  },

  /**
   * Method `setLatestSynced` used to set latest synced added number
   * for current and/or other node's log
   *
   * @param {object} [syncedValue] syncedValue Object with latest sent/received
   *                                           values.
   *
   * @example
   * log.store.setLatestSynced({ latestSent: 1, latestReceived: 2 }])
   *
   * @return {boolean} Sync option is set
   */
  setLatestSynced: function setLatestSynced (syncedValue) {
    if (syncedValue.latestSent) {
      this.latestSent = syncedValue.latestSent
    }
    if (syncedValue.latestReceived) {
      this.latestReceived = syncedValue.latestReceived
    }
    return Promise.resolve(true)
  },

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
