var TestTime = require('logux-core').TestTime

var ClientSync = require('../client-sync')
var LocalPair = require('../local-pair')

function nextTick () {
  return new Promise(function (resolve) {
    setTimeout(resolve, 1)
  })
}

it('connects first', function () {
  var log = TestTime.getLog()
  var pair = new LocalPair()
  var sync = new ClientSync('client', log, pair.left)

  sync.sendConnect = jest.fn()
  pair.left.connect()
  return nextTick().then(function () {
    expect(sync.sendConnect).toBeCalled()
  })
})

it('saves last added from ping', function () {
  var log = TestTime.getLog()
  var pair = new LocalPair()
  var sync = new ClientSync('client', log, pair.left, { fixTime: false })

  pair.left.connect()
  return nextTick().then(function () {
    pair.right.send(['connected', sync.protocol, 'server'], [0, 0])
    expect(sync.otherSynced).toBe(0)

    pair.right.send(['ping', 1])
    expect(sync.otherSynced).toBe(1)

    sync.sendPing()
    pair.right.send(['pong', 2])
    expect(sync.otherSynced).toBe(2)
  })
})
