var NanoEvents = require('nanoevents')

var ServerSync = require('../server-sync')
var LocalPair = require('../local-pair')

it('has connecting state from the beginning', function () {
  var log = new NanoEvents()
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
  var log = new NanoEvents()
  var pair = new LocalPair()
  var sync = new ServerSync('server', log, pair.left)

  sync.destroy = jest.fn()
  pair.left.connect()
  pair.left.disconnect()
  expect(sync.destroy).toBeCalled()
})

it('destroys on connect timeout', function () {
  jest.useFakeTimers()

  var log = new NanoEvents()
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
  expect(function () {
    new ServerSync('a', new NanoEvents(), new NanoEvents(), { fixTime: true })
  }).toThrowError(/fixTime/)
})

it('throws on synced ot otherSynced option', function () {
  expect(function () {
    new ServerSync('a', new NanoEvents(), new NanoEvents(), {
      otherSynced: 1,
      synced: 1
    })
  }).toThrowError(/synced/)
})
