var PassiveSync = require('../passive-sync')
var LocalPair = require('../local-pair')

it('destroys on disconnect', function () {
  var log = { on: function () { } }
  var pair = new LocalPair()
  var sync = new PassiveSync('host', log, pair.left)

  sync.destroy = jest.fn()
  pair.left.connect()
  pair.left.disconnect()
  expect(sync.destroy).toBeCalled()
})

it('destroys on connect timeout', function () {
  jest.useFakeTimers()

  var log = { on: function () { } }
  var pair = new LocalPair()
  var sync = new PassiveSync('host', log, pair.left, { timeout: 1000 })

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
