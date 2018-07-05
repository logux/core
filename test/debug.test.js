var ServerNode = require('../server-node')
var TestTime = require('../test-time')
var TestPair = require('../test-pair')

var node

function createTest () {
  var test = new TestPair()
  node = new ServerNode('server', TestTime.getLog(), test.left)
  test.leftNode = node
  return test.left.connect().then(function () {
    return test
  })
}

afterEach(function () {
  node.destroy()
})

it('sends debug messages', function () {
  return createTest().then(function (test) {
    test.leftNode.sendDebug('testType', 'testData')
    return test.wait('right')
  }).then(function (test) {
    expect(test.leftSent).toEqual([['debug', 'testType', 'testData']])
  })
})

it('emits a debug on debug error messages', function () {
  var pair = new TestPair()
  node = new ServerNode('server', TestTime.getLog(), pair.left)
  node.authenticated = true

  var debugs = []
  node.on('debug', function (type, data) {
    debugs.push(type, data)
  })

  node.onMessage(['debug', 'error', 'testData'])

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
      expect(test.leftNode.connected).toBeFalsy()
      expect(test.leftSent).toEqual([
        ['error', 'wrong-format', JSON.stringify(command)]
      ])
    })
  }))
})
