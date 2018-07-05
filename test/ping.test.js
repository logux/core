var delay = require('nanodelay')

var ServerNode = require('../server-node')
var ClientNode = require('../client-node')
var TestTime = require('../test-time')
var TestPair = require('../test-pair')

var node

function createTest (opts) {
  var log = TestTime.getLog()
  var test = new TestPair()
  return log.add({ type: 'test' }, { reasons: ['test'] }).then(function () {
    log.store.lastSent = 1
    node = new ClientNode('client', log, test.left, opts)
    test.leftNode = node
    return test.left.connect()
  }).then(function () {
    return test.wait()
  }).then(function () {
    var protocol = test.leftNode.localProtocol
    test.right.send(['connected', protocol, 'server', [0, 0]])
    test.clear()
    return test
  })
}

afterEach(function () {
  if (node) {
    node.destroy()
    node = undefined
  }
})

it('throws on ping and no timeout options', function () {
  expect(function () {
    new ClientNode('client', null, null, { ping: 1000, timeout: 0 })
  }).toThrowError(/set timeout option/)
})

it('answers pong on ping', function () {
  return createTest({ fixTime: false }).then(function (test) {
    test.right.send(['ping', 1])
    return test.wait('right')
  }).then(function (test) {
    expect(test.leftSent).toEqual([['pong', 1]])
  })
})

it('sends ping on idle connection', function () {
  var error
  return createTest({
    ping: 300,
    timeout: 100,
    fixTime: false
  }).then(function (test) {
    test.leftNode.catch(function (err) {
      error = err
    })
    return delay(250, test)
  }).then(function (test) {
    test.right.send(['duilian', ''])
    return delay(250, test)
  }).then(function (test) {
    test.leftNode.send(['duilian', ''])
    return delay(250, test)
  }).then(function (test) {
    expect(error).toBeUndefined()
    expect(test.leftSent).toEqual([['duilian', '']])
    return delay(100, test)
  }).then(function (test) {
    expect(error).toBeUndefined()
    expect(test.leftSent).toEqual([['duilian', ''], ['ping', 1]])
    test.right.send(['pong', 1])
    return delay(250, test)
  }).then(function (test) {
    expect(error).toBeUndefined()
    expect(test.leftSent).toEqual([['duilian', ''], ['ping', 1]])
    return delay(100, test)
  }).then(function (test) {
    expect(error).toBeUndefined()
    expect(test.leftSent).toEqual([['duilian', ''], ['ping', 1], ['ping', 1]])
    return delay(250, test)
  }).then(function (test) {
    expect(error.message).toContain('timeout')
    expect(test.leftSent).toEqual([['duilian', ''], ['ping', 1], ['ping', 1]])
    expect(test.leftEvents[3]).toEqual(['disconnect', 'timeout'])
  })
})

it('does not ping before authentication', function () {
  var log = TestTime.getLog()
  var test = new TestPair()
  test.leftNode = new ClientNode('client', log, test.left, {
    ping: 100,
    timeout: 300,
    fixTime: false
  })
  test.leftNode.catch(function () { })
  return test.left.connect().then(function () {
    return test.wait()
  }).then(function () {
    test.clear()
    return delay(250)
  }).then(function () {
    expect(test.leftSent).toEqual([])
  })
})

it('sends only one ping if timeout is bigger than ping', function () {
  return createTest({
    ping: 100,
    timeout: 300,
    fixTime: false
  }).then(function (test) {
    return delay(250).then(function () {
      expect(test.leftSent).toEqual([['ping', 1]])
    })
  })
})

it('checks types', function () {
  var wrongs = [
    ['ping'],
    ['ping', 'abc'],
    ['ping', []],
    ['pong'],
    ['pong', 'abc'],
    ['pong', {}]
  ]
  return Promise.all(wrongs.map(function (command) {
    var test = new TestPair()
    var log = TestTime.getLog()
    test.leftNode = new ServerNode('server', log, test.left)
    return test.left.connect().then(function () {
      test.right.send(command)
      return test.wait('right')
    }).then(function () {
      expect(test.leftNode.connected).toBeFalsy()
      expect(test.leftSent).toEqual([
        ['error', 'wrong-format', JSON.stringify(command)]
      ])
    })
  }))
})
