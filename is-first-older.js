/**
 * Compare log entries real created time.
 *
 * If actions was synchronized from different machine with different time,
 * this function will use `meta.timeFix` to fix time difference
 * between machines.
 *
 * @param {Meta} firstMeta Some action’s metadata.
 * @param {Meta} secondMeta Other action’s metadata.
 *
 * @return {boolean} Is first action is older than second.
 *
 * @example
 * import { isFirstOlder } from 'logux-core'
 * if (isFirstOlder(lastBeep, meta) {
 *   beep(action)
 *   lastBeep = meta
 * }
 */
function isFirstOlder (firstMeta, secondMeta) {
  if (firstMeta.time > secondMeta.time) {
    return false
  } else if (firstMeta.time < secondMeta.time) {
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
