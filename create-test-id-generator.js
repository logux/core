/**
 * Create a time-independent ID generator for tests.
 *
 * @return {IdGenerator} ID generator for tests.
 *
 * @example
 * import { createTestIdGenerator } from 'logux-core'
 *
 * const idGenerator = createTestIdGenerator()
 * idGenerator() //=> [1, 'test', 0]
 * idGenerator() //=> [2, 'test', 0]
 * idGenerator() //=> [3, 'test', 0]
 *
 * const log1 = new Log({ store1, idGenerator })
 * const log2 = new Log({ store2, idGenerator })
 */
function createTestIdGenerator () {
  var last = 0
  return function () {
    last += 1
    return [last, 'test', 0]
  }
}

module.exports = createTestIdGenerator
