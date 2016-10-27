/**
 * Install a listener to log to clean log after `max` events.
 *
 * @param {Log} log Log to add listener.
 * @param {number} [max=100] How often clean.
 *
 * @return {function} Remove listener from log.
 */
module.exports = function cleanEvery (log, max) {
  if (typeof max === 'undefined') {
    max = 100
  }
  var count = 0
  return log.on('event', function () {
    count += 1
    if (count >= max) {
      count = 0
      setTimeout(function () {
        log.clean()
      }, 1)
    }
  })
}
