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
  for (let i = 0; i < ordered.length; i += batch) {
    let chunk = ordered.slice(i, i + batch)
    this.startTimeout()
    this.syncing += 1
    this.setState('sending')
    this.send(['sync', added].concat(encodeEntries(this, chunk)))
  }
}

export function sendSynced(added) {
  this.send(['synced', added])
}

export async function syncMessage(added, ...data) {
  for (let i = 0; i < data.length - 1; i += 2) {
    let action = data[i]
    let meta = data[i + 1]

    if (!meta.id.includes(' ')) {
      meta.id = meta.id + ' ' + this.remoteNodeId
    }

    meta.time = meta.time + this.baseTime
    if (this.timeFix) meta.time = meta.time + this.timeFix

    if (this.options.onReceive) {
      runOnReceiveInParallel(this, action, meta)
    } else {
      add(this, action, meta)
    }
  }

  this.setLastReceived(added)
  this.sendSynced(added)
}

async function runOnReceiveInParallel(node, action, meta) {
  try {
    let result = await node.options.onReceive(action, meta)
    if (result) {
      add(node, result[0], result[1])
    }
  } catch (e) {
    node.error(e)
  }
}

function add(node, action, meta) {
  if (node.received) node.received[meta.id] = true
  return node.log.add(action, meta)
}

export function syncedMessage(synced) {
  this.endTimeout()
  this.setLastSent(synced)
  this.emitter.emit('synced', synced)
  if (this.syncing > 0) this.syncing -= 1
  if (this.syncing === 0) {
    this.setState('synchronized')
  }
}
