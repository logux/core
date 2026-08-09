import { idToTime } from '../log/index.js'

export function isFirstOlder(firstMeta, secondMeta) {
  if (firstMeta && !secondMeta) {
    return false
  } else if (!firstMeta && secondMeta) {
    return true
  }

  if (typeof firstMeta === 'string') {
    firstMeta = { id: firstMeta, time: idToTime(firstMeta) }
  }
  if (typeof secondMeta === 'string') {
    secondMeta = { id: secondMeta, time: idToTime(secondMeta) }
  }

  if (firstMeta.time > secondMeta.time) {
    return false
  } else if (firstMeta.time < secondMeta.time) {
    return true
  }

  let firstNode = firstMeta.id.split(' ')[1]
  let secondNode = secondMeta.id.split(' ')[1]
  if (firstNode > secondNode) {
    return false
  } else if (firstNode < secondNode) {
    return true
  }

  return false
}
