/**
 * Compare two Logux Time array and return -1, 0 or 1
 * (standard values for `sort()`).
 *
 * @param {Time} a first time to compare
 * @param {Time} b second time to compare
 * @return {number} 1 if a older than b, 0 or -1 if b older than a
 *
 * @example
 * import { compareTime } from 'logux-core'
 * if ( compareTime(event1.time, event2.time) <= 0 ) { }
 */
function compareTime (a, b) {
  for (var i = 0; i < a.length; i++) {
    if (a[i] > b[i]) {
      return 1
    } else if (a[i] < b[i]) {
      return -1
    }
  }
  return 0
}

module.exports = compareTime
