var MemoryStore = require('./memory-store')
var Log = require('./log')

/**
 * Log to be used in tests. It already has memory store, node ID,
 * and special test timer.
 *
 * Use {@link TestTime} to create test log.
 *
 * @param {TestTime} time This test time.
 * @param {number} id Log sequence number created from this test time.
 * @param {object} [opts] Options.
 * @param {Store} [opts.store] Store for log.
 *                             Will use {@link MemoryStore} by default.
 * @param {string|number} [opts.nodeId='test'] Unique Node ID.
 *
 * @example
 * import { TestTime } from 'logux-core'
 *
 * it('tests log', () => {
 *   const log = TestTime.getLog()
 * })
 *
 * it('tests 2 logs', () => {
 *   const time = new TestTime()
 *   const log1 = time.nextLog()
 *   const log2 = time.nextLog()
 * })
 *
 * @class
 * @extends Log
 */
function TestLog (time, id, opts) {
  if (!opts) opts = { }
  if (!opts.store) opts.store = new MemoryStore()
  if (typeof opts.nodeId === 'undefined') {
    opts.nodeId = 'test' + id
  }

  Log.call(this, opts)

  this.time = time
}

TestLog.prototype = { }
for (var i in Log.prototype) {
  TestLog.prototype[i] = Log.prototype[i]
}

TestLog.prototype.generateId = function generateId () {
  this.time.lastTime += 1
  return [this.time.lastTime, this.nodeId, 0]
}

module.exports = TestLog
