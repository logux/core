/**
 * Create a simple timer for tests. Timer will return next number on every call.
 *
 * @return {Timer} test timer
 *
 * @example
 * import { createTestTimer } from 'logux-core'
 *
 * const timer = createTestTimer()
 * timer() //=> [1]
 * timer() //=> [2]
 * timer() //=> [3]
 *
 * const log1 = new Log({ store1, timer: testTimer })
 * const log2 = new Log({ store2, timer: testTimer })
 */
function createTestTimer () {
  var last = 0
  return function () {
    last += 1
    return [last]
  }
}

module.exports = createTestTimer
