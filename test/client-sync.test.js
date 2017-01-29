var TestTime = require('logux-core').TestTime

var ClientSync = require('../client-sync')
var TestPair = require('../test-pair')

it('connects first', function () {
  var pair = new TestPair()
  var sync = new ClientSync('client', TestTime.getLog(), pair.left)
  sync.sendConnect = jest.fn()
  return pair.left.connect().then(function () {
    expect(sync.sendConnect).toBeCalled()
  })
})

it('saves last added from ping', function () {
  var log = TestTime.getLog()
  var pair = new TestPair()
  var sync = new ClientSync('client', log, pair.left, { fixTime: false })
  return pair.left.connect().then(function () {
    pair.right.send(['connected', sync.protocol, 'server', [0, 0]])
    return pair.wait()
  }).then(function () {
    expect(sync.otherSynced).toBe(0)
    pair.right.send(['ping', 1])
    return pair.wait()
  }).then(function () {
    expect(sync.otherSynced).toBe(1)
    sync.sendPing()
    pair.right.send(['pong', 2])
    return pair.wait('left')
  }).then(function () {
    expect(sync.otherSynced).toBe(2)
  })
})
