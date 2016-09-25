var PassiveSync = require('../passive-sync')
var ActiveSync = require('../active-sync')
var LocalPair = require('../local-pair')

function createTest () {
  var pair = new LocalPair()
  var log = { on: function () { } }
  var active = new ActiveSync('client', log, pair.left)
  var passive = new PassiveSync('server', log, pair.right)

  active.catch(function () { })

  var sendedActive = []
  passive.connection.on('message', function (msg) {
    sendedActive.push(msg)
  })
  var sendedPassive = []
  active.connection.on('message', function (msg) {
    sendedPassive.push(msg)
  })

  return {
    sendedPassive: sendedPassive,
    sendedActive: sendedActive,
    passive: passive,
    active: active
  }
}

it('sends protocol version and host in connect message', function () {
  var test = createTest()
  test.active.connection.connect()
  expect(test.sendedActive).toEqual([
    ['connect', test.active.protocol, 'client']
  ])
})

it('answers with protocol version and host in connected message', function () {
  var test = createTest()
  test.active.connection.connect()
  expect(test.sendedPassive).toEqual([
    ['connected', test.active.protocol, 'server']
  ])
})

it('checks protocol version', function () {
  var test = createTest()
  test.active.protocol = [2, 0]
  test.passive.protocol = [1, 0]

  test.active.connection.connect()
  expect(test.sendedPassive).toEqual([
    ['error', 'Only 1.x protocols are supported, but you use 2.0', 'protocol']
  ])
})

it('saves other client host', function () {
  var test = createTest()
  test.active.connection.connect()
  expect(test.active.otherHost).toEqual('server')
  expect(test.passive.otherHost).toEqual('client')
})

it('saves other client protocol', function () {
  var test = createTest()
  test.active.protocol = [1, 0]
  test.passive.protocol = [1, 1]

  test.active.connection.connect()
  expect(test.active.otherProtocol).toEqual([1, 1])
  expect(test.passive.otherProtocol).toEqual([1, 0])
})
