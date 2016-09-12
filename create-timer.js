/**
 * Create base timer.
 *
 * Shareable logs is very sensitive for good time. Just Date.now()
 * is not enough. Some events could be created in same millisecond.
 * Events created in same time on different machine may have different order.
 *
 * This is why Logux use more smarter timer. To solve this problems this timer
 * store time as 3 variables: current milliseconds, host name and events count.
 *
 * @param {string} host unique name of current log instance
 * @return {Timer} timer
 *
 * @example
 * import { createTimer } from 'logux-core'
 *
 * const timer = createTimer('host')
 * timer() //=> [1473564435318, 'host', 0]
 * timer() //=> [1473564435318, 'host', 1]
 * timer() //=> [1473564435319, 'host', 0]
 */
function createTimer (host) {
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
    return [now, host, events]
  }
}

module.exports = createTimer
