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
 * @example
 * import { testPair } from 'logux-sync'
 * it('tracks events', () => {
 *   const pair = new testPair()
 *   const client = new ClientSync(pair.right)
 *   return pair.left.connect().then(() => {
 *     expect(pair.leftEvents).toEqual('connect')
 *     return pair.left.send(msg)
 *   }).then(() => {
 *     expect(pair.leftSent).toEqual([msg])
 *   })
 * })
 *
 * @extends LocalPair
 * @class
 */
function TestPair () {
  LocalPair.call(this)

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

  this.left.on('disconnect', function () {
    pair.leftEvents.push(['disconnect'])
    if (pair.waiting) pair.waiting('left')
  })
  this.right.on('disconnect', function () {
    pair.rightEvents.push(['disconnect'])
    if (pair.waiting) pair.waiting('right')
  })
}

TestPair.prototype = {

  /**
   * Sync instance used in this test, connected with {@link TestPair#left}.
   * @type {Sync}
   *
   * @example
   * function createTest () {
   *   test = new TestPair()
   *   test.leftSync = ClientSync('client', log, test.left)
   *   return test
   * }
   */
  leftSync: undefined,

  /**
   * Sync instance used in this test, connected with {@link TestPair#right}.
   * @type {Sync}
   *
   * @example
   * function createTest () {
   *   test = new TestPair()
   *   test.rightSync = ServerSync('client', log, test.right)
   *   return test
   * }
   */
  rightSync: undefined,

  /**
   * Clear all connections events and messages to test only last events.
   *
   * @return {undefined}
   *
   * @example
   * client.connection.connect()
   * return wait(1).then(() => {
   *   pair.clear() // Remove all connecting messages
   *   return client.log.add({ type: 'a' })
   * }).then(() => {
   *   expect(pair.leftSent).toEqual([
   *     ['sync', …]
   *   ])
   * })
   */
  clear: function clear () {
    /**
     * Sent messages from {@link TestPair#left} connection.
     * @type {Message[]}
     *
     * @example
     * pair.left.send(msg).then(() => {
     *   pair.leftSent //=> [msg]
     * })
     */
    this.leftSent = []
    /**
     * Sent messages from {@link TestPair#right} connection.
     * @type {Message[]}
     *
     * @example
     * pair.right.send(msg)
     * pair.rightSent //=> [msg]
     */
    this.rightSent = []

    /**
     * Emitted events from {@link TestPair#left} connection.
     * @type {Array[]}
     *
     * @example
     * pair.left.connect().then(() => {
     *   pair.leftEvents //=> [['connect']]
     * })
     */
    this.leftEvents = []
    /**
     * Emitted events from {@link TestPair#right} connection.
     * @type {Array[]}
     *
     * @example
     * pair.right.connect().then(() => {
     *   pair.rightEvents //=> [['connect']]
     * })
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
   * return pair.wait('left').then(() => {
   *   pair.leftSend //=> [['test']]
   * })
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
