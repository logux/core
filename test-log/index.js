import { Log } from '../log/index.js'
import { MemoryStore } from '../memory-store/index.js'

export class TestLog extends Log {
  constructor(time, id, opts = {}) {
    if (!opts.store) opts.store = new MemoryStore()
    if (typeof opts.nodeId === 'undefined') {
      opts.nodeId = 'test' + id
    }

    super(opts)
    this.epoch = 0
    this.time = time
  }

  actions() {
    return this.entries().map(i => i[0])
  }

  entries() {
    return this.store.entries
  }

  keepActions() {
    this.on('preadd', (action, meta) => {
      meta.reasons.push('test')
    })
  }

  now() {
    this.time.lastTime += 1
    return this.time.lastTime
  }
}
