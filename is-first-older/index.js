function split (id) {
  let index = id.indexOf(' ')
  return [id.slice(0, index), id.slice(index + 1)]
}

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

  let first = split(firstMeta.id)
  let second = split(secondMeta.id)
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

module.exports = { isFirstOlder }
