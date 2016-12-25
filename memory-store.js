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
  }

}

module.exports = MemoryStore
