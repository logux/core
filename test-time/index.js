let { TestLog } = require('../test-log')

class TestTime {
  static getLog (opts) {
    let time = new TestTime()
    return time.nextLog(opts)
  }

  constructor () {
    this.lastId = 0
    this.lastTime = 0
  }

  nextLog (opts) {
    this.lastId += 1
    return new TestLog(this, this.lastId, opts)
  }
}

module.exports = { TestTime }
