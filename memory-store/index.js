import { isFirstOlder } from '../is-first-older/index.js'

function checkIndex(store, index) {
  if (!store.indexes[index]) {
    store.indexes[index] = { added: [], entries: [] }
  }
}

function forEachIndex(meta, cb) {
  let indexes = meta.indexes
  if (isDefined(indexes) && indexes.length > 0) {
    for (let index of indexes) {
      cb(index)
    }
  }
}

function insert(store, entry) {
  store.lastAdded += 1
  entry[1].added = store.lastAdded
  store.added.push(entry)
  forEachIndex(entry[1], index => {
    checkIndex(store, index)
    store.indexes[index].added.push(entry)
  })
  return Promise.resolve(entry[1])
}

function eject(store, meta) {
  let added = meta.added
  let start = 0
  let end = store.added.length - 1
  while (start <= end) {
    let middle = (end + start) >> 1
    let otherAdded = store.added[middle][1].added
    if (otherAdded < added) {
      start = middle + 1
    } else if (otherAdded > added) {
      end = middle - 1
    } else {
      store.added.splice(middle, 1)
      break
    }
  }
}

function find(list, id) {
  for (let i = list.length - 1; i >= 0; i--) {
    if (id === list[i][1].id) {
      return i
    }
  }
  return -1
}

function isDefined(value) {
  return typeof value !== 'undefined'
}

function hasIndex(meta, index) {
  return isDefined(meta.indexes) && meta.indexes.includes(index)
}

function matchCriteria(meta, criteria) {
  let c = criteria
  if (isDefined(c.ids) && !c.ids.includes(meta.id)) {
    return false
  }
  if (isDefined(c.index) && !hasIndex(meta, c.index)) {
    return false
  }
  if (isDefined(c.exceptIndex) && hasIndex(meta, c.exceptIndex)) {
    return false
  }
  if (isDefined(c.olderThan) && !isFirstOlder(meta, c.olderThan)) {
    return false
  }
  if (isDefined(c.youngerThan) && !isFirstOlder(c.youngerThan, meta)) {
    return false
  }
  if (isDefined(c.minAdded) && meta.added < c.minAdded) {
    return false
  }
  if (isDefined(c.maxAdded) && meta.added > c.maxAdded) {
    return false
  }
  return true
}

// Actions to change reasons in. Uses `criteria.id` or `criteria.index`
// to avoid scanning the whole log.
function selectEntries(store, criteria) {
  if (isDefined(criteria.id)) {
    let created = find(store.entries, criteria.id)
    if (created === -1) return []
    let entry = store.entries[created]
    return matchCriteria(entry[1], criteria) ? [entry] : []
  }

  let entries = store.entries
  if (isDefined(criteria.index)) {
    entries = (store.indexes[criteria.index] || { entries: [] }).entries
  }
  return entries.filter(([, meta]) => matchCriteria(meta, criteria))
}

export class MemoryStore {
  constructor() {
    this.entries = []
    this.added = []
    this.indexes = {}
    this.lastReceived = 0
    this.lastAdded = 0
    this.lastSent = 0
  }

  async add(action, meta) {
    let entry = [action, meta]
    let id = meta.id

    let list = this.entries
    for (let i = 0; i < list.length; i++) {
      let [, otherMeta] = list[i]
      if (id === otherMeta.id) {
        return false
      } else if (!isFirstOlder(otherMeta, meta)) {
        forEachIndex(meta, index => {
          checkIndex(this, index)
          let indexList = this.indexes[index].entries
          let j = indexList.findIndex(item => !isFirstOlder(item[1], meta))
          indexList.splice(j, 0, entry)
        })
        list.splice(i, 0, entry)
        return insert(this, entry)
      }
    }

    forEachIndex(meta, index => {
      checkIndex(this, index)
      this.indexes[index].entries.push(entry)
    })
    list.push(entry)
    return insert(this, entry)
  }

  async addReason(reasons, criteria) {
    for (let [, meta] of selectEntries(this, criteria)) {
      for (let reason of reasons) {
        if (!meta.reasons.includes(reason)) meta.reasons.push(reason)
      }
    }
  }

  async byId(id) {
    let created = find(this.entries, id)
    if (created === -1) {
      return [null, null]
    } else {
      let [action, meta] = this.entries[created]
      return [action, meta]
    }
  }

  async changeMeta(id, diff) {
    let index = find(this.entries, id)
    if (index === -1) {
      return false
    } else {
      let meta = this.entries[index][1]
      for (let key in diff) meta[key] = diff[key]
      return true
    }
  }

  async clean() {
    this.entries = []
    this.added = []
    this.indexes = {}
    this.lastReceived = 0
    this.lastAdded = 0
    this.lastSent = 0
  }

  async get(opts = {}) {
    let index = opts.index
    let store = this
    let entries
    if (index) {
      store = this.indexes[index] || { added: [], entries: [] }
    }
    if (opts.order === 'created') {
      entries = store.entries
    } else {
      entries = store.added
    }
    if (isDefined(opts.reason)) {
      entries = entries.filter(([, meta]) => {
        return isDefined(meta.reasons) && meta.reasons.includes(opts.reason)
      })
    }
    return { entries: entries.slice(0) }
  }

  async getLastAdded() {
    return this.lastAdded
  }

  async getLastSynced() {
    return {
      received: this.lastReceived,
      sent: this.lastSent
    }
  }

  async remove(id, created) {
    if (typeof created === 'undefined') {
      created = find(this.entries, id)
      if (created === -1) return Promise.resolve(false)
    }

    let entry = [this.entries[created][0], this.entries[created][1]]
    forEachIndex(entry[1], index => {
      let entries = this.indexes[index].entries
      let indexed = find(entries, id)
      if (indexed !== -1) entries.splice(indexed, 1)
    })
    this.entries.splice(created, 1)

    forEachIndex(entry[1], index => {
      eject(this.indexes[index], entry[1])
    })
    eject(this, entry[1])

    return entry
  }

  async removeReason(reasons, criteria, callback) {
    let removed = []
    for (let [action, meta] of selectEntries(this, criteria)) {
      let changed = false
      for (let reason of reasons) {
        let reasonPos = meta.reasons.indexOf(reason)
        if (reasonPos !== -1) {
          meta.reasons.splice(reasonPos, 1)
          changed = true
        }
      }
      if (changed && meta.reasons.length === 0) {
        callback(action, meta)
        removed.push(meta)
      }
    }

    if (removed.length === 0) return

    let removedAdded = new Set(removed.map(meta => meta.added))
    let removing = i => !removedAdded.has(i[1].added)
    this.entries = this.entries.filter(removing)
    this.added = this.added.filter(removing)

    let dirty = new Set()
    for (let meta of removed) {
      forEachIndex(meta, index => dirty.add(index))
    }
    for (let index of dirty) {
      this.indexes[index].entries = this.indexes[index].entries.filter(removing)
      this.indexes[index].added = this.indexes[index].added.filter(removing)
    }
  }

  async setLastSynced(values) {
    if (typeof values.sent !== 'undefined') {
      this.lastSent = values.sent
    }
    if (typeof values.received !== 'undefined') {
      this.lastReceived = values.received
    }
  }
}
