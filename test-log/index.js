import { Log } from '../log/index.js'
import { MemoryStore } from '../memory-store/index.js'

export class TestLog extends Log {
  constructor(time, id, opts = {}) {
    if (!opts.store) opts.store = new MemoryStore()
    if (typeof opts.nodeId === 'undefined') {
      opts.nodeId = 'test' + id
    }

    super(opts)
    this.time = time
  }

  actions() {
    return this.entries().map(i => i[0])
  }

  entries() {
    return this.store.entries
  }

  generateId() {
    this.time.lastTime += 1
    return this.time.lastTime + ' ' + this.nodeId + ' 0'
  }

  keepActions() {
    this.on('preadd', (action, meta) => {
      meta.reasons.push('test')
    })
  }
}
