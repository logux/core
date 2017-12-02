var TestTime = require('logux-core').TestTime
var delay = require('nanodelay')

var ServerSync = require('../server-sync')
var TestPair = require('../test-pair')

it('has connecting state from the beginning', function () {
  var pair = new TestPair()
  pair.right.connect()
  var sync = new ServerSync('server', TestTime.getLog(), pair.left)
  expect(sync.state).toEqual('connecting')
})

it('destroys on disconnect', function () {
  var pair = new TestPair()
  var sync = new ServerSync('server', TestTime.getLog(), pair.left)
  sync.destroy = jest.fn()
  return pair.left.connect().then(function () {
    pair.left.disconnect()
    expect(sync.destroy).toBeCalled()
  })
})

it('destroys on connect timeout', function () {
  var log = TestTime.getLog()
  var pair = new TestPair()
  var sync = new ServerSync('server', log, pair.left, { timeout: 200 })

  var error
  sync.catch(function (err) {
    error = err
  })

  sync.destroy = jest.fn()
  return pair.left.connect().then(function () {
    expect(sync.destroy).not.toBeCalled()
    return delay(200)
  }).then(function () {
    expect(error.message).toContain('timeout')
    expect(sync.destroy).toBeCalled()
  })
})

it('throws on fixTime option', function () {
  var log = TestTime.getLog()
  var pair = new TestPair()
  expect(function () {
    new ServerSync('a', log, pair.left, { fixTime: true })
  }).toThrowError(/fixTime/)
})

it('loads only last added from store', function () {
  var log = TestTime.getLog()
  var con = { on: function () { } }
  var sync
  log.store.setLastSynced({ sent: 1, received: 2 })
  return log.add({ type: 'a' }, { reasons: ['test'] }).then(function () {
    sync = new ServerSync('server', log, con)
    return sync.initializing
  }).then(function () {
    expect(sync.lastAddedCache).toBe(1)
    expect(sync.lastSent).toBe(0)
    expect(sync.lastReceived).toBe(0)
  })
})

it('supports connection before initializing', function () {
  var log = TestTime.getLog()

  var returnLastAdded
  log.store.getLastAdded = function () {
    return new Promise(function (resolve) {
      returnLastAdded = resolve
    })
  }

  var pair = new TestPair()
  var sync = new ServerSync('server', log, pair.left, { timeout: 50, ping: 50 })

  return pair.right.connect().then(function () {
    pair.right.send(['connect', sync.localProtocol, 'client', 0])
    return delay(70)
  }).then(function () {
    expect(pair.leftSent).toEqual([])
    returnLastAdded(10)
    return delay(70)
  }).then(function () {
    expect(sync.connected).toBeTruthy()
    expect(pair.leftSent).toHaveLength(2)
    expect(pair.leftSent[0][0]).toEqual('connected')
    expect(pair.leftSent[1]).toEqual(['ping', 10])
  })
})
