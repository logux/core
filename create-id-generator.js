/**
 * Create Logux default ID generator.
 *
 * ID should be unique on every machine. Also modern IDs should be bigger
 * than older to sort log by ID.
 *
 * To solve this problems Logux ID contains 3 variables:
 * current milliseconds, node unique name and sequence number
 * in this millisecond.
 *
 * @param {string|number} nodeId Unique current node name.
 * @return {IdGenerator} Generator function.
 *
 * @example
 * import { createIdGenerator } from 'logux-core'
 *
 * const generator = createIdGenerator('server')
 * generator() //=> [1473564435318, 'server', 0]
 * generator() //=> [1473564435318, 'server', 1]
 * generator() //=> [1473564435319, 'server', 0]
 */
function createIdGenerator (nodeId) {
  if (typeof nodeId === 'string' && nodeId.indexOf('\t') !== -1) {
    throw new Error('Tab symbol is prohibited in Logux node ID')
  }

  var lastTime = 0
  var sequence = 0
  return function () {
    var now = Date.now()
    if (now === lastTime) {
      sequence += 1
    } else {
      lastTime = now
      sequence = 0
    }
    return [now, nodeId, sequence]
  }
}

module.exports = createIdGenerator
