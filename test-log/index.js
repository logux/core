let { MemoryStore } = require('../memory-store')
let { Log } = require('../log')

class TestLog extends Log {
  constructor (time, id, opts = {}) {
    if (!opts.store) opts.store = new MemoryStore()
    if (typeof opts.nodeId === 'undefined') {
      opts.nodeId = 'test' + id
    }

    super(opts)
    this.time = time
  }

  entries () {
    return this.store.entries
  }

  actions () {
    return this.entries().map(i => i[0])
  }

  generateId () {
    this.time.lastTime += 1
    return this.time.lastTime + ' ' + this.nodeId + ' 0'
  }
}

module.exports = { TestLog }
