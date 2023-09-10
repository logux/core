export function sendSync(added, entries) {
  this.startTimeout()

  let data = []
  for (let [action, originMeta] of entries) {
    let meta = {}
    for (let key in originMeta) {
      if (key === 'id') {
        meta.id = originMeta.id.split(' ')
      } else if (key !== 'added') {
        meta[key] = originMeta[key]
      }
    }

    if (this.timeFix) meta.time -= this.timeFix
    meta.id[0] = parseInt(meta.id[0]) - this.baseTime
    meta.id[2] = parseInt(meta.id[2])
    meta.time -= this.baseTime

    if (meta.id[1] === this.localNodeId) {
      if (meta.id[2] === 0) {
        meta.id = meta.id[0]
      } else {
        meta.id = [meta.id[0], meta.id[2]]
      }
    }

    data.unshift(action, meta)
  }

  this.syncing += 1
  this.setState('sending')
  this.send(['sync', added].concat(data))
}

export function sendSynced(added) {
  this.send(['synced', added])
}

export async function syncMessage(added, ...data) {
  for (let i = 0; i < data.length - 1; i += 2) {
    let action = data[i]
    let meta = data[i + 1]

    if (typeof meta.id === 'number') {
      meta.id = meta.id + this.baseTime + ' ' + this.remoteNodeId + ' ' + 0
    } else {
      meta.id[0] = meta.id[0] + this.baseTime
      if (meta.id.length === 2) {
        meta.id = meta.id[0] + ' ' + this.remoteNodeId + ' ' + meta.id[1]
      } else {
        meta.id = meta.id.join(' ')
      }
    }

    meta.time = meta.time + this.baseTime
    if (this.timeFix) meta.time = meta.time + this.timeFix

    if (this.options.onReceive) {
      try {
        let result = await this.options.onReceive(action, meta)
        if (result) {
          add(this, result[0], result[1])
        }
      } catch (e) {
        this.error(e)
      }
    } else {
      add(this, action, meta)
    }
  }

  this.setLastReceived(added)
  this.sendSynced(added)
}

function add(node, action, meta) {
  if (node.received) node.received[meta.id] = true
  return node.log.add(action, meta)
}

export function syncedMessage(synced) {
  this.endTimeout()
  this.setLastSent(synced)
  if (this.syncing > 0) this.syncing -= 1
  if (this.syncing === 0) {
    this.setState('synchronized')
  }
}
