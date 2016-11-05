/**
 * Create base timer.
 *
 * Shareable logs is very sensitive for good time. Just `Date.now()`
 * is not enough. Some events could be created in same millisecond.
 * Events created in same time on different machine may have different order.
 *
 * This is why Logux use more smarter timer. To solve this problems this timer
 * store time as 3 variables: current milliseconds, node name and events count.
 *
 * @param {string|number} uniqName Unique current node name.
 * @return {Timer} Timer function.
 *
 * @example
 * import { createTimer } from 'logux-core'
 *
 * const timer = createTimer('server')
 * timer() //=> [1473564435318, 'server', 0]
 * timer() //=> [1473564435318, 'server', 1]
 * timer() //=> [1473564435319, 'server', 0]
 */
function createTimer (uniqName) {
  var lastTime = 0
  var events = 0
  return function () {
    var now = Date.now()
    if (now === lastTime) {
      events += 1
    } else {
      lastTime = now
      events = 0
    }
    return [now, uniqName, events]
  }
}

module.exports = createTimer
