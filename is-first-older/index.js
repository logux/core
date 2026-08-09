import { fromCompat, idToTime } from '../log/index.js'

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

  let first = firstMeta.id.split(' ')
  let second = secondMeta.id.split(' ')

  if (first[1] > second[1]) {
    return false
  } else if (first[1] < second[1]) {
    return true
  }

  let firstIdTime = fromCompat(first[0])
  let secondIdTime = fromCompat(second[0])
  if (firstIdTime > secondIdTime) {
    return false
  } else if (firstIdTime < secondIdTime) {
    return true
  }

  return false
}
