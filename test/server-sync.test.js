var TestTime = require('logux-core').TestTime

var ServerSync = require('../server-sync')
var LocalPair = require('../local-pair')

it('has connecting state from the beginning', function () {
  var log = TestTime.getLog()
  var pair = new LocalPair()
  pair.right.connect()

  var sync = new ServerSync('server', log, pair.left)
  var states = []
  sync.on('state', function () {
    states.push(sync.state)
  })

  expect(sync.state).toEqual('connecting')

  pair.right.disconnect()
  expect(states).toEqual(['disconnected'])
})

it('destroys on disconnect', function () {
  var log = TestTime.getLog()
  var pair = new LocalPair()
  var sync = new ServerSync('server', log, pair.left)

  sync.destroy = jest.fn()
  pair.left.connect()
  pair.left.disconnect()
  expect(sync.destroy).toBeCalled()
})

it('destroys on connect timeout', function () {
  jest.useFakeTimers()

  var log = TestTime.getLog()
  var pair = new LocalPair()
  var sync = new ServerSync('server', log, pair.left, { timeout: 1000 })

  var error
  sync.catch(function (err) {
    error = err
  })

  sync.destroy = jest.fn()
  pair.left.connect()
  expect(sync.destroy).not.toBeCalled()

  jest.runOnlyPendingTimers()
  expect(sync.destroy).toBeCalled()
  expect(error.message).toContain('timeout')
})

it('throws on fixTime option', function () {
  var log = TestTime.getLog()
  var pair = new LocalPair()
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
