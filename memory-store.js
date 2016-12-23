var getTime = require('./get-time')

function compareTime (time, order, other) {
  if (time > other.time) {
    return 1
  } else if (time < other.time) {
    return -1
  } else if (order > other.order) {
    return 1
  } else if (order < other.order) {
    return -1
  } else {
    return 0
  }
}

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
      return Promise.resolve({ entries: convert(this.created) })
    } else {
      return Promise.resolve({ entries: convert(this.added) })
    }
  },

  add: function add (action, meta) {
    var time = getTime(meta)
    var order = meta.id.slice(1).join('\t')
    var cache = { id: meta.id.join('\t'), time: time, order: order }

    var entry = [action, meta, cache]

    var list = this.created
    for (var i = 0; i < list.length; i++) {
      var other = list[i][2]

      var compare = compareTime(time, order, other)
      if (compare > 0) {
        list.splice(i, 0, entry)
        this.added.unshift(entry)
        return Promise.resolve(true)
      } else if (compare === 0) {
        return Promise.resolve(false)
      }
    }

    list.push(entry)
    this.added.unshift(entry)
    return Promise.resolve(true)
  },

  remove: function remove (id) {
    var str = id.join('\t')
    var i
    for (i = this.created.length - 1; i >= 0; i--) {
      if (this.created[i][2].id === str) {
        this.created.splice(i, 1)
        break
      }
    }
    for (i = this.added.length - 1; i >= 0; i--) {
      if (this.added[i][2].id === str) {
        this.added.splice(i, 1)
        break
      }
    }
  }

}

module.exports = MemoryStore
