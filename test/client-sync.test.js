var delay = require('nanodelay')

var ClientSync = require('../client-sync')
var TestTime = require('../test-time')
var TestPair = require('../test-pair')

var sync
afterEach(function () {
  sync.destroy()
})

it('connects first', function () {
  var pair = new TestPair()
  sync = new ClientSync('client', TestTime.getLog(), pair.left)
  sync.sendConnect = jest.fn()
  return pair.left.connect().then(function () {
    expect(sync.sendConnect).toBeCalled()
  })
})

it('saves last added from ping', function () {
  var log = TestTime.getLog()
  var pair = new TestPair()
  sync = new ClientSync('client', log, pair.left, { fixTime: false })
  return pair.left.connect().then(function () {
    pair.right.send(['connected', sync.localProtocol, 'server', [0, 0]])
    return pair.wait()
  }).then(function () {
    expect(sync.lastReceived).toBe(0)
    pair.right.send(['ping', 1])
    return pair.wait('right')
  }).then(function () {
    expect(sync.lastReceived).toBe(1)
    sync.sendPing()
    pair.right.send(['pong', 2])
    return pair.wait('left')
  }).then(function () {
    expect(sync.lastReceived).toBe(2)
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
  sync = new ClientSync('client', log, pair.left, { fixTime: false })

  return pair.left.connect().then(function () {
    return delay(10)
  }).then(function () {
    expect(pair.leftSent).toEqual([])
    returnLastAdded(10)
    return delay(10)
  }).then(function () {
    expect(pair.leftSent).toEqual([
      ['connect', sync.localProtocol, 'client', 0]
    ])
  })
})
