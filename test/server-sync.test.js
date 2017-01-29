var TestTime = require('logux-core').TestTime

var ServerSync = require('../server-sync')
var TestPair = require('../test-pair')

function wait (ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms)
  })
}

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
    return wait(200)
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
  return log.add({ type: 'a' }).then(function () {
    sync = new ServerSync('server', log, con)
    return sync.initializing
  }).then(function () {
    expect(sync.lastAddedCache).toBe(1)
    expect(sync.synced).toBe(0)
    expect(sync.otherSynced).toBe(0)
  })
})
