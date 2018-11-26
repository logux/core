var NanoEvents = require('nanoevents')
var delay = require('nanodelay')

var ServerNode = require('../server-node')
var TestTime = require('../test-time')
var TestPair = require('../test-pair')

var node
afterEach(function () {
  node.destroy()
})

it('has connecting state from the beginning', function () {
  var pair = new TestPair()
  pair.right.connect()
  node = new ServerNode('server', TestTime.getLog(), pair.left)
  expect(node.state).toEqual('connecting')
})

it('destroys on disconnect', function () {
  var pair = new TestPair()
  node = new ServerNode('server', TestTime.getLog(), pair.left)
  jest.spyOn(node, 'destroy')
  return pair.left.connect().then(function () {
    pair.left.disconnect()
    expect(node.destroy).toBeCalled()
  })
})

it('destroys on connect timeout', function () {
  var log = TestTime.getLog()
  var pair = new TestPair()
  node = new ServerNode('server', log, pair.left, { timeout: 200 })

  var error
  node.catch(function (err) {
    error = err
  })

  jest.spyOn(node, 'destroy')
  return pair.left.connect().then(function () {
    expect(node.destroy).not.toBeCalled()
    return delay(200)
  }).then(function () {
    expect(error.message).toContain('timeout')
    expect(node.destroy).toBeCalled()
  })
})

it('throws on fixTime option', function () {
  var log = TestTime.getLog()
  var pair = new TestPair()
  expect(function () {
    new ServerNode('a', log, pair.left, { fixTime: true })
  }).toThrowError(/fixTime/)
})

it('loads only last added from store', function () {
  var log = TestTime.getLog()
  var con = new NanoEvents()
  log.store.setLastSynced({ sent: 1, received: 2 })
  return log.add({ type: 'a' }, { reasons: ['test'] }).then(function () {
    node = new ServerNode('server', log, con)
    return node.initializing
  }).then(function () {
    expect(node.lastAddedCache).toBe(1)
    expect(node.lastSent).toBe(0)
    expect(node.lastReceived).toBe(0)
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
  node = new ServerNode('server', log, pair.left, { timeout: 50, ping: 50 })

  return pair.right.connect().then(function () {
    pair.right.send(['connect', node.localProtocol, 'client', 0])
    return delay(70)
  }).then(function () {
    expect(pair.leftSent).toEqual([])
    returnLastAdded(10)
    return delay(70)
  }).then(function () {
    expect(node.connected).toBeTruthy()
    expect(pair.leftSent).toHaveLength(2)
    expect(pair.leftSent[0][0]).toEqual('connected')
    expect(pair.leftSent[1]).toEqual(['ping', 10])
  })
})
