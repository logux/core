function split (id) {
  var index = id.indexOf(' ')
  return [id.slice(0, index), id.slice(index + 1)]
}

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
  if (firstMeta && !secondMeta) {
    return false
  } else if (!firstMeta && secondMeta) {
    return true
  }

  if (firstMeta.time > secondMeta.time) {
    return false
  } else if (firstMeta.time < secondMeta.time) {
    return true
  }

  var first = split(firstMeta.id)
  var second = split(secondMeta.id)
  if (first[1] > second[1]) {
    return false
  } else if (first[1] < second[1]) {
    return true
  }

  if (first[0] > second[0]) {
    return false
  } else if (first[0] < second[0]) {
    return true
  }

  return false
}

module.exports = isFirstOlder
