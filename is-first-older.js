/**
 * Compare time, when log entries were created.
 *
 * It uses `meta.time` and `meta.id` to detect entries order.
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
