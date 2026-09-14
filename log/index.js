import { createNanoEvents } from 'nanoevents'

// Chars are in ASCII order to keep string sorting the same as number sorting
const ALPHABET =
  '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz'

export function toCompat(number) {
  let str = ''
  do {
    str = ALPHABET[number % 64] + str
    number = Math.floor(number / 64)
  } while (number > 0)
  return str
}

export function fromCompat(str) {
  let number = 0
  for (let char of str) {
    number = number * 64 + ALPHABET.indexOf(char)
  }
  return number
}

export function idToTime(id) {
  return fromCompat(id.split(' ')[0])
}

// Enough for 8889 year
const TIME_SIZE = 8

export function toSorted(meta) {
  let [time, nodeId] = meta.id.split(' ')
  return (
    toCompat(meta.time).padStart(TIME_SIZE, ALPHABET[0]) +
    ' ' +
    nodeId +
    ' ' +
    time.padStart(TIME_SIZE, ALPHABET[0])
  )
}

export function sortedToMeta(sorted) {
  let [time, nodeId, id] = sorted.split(' ')
  return {
    id: `${toCompat(fromCompat(id))} ${nodeId}`,
    time: fromCompat(time)
  }
}

export function actionEvents(emitter, event, action, meta) {
  if (action.id) {
    emitter.emit(`${event}-${action.type}-${action.id}`, action, meta)
  }
  emitter.emit(`${event}-${action.type}-`, action, meta)
  emitter.emit(event, action, meta)
}

function toReasons(reasons) {
  return typeof reasons === 'string' ? [reasons] : reasons
}

function prepare(log, action, meta) {
  if (typeof action.type === 'undefined') {
    throw new Error('Expected "type" in action')
  }

  let newId = false
  if (typeof meta.id === 'undefined') {
    newId = true
    meta.id = log.generateId()
    if (typeof meta.time === 'undefined') meta.time = log.lastTime
  } else if (typeof meta.time === 'undefined') {
    meta.time = log.now()
  }

  if (typeof meta.reasons === 'undefined') {
    meta.reasons = []
  }

  if (process.env.NODE_ENV !== 'production') {
    if (!Array.isArray(meta.reasons)) {
      throw new Error('Expected "reasons" to be an array of strings')
    }

    for (let reason of meta.reasons) {
      if (typeof reason !== 'string') {
        throw new Error('Expected "reasons" to be an array of strings')
      }
    }

    if (typeof meta.indexes !== 'undefined') {
      if (!Array.isArray(meta.indexes)) {
        throw new Error('Expected "indexes" to be an array of strings')
      }

      for (let index of meta.indexes) {
        if (typeof index !== 'string') {
          throw new Error('Expected "indexes" to be an array of strings')
        }
      }
    }
  }

  actionEvents(log.emitter, 'preadd', action, meta)

  // The reason must be in the meta before the write, but the cleaning
  // of the previous action can only run after it: inside a batch the older
  // actions are stored by the same write
  if (meta.keepLast) meta.reasons.push(meta.keepLast)

  return newId
}

export class Log {
  constructor(opts = {}) {
    if (process.env.NODE_ENV !== 'production') {
      if (typeof opts.nodeId === 'undefined') {
        throw new Error('Expected node ID')
      }
      if (typeof opts.store !== 'object') {
        throw new Error('Expected store')
      }
      if (opts.nodeId.includes(' ')) {
        throw new Error('Space is prohibited in node ID')
      }
    }

    this.nodeId = opts.nodeId

    this.lastTime = 0

    this.store = opts.store

    this.emitter = createNanoEvents()
  }

  async add(input, inputMeta = {}) {
    let wasBatched = Array.isArray(input)
    let entries = wasBatched ? input : [[input, inputMeta]]

    // Every `preadd` is called before the write, since the store needs
    // the final reasons of all actions to know what to write. As a result,
    // `add` of the first action is called after `preadd` of the last one.
    let newIds = []
    let writing = []
    let checking = []
    for (let i = 0; i < entries.length; i++) {
      let [action, meta = {}] = entries[i]
      let newId = prepare(this, action, meta)
      newIds.push(newId)
      entries[i] = [action, meta]
      if (meta.reasons.length > 0) {
        writing.push(entries[i])
      } else if (!newId) {
        // Actions without reasons are not stored, but an action with the same
        // ID could be stored before with a reason
        checking.push(meta.id)
      }
    }

    // All actions of a single `sync` message are written by a single call,
    // so a store can put them into a single transaction
    let written = writing.length > 0 ? await this.store.add(writing) : []
    // The check runs after the write, so an action of this batch is found
    // by the duplicate of it in the same batch
    let stored = checking.length > 0 ? await this.store.has(checking) : []
    let known = stored.length > 0 ? new Set(stored) : undefined

    let results = []
    let batch = []
    let next = 0
    for (let i = 0; i < entries.length; i++) {
      let [action, meta] = entries[i]
      if (meta.keepLast) this.removeReason(meta.keepLast, { olderThan: meta })
      let result
      if (meta.reasons.length > 0) {
        let addedMeta = written[next++]
        if (addedMeta === false) {
          result = false
        } else {
          actionEvents(this.emitter, 'add', action, meta)
          result = addedMeta
        }
      } else if (newIds[i]) {
        // The ID was just generated, so no other action can have it
        actionEvents(this.emitter, 'add', action, meta)
        actionEvents(this.emitter, 'clean', action, meta)
        result = meta
      } else {
        if (known && known.has(meta.id)) {
          result = false
        } else {
          actionEvents(this.emitter, 'add', action, meta)
          actionEvents(this.emitter, 'clean', action, meta)
          result = meta
        }
      }

      results.push(result)
      if (result !== false) batch.push(entries[i])
    }

    if (batch.length > 0) this.emitter.emit('batch', batch)
    return wasBatched ? results : results[0]
  }

  addReason(reasons, criteria = {}) {
    return this.store.addReason(toReasons(reasons), criteria)
  }

  byId(id) {
    return this.store.byId(id)
  }

  async changeMeta(id, diff) {
    for (let k in diff) {
      if (
        k === 'id' ||
        k === 'added' ||
        k === 'time' ||
        k === 'subprotocol' ||
        k === 'indexes'
      ) {
        throw new Error('Meta "' + k + '" is read-only')
      }
    }

    if (diff.reasons && diff.reasons.length === 0) {
      let entry = await this.store.remove(id)
      if (entry) {
        for (let k in diff) entry[1][k] = diff[k]
        actionEvents(this.emitter, 'clean', entry[0], entry[1])
      }
      return !!entry
    } else {
      return this.store.changeMeta(id, diff)
    }
  }

  each(opts, callback) {
    if (!callback) {
      callback = opts
      opts = { order: 'created' }
    }

    let store = this.store
    return new Promise(resolve => {
      async function nextPage(get) {
        let page = await get()
        let result
        for (let i = page.entries.length - 1; i >= 0; i--) {
          let entry = page.entries[i]
          result = callback(entry[0], entry[1])
          if (result === false) break
        }

        if (result === false || !page.next) {
          resolve()
        } else {
          nextPage(page.next)
        }
      }

      nextPage(store.get.bind(store, opts))
    })
  }

  generateId() {
    let now = this.now()
    if (now <= this.lastTime) now = this.lastTime + 1
    this.lastTime = now
    return toCompat(now) + ' ' + this.nodeId
  }

  now() {
    return Date.now()
  }

  on(event, listener) {
    return this.emitter.on(event, listener)
  }

  removeReason(reasons, criteria = {}) {
    let clean = (action, meta) => {
      actionEvents(this.emitter, 'clean', action, meta)
    }
    return this.store.removeReason(toReasons(reasons), criteria, clean)
  }

  type(type, listener, opts = {}) {
    let event = opts.event || 'add'
    let id = opts.id || ''
    return this.emitter.on(`${event}-${type}-${id}`, listener)
  }
}
