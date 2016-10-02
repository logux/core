var createTestTimer = require('logux-core').createTestTimer
var MemoryStore = require('logux-core').MemoryStore
var Log = require('logux-core').Log

var LocalPair = require('../local-pair')
var Client = require('../client')

it('connects first', function () {
  var log = new Log({ store: new MemoryStore(), timer: createTestTimer() })
  var pair = new LocalPair()
  var sync = new Client('host', log, pair.left)

  sync.sendConnect = jest.fn()
  pair.left.connect()
  expect(sync.sendConnect).toBeCalled()
})

it('saves last added from ping', function () {
  var log = new Log({ store: new MemoryStore(), timer: createTestTimer() })
  var pair = new LocalPair()
  var sync = new Client('host', log, pair.left)

  pair.left.connect()
  pair.right.send(['connected', sync.protocol, 'server'])
  expect(sync.otherSynced).toBe(0)

  pair.right.send(['ping', 1])
  expect(sync.otherSynced).toBe(1)

  sync.sendPing()
  pair.right.send(['pong', 2])
  expect(sync.otherSynced).toBe(2)
})
