var TestTime = require('logux-core').TestTime

var SyncError = require('../sync-error')
var TestPair = require('../test-pair')
var BaseSync = require('../base-sync')

function createSync () {
  var pair = new TestPair()
  return new BaseSync('server', TestTime.getLog(), pair.left)
}

function createTest () {
  var test = new TestPair()
  test.leftSync = new BaseSync('server', TestTime.getLog(), test.left)
  return test.left.connect().then(function () {
    return test
  })
}

it('sends error on wrong message format', function () {
  var wrongs = [
    1,
    { hi: 1 },
    [],
    [1]
  ]
  return Promise.all(wrongs.map(function (msg) {
    return createTest().then(function (test) {
      test.right.send(msg)
      return test.wait('right')
    }).then(function (test) {
      expect(test.left.connected).toBeFalsy()
      expect(test.leftSent).toEqual([
        ['error', 'wrong-format', JSON.stringify(msg)]
      ])
    })
  }))
})

it('sends error on wrong error parameters', function () {
  var wrongs = [
    ['error'],
    ['error', 1],
    ['error', { }]
  ]
  return Promise.all(wrongs.map(function (msg) {
    return createTest().then(function (test) {
      test.right.send(msg)
      return test.wait('right')
    }).then(function (test) {
      expect(test.left.connected).toBeFalsy()
      expect(test.leftSent).toEqual([
        ['error', 'wrong-format', JSON.stringify(msg)]
      ])
    })
  }))
})

it('sends error on unknown message type', function () {
  return createTest().then(function (test) {
    test.right.send(['test'])
    return test.wait('right')
  }).then(function (test) {
    expect(test.left.connected).toBeFalsy()
    expect(test.leftSent).toEqual([
      ['error', 'unknown-message', 'test']
    ])
  })
})

it('throws a error on error message by default', function () {
  var sync = createSync()
  expect(function () {
    sync.onMessage(['error', 'wrong-format', '1'])
  }).toThrow(new SyncError(sync, 'wrong-format', '1', true))
})

it('disables throwing a error on listener', function () {
  var sync = createSync()

  var errors = []
  sync.catch(function (error) {
    errors.push(error)
  })

  sync.onMessage(['error', 'wrong-format', '2'])
  expect(errors).toEqual([new SyncError(sync, 'wrong-format', '2', true)])
})

it('emits a event on error sending', function () {
  return createTest().then(function (test) {
    var errors = []
    test.leftSync.on('clientError', function (err) {
      errors.push(err)
    })

    var error = new SyncError(test.leftSync, 'test', 'type')
    test.leftSync.sendError(error)
    expect(errors).toEqual([error])
  })
})
