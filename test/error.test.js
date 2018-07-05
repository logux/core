var ServerNode = require('../server-node')
var SyncError = require('../sync-error')
var TestTime = require('../test-time')
var TestPair = require('../test-pair')

var node

function createNode () {
  var pair = new TestPair()
  return new ServerNode('server', TestTime.getLog(), pair.left)
}

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
  node = createNode()
  expect(function () {
    node.onMessage(['error', 'wrong-format', '1'])
  }).toThrow(new SyncError(node, 'wrong-format', '1', true))
})

it('does not throw errors which are not relevant to code', function () {
  node = createNode()
  node.onMessage(['error', 'timeout', '1'])
  node.onMessage(['error', 'wrong-protocol', { }])
  node.onMessage(['error', 'wrong-subprotocol', { }])
})

it('disables throwing a error on listener', function () {
  node = createNode()

  var errors = []
  node.catch(function (error) {
    errors.push(error)
  })

  node.onMessage(['error', 'wrong-format', '2'])
  expect(errors).toEqual([new SyncError(node, 'wrong-format', '2', true)])
})

it('emits a event on error sending', function () {
  return createTest().then(function (test) {
    var errors = []
    test.leftNode.on('clientError', function (err) {
      errors.push(err)
    })

    var error = new SyncError(test.leftNode, 'test', 'type')
    test.leftNode.sendError(error)
    expect(errors).toEqual([error])
  })
})
