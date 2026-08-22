export function parseId(nodeId) {
  if (nodeId.includes(' ')) nodeId = nodeId.split(' ')[1]
  let parts = nodeId.split(':')
  if (parts.length === 1) {
    return { clientId: nodeId, nodeId, userId: undefined }
  } else {
    let userId = parts[0]
    return { clientId: parts[0] + ':' + parts[1], nodeId, userId }
  }
}

export function isSameClient(id, clientId) {
  let start = id.indexOf(' ') + 1
  let end = start
  let colons = 0
  while (end < id.length) {
    let char = id.charCodeAt(end)
    if (char === 32 /* space */) break
    if (char === 58 /* colon */ && ++colons === 2) break
    end += 1
  }
  return end - start === clientId.length && id.startsWith(clientId, start)
}
