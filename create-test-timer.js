/**
 * @typedef {function} testTimer
 * @return {number}
 */

/**
 * Create a simple timer for tests. Timer will return next number on every call.
 *
 * @return {testTimer} timer
 *
 * @example
 * let timer = createTestTimer()
 * timer() //=> 1
 * timer() //=> 2
 * timer() //=> 3
 */
function createTestTimer () {
  var last = 0
  return function () {
    last += 1
    return last
  }
}

module.exports = createTestTimer
