var TestLog = require('./test-log')

/**
 * Log creator for tests.
 *
 * Real logs use real time in actions ID, as results
 * log content will be different on every test execution.
 *
 * To fix it Logux has special logs for tests with simple sequence timer.
 * All logs from one test should share same time. This is why you should
 * use log creator to share time between all logs in one test.
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
 */
function TestTime () {
  this.lastId = 0
  this.lastTime = 0
}

/**
 * Shortcut to create time and generate single log.
 * Use it only if you need one log in test.
 *
 * @param {object} [opts] Log options.
 * @param {Store} [opts.store] Store for log.
 *                             Will use {@link MemoryStore} by default.
 * @param {string|number} [opts.nodeId='test'] Unique Node ID.
 *
 * @return {TestLog} Test log in this time.
 *
 * @example
 * it('tests log', () => {
 *   const log = TestTime.getLog()
 * })
 */
TestTime.getLog = function getLog (opts) {
  var time = new TestTime()
  return time.nextLog(opts)
}

TestTime.prototype = {

  /**
   * Return next test log in same time.
   *
   * @param {object} [opts] Log options.
   * @param {Store} [opts.store] Store for log.
   *                             Will use {@link MemoryStore} by default.
   * @param {string|number} [opts.nodeId='test'] Unique Node ID.
   *
   * @return {TestLog} Test log in this time.
   *
   * @example
   * it('tests 2 logs', () => {
   *   const time = new TestTime()
   *   const log1 = time.nextLog()
   *   const log2 = time.nextLog()
   * })
   */
  nextLog: function nextLog (opts) {
    this.lastId += 1
    return new TestLog(this, this.lastId, opts)
  }

}

module.exports = TestTime
