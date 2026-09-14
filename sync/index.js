function encodeEntries(node, entries) {
  let data = []
  for (let [action, originMeta] of entries) {
    let meta = {}
    for (let key in originMeta) {
      if (key !== 'added') meta[key] = originMeta[key]
    }

    if (node.timeFix) meta.time -= node.timeFix
    meta.time -= node.baseTime

    let [time, nodeId] = originMeta.id.split(' ')
    if (nodeId === node.localNodeId) meta.id = time

    data.push(action, meta)
  }
  return data
}

export function sendSync(added, entries) {
  if (entries.length === 0) return
  // Callers collect entries from the newest to the oldest one,
  // but the wire order is from the oldest to the newest one
  let ordered = entries.toReversed()
  let batch = this.options.syncBatch ?? 100
  let chunkAdded = 0
  for (let i = 0; i < ordered.length; i += batch) {
    let chunk = ordered.slice(i, i + batch)
    if (i + batch >= ordered.length) {
      chunkAdded = added
    } else {
      for (let [, meta] of chunk) {
        if (meta.added > chunkAdded) chunkAdded = meta.added
      }
    }
    this.syncing += 1
    this.setState('sending')
    this.send(['sync', chunkAdded].concat(encodeEntries(this, chunk)))
  }
}

export function sendSynced(added) {
  this.send(['synced', added])
}

function ignore() {}

export async function syncMessage(added, ...data) {
  let entries = []
  for (let i = 0; i < data.length - 1; i += 2) {
    let action = data[i]
    let meta = data[i + 1]

    if (!meta.id.includes(' ')) {
      meta.id = meta.id + ' ' + this.remoteNodeId
    }

    meta.time = meta.time + this.baseTime
    if (this.timeFix) meta.time = meta.time + this.timeFix

    entries.push([action, meta])
  }

  let filtered = this.options.onReceive
    ? filter(this, entries)
    : Promise.resolve(entries)
  let previous = this.receiving ?? Promise.resolve()
  let current = Promise.all([previous, filtered]).then(([, ready]) =>
    add(this, ready)
  )
  this.receiving = current.then(ignore, ignore)
  try {
    await current
  } catch (e) {
    this.error(e)
    return
  }
  this.setLastReceived(added)
  this.sendSynced(added)
}

async function runOnReceive(node, action, meta) {
  try {
    return await node.options.onReceive(action, meta)
  } catch (e) {
    node.error(e)
    return false
  }
}

async function filter(node, entries) {
  let results = await Promise.all(
    entries.map(([action, meta]) => runOnReceive(node, action, meta))
  )
  return results.filter(Boolean)
}

async function add(node, entries) {
  if (entries.length === 0) return
  if (node.received) {
    for (let [, meta] of entries) node.received[meta.id] = true
  }
  await node.log.add(entries)
}

export function syncedMessage(synced) {
  this.setLastSent(synced)
  this.emitter.emit('synced', synced)
  if (this.syncing > 0) this.syncing -= 1
  this.checkSynchronized()
}
