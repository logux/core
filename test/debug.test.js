var TestTime = require('logux-core').TestTime

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

it('sends debug messages', function () {
  return createTest().then(function (test) {
    test.leftSync.sendDebug('testType', 'testData')
    return test.wait('right')
  }).then(function (test) {
    expect(test.leftSent).toEqual([['debug', 'testType', 'testData']])
  })
})

it('emits a debug on debug error messages', function () {
  var sync = createSync()
  sync.authenticated = true

  var debugs = []
  sync.on('debug', function (type, data) {
    debugs.push(type, data)
  })

  sync.onMessage(['debug', 'error', 'testData'])

  expect(debugs).toEqual(['error', 'testData'])
})

it('checks types', function () {
  var wrongs = [
    ['debug'],
    ['debug', 0],
    ['debug', []],
    ['debug', {}, 'abc'],
    ['debug', 'error', 0],
    ['debug', 'error', []],
    ['debug', 'error', {}]
  ]
  return Promise.all(wrongs.map(function (command) {
    return createTest().then(function (test) {
      test.right.send(command)
      return test.wait('right')
    }).then(function (test) {
      expect(test.leftSync.connected).toBeFalsy()
      expect(test.leftSent).toEqual([
        ['error', 'wrong-format', JSON.stringify(command)]
      ])
    })
  }))
})
