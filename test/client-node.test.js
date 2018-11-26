var delay = require('nanodelay')

var ClientNode = require('../client-node')
var TestTime = require('../test-time')
var TestPair = require('../test-pair')

var node
afterEach(function () {
  node.destroy()
})

it('connects first', function () {
  var pair = new TestPair()
  node = new ClientNode('client', TestTime.getLog(), pair.left)
  jest.spyOn(node, 'sendConnect')
  return pair.left.connect().then(function () {
    expect(node.sendConnect).toBeCalled()
  })
})

it('saves last added from ping', function () {
  var log = TestTime.getLog()
  var pair = new TestPair()
  node = new ClientNode('client', log, pair.left, { fixTime: false })
  return pair.left.connect().then(function () {
    pair.right.send(['connected', node.localProtocol, 'server', [0, 0]])
    return pair.wait()
  }).then(function () {
    expect(node.lastReceived).toBe(0)
    pair.right.send(['ping', 1])
    return pair.wait('right')
  }).then(function () {
    expect(node.lastReceived).toBe(1)
    node.sendPing()
    pair.right.send(['pong', 2])
    return pair.wait('left')
  }).then(function () {
    expect(node.lastReceived).toBe(2)
  })
})

it('does not connect before initializing', function () {
  var log = TestTime.getLog()

  var returnLastAdded
  log.store.getLastAdded = function () {
    return new Promise(function (resolve) {
      returnLastAdded = resolve
    })
  }

  var pair = new TestPair()
  node = new ClientNode('client', log, pair.left, { fixTime: false })

  return pair.left.connect().then(function () {
    return delay(10)
  }).then(function () {
    expect(pair.leftSent).toEqual([])
    returnLastAdded(10)
    return delay(10)
  }).then(function () {
    expect(pair.leftSent).toEqual([
      ['connect', node.localProtocol, 'client', 0]
    ])
  })
})
