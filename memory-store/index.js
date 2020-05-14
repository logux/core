let { isFirstOlder } = require('../is-first-older')

function insert (store, entry) {
  store.lastAdded += 1
  entry[1].added = store.lastAdded
  store.added.push(entry)
  return Promise.resolve(entry[1])
}

function find (list, id) {
  for (let i = list.length - 1; i >= 0; i--) {
    if (id === list[i][1].id) {
      return i
    }
  }
  return -1
}

function isDefined (value) {
  return typeof value !== 'undefined'
}

class MemoryStore {
  constructor () {
    this.entries = []
    this.added = []
    this.lastReceived = 0
    this.lastAdded = 0
    this.lastSent = 0
  }

  async add (action, meta) {
    let entry = [action, meta]
    let id = meta.id

    let list = this.entries
    for (let i = 0; i < list.length; i++) {
      let [, otherMeta] = list[i]
      if (id === otherMeta.id) {
        return false
      } else if (!isFirstOlder(otherMeta, meta)) {
        list.splice(i, 0, entry)
        return insert(this, entry)
      }
    }

    list.push(entry)
    return insert(this, entry)
  }

  async byId (id) {
    let created = find(this.entries, id)
    if (created === -1) {
      return [null, null]
    } else {
      let [action, meta] = this.entries[created]
      return [action, meta]
    }
  }

  async remove (id, created) {
    if (typeof created === 'undefined') {
      created = find(this.entries, id)
      if (created === -1) return Promise.resolve(false)
    }

    let entry = [this.entries[created][0], this.entries[created][1]]
    this.entries.splice(created, 1)

    let added = entry[1].added
    let m = 0
    let n = this.added.length - 1
    while (m <= n) {
      let i = (n + m) >> 1
      let otherAdded = this.added[i][1].added
      if (otherAdded < added) {
        m = i + 1
      } else if (otherAdded > added) {
        n = i - 1
      } else {
        this.added.splice(i, 1)
        break
      }
    }

    return entry
  }

  async get (opts) {
    let entries
    if (opts.order === 'created') {
      entries = this.entries
    } else {
      entries = this.added
    }
    return { entries: entries.slice(0) }
  }

  async changeMeta (id, diff) {
    let index = find(this.entries, id)
    if (index === -1) {
      return false
    } else {
      let meta = this.entries[index][1]
      for (let key in diff) meta[key] = diff[key]
      return true
    }
  }

  async removeReason (reason, criteria, callback) {
    let removed = []

    if (criteria.id) {
      let index = find(this.entries, criteria.id)
      if (index !== -1) {
        let meta = this.entries[index][1]
        let reasonPos = meta.reasons.indexOf(reason)
        if (reasonPos !== -1) {
          meta.reasons.splice(reasonPos, 1)
          if (meta.reasons.length === 0) {
            callback(this.entries[index][0], meta)
            this.remove(criteria.id)
          }
        }
      }
    } else {
      this.entries = this.entries.filter(([action, meta]) => {
        let c = criteria

        let reasonPos = meta.reasons.indexOf(reason)
        if (reasonPos === -1) {
          return true
        }
        if (isDefined(c.olderThan) && !isFirstOlder(meta, c.olderThan)) {
          return true
        }
        if (isDefined(c.youngerThan) && !isFirstOlder(c.youngerThan, meta)) {
          return true
        }
        if (isDefined(c.minAdded) && meta.added < c.minAdded) {
          return true
        }
        if (isDefined(c.maxAdded) && meta.added > c.maxAdded) {
          return true
        }

        meta.reasons.splice(reasonPos, 1)
        if (meta.reasons.length === 0) {
          callback(action, meta)
          removed.push(meta.added)
          return false
        } else {
          return true
        }
      })
      this.added = this.added.filter(i => !removed.includes(i[1].added))
    }
  }

  async clean () {
    this.entries = []
    this.added = []
    this.lastReceived = 0
    this.lastAdded = 0
    this.lastSent = 0
  }

  async getLastAdded () {
    return this.lastAdded
  }

  async getLastSynced () {
    return {
      received: this.lastReceived,
      sent: this.lastSent
    }
  }

  async setLastSynced (values) {
    if (typeof values.sent !== 'undefined') {
      this.lastSent = values.sent
    }
    if (typeof values.received !== 'undefined') {
      this.lastReceived = values.received
    }
  }
}

module.exports = { MemoryStore }
