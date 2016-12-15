var getTime = require('./get-time')

/**
 * Compare events real created time.
 *
 * If event was synchronized from different machine with different time,
 * this function will use `meta.timeFix` to fix time difference
 * between machines.
 *
 * @param {Meta} firstMeta Some event metadata.
 * @param {Meta} secondMeta Other event metadata.
 *
 * @return {boolean} Is first event is older than second.
 *
 * @example
 * @import { isFirstOlder } from 'logux-core'
 * if (isFirstOlder(lastBeep, meta) {
 *   beep(event)
 *   lastBeep = meta
 * }
 */
function isFirstOlder (firstMeta, secondMeta) {
  var firstTime = getTime(firstMeta)
  var secondTime = getTime(secondMeta)
  if (firstTime > secondTime) {
    return false
  } else if (firstTime < secondTime) {
    return true
  }

  var firstStr = firstMeta.id.slice(1).join('\t')
  var secondStr = secondMeta.id.slice(1).join('\t')
  if (firstStr > secondStr) {
    return false
  } else if (firstStr < secondStr) {
    return true
  }

  return false
}

module.exports = isFirstOlder
