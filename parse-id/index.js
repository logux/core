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
