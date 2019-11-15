var LocalPair = require('./local-pair')

function clone (obj) {
  if (Array.isArray(obj)) {
    return obj.map(function (i) {
      return clone(i)
    })
  } else if (typeof obj === 'object') {
    var cloned = { }
    for (var i in obj) {
      cloned[i] = clone(obj[i])
    }
    return cloned
  } else {
    return obj
  }
}

/**
 * Two paired loopback connections with events tracking
 * to be used in Logux tests.
 *
 * @param {number} [delay=1] Delay for connection and send events.
 *
 * @example
 * import { testPair } from 'logux-core'
 * it('tracks events', async () => {
 *   const pair = new testPair()
 *   const client = new ClientNode(pair.right)
 *   await pair.left.connect()
 *   expect(pair.leftEvents).toEqual('connect')
 *   await pair.left.send(msg)
 *   expect(pair.leftSent).toEqual([msg])
 * })
 *
 * @extends LocalPair
 * @class
 */
function TestPair (delay) {
  LocalPair.call(this, delay)

  this.clear()
  var pair = this

  this.left.on('connect', function () {
    pair.leftEvents.push(['connect'])
    if (pair.waiting) pair.waiting('left')
  })
  this.right.on('connect', function () {
    pair.rightEvents.push(['connect'])
    if (pair.waiting) pair.waiting('right')
  })

  this.left.on('message', function (msg) {
    var cloned = clone(msg)
    pair.rightSent.push(cloned)
    pair.leftEvents.push(['message', cloned])
    if (pair.waiting) pair.waiting('left')
  })
  this.right.on('message', function (msg) {
    var cloned = clone(msg)
    pair.leftSent.push(cloned)
    pair.rightEvents.push(['message', cloned])
    if (pair.waiting) pair.waiting('right')
  })

  this.left.on('disconnect', function (reason) {
    pair.leftEvents.push(['disconnect', reason])
    if (pair.waiting) pair.waiting('left')
  })
  this.right.on('disconnect', function () {
    pair.rightEvents.push(['disconnect'])
    if (pair.waiting) pair.waiting('right')
  })
}

TestPair.prototype = {

  /**
   * Node instance used in this test, connected with {@link TestPair#left}.
   * @type {BaseNode}
   *
   * @example
   * function createTest () {
   *   test = new TestPair()
   *   test.leftNode = ClientNode('client', log, test.left)
   *   return test
   * }
   */
  leftNode: undefined,

  /**
   * Node instance used in this test, connected with {@link TestPair#right}.
   * @type {BaseNode}
   *
   * @example
   * function createTest () {
   *   test = new TestPair()
   *   test.rightNode = ServerNode('client', log, test.right)
   *   return test
   * }
   */
  rightNode: undefined,

  /**
   * Clear all connections events and messages to test only last events.
   *
   * @return {undefined}
   *
   * @example
   * await client.connection.connect()
   * pair.clear() // Remove all connecting messages
   * await client.log.add({ type: 'a' })
   * expect(pair.leftSent).toEqual([
   *   ['sync', …]
   * ])
   */
  clear: function clear () {
    /**
     * Sent messages from {@link TestPair#left} connection.
     * @type {Message[]}
     *
     * @example
     * await pair.left.send(msg)
     * pair.leftSent //=> [msg]
     *
     * @memberof TestPair#
     */
    this.leftSent = []
    /**
     * Sent messages from {@link TestPair#right} connection.
     * @type {Message[]}
     *
     * @example
     * pair.right.send(msg)
     * pair.rightSent //=> [msg]
     *
     * @memberof TestPair#
     */
    this.rightSent = []

    /**
     * Emitted events from {@link TestPair#left} connection.
     * @type {Array[]}
     *
     * @example
     * await pair.left.connect()
     * pair.leftEvents //=> [['connect']]
     *
     * @memberof TestPair#
     */
    this.leftEvents = []
    /**
     * Emitted events from {@link TestPair#right} connection.
     * @type {Array[]}
     *
     * @example
     * await pair.right.connect()
     * pair.rightEvents //=> [['connect']]
     *
     * @memberof TestPair#
     */
    this.rightEvents = []
  },

  /**
   * Return Promise until next event.
   *
   * @param {"left"|"right"} [receiver] Wait for specific receiver event.
   *
   * @return {Promise} Promise until next event.
   *
   * @example
   * pair.left.send(['test'])
   * await pair.wait('left')
   * pair.leftSend //=> [['test']]
   */
  wait: function wait (receiver) {
    var pair = this
    return new Promise(function (resolve) {
      pair.waiting = function (from) {
        if (!receiver || from === receiver) {
          pair.waiting = false
          resolve(pair)
        }
      }
    })
  }

}

module.exports = TestPair
