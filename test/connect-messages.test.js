var NanoEvents = require('nanoevents')

var PassiveSync = require('../passive-sync')
var ActiveSync = require('../active-sync')
var LocalPair = require('../local-pair')

function createTest () {
  var log = new NanoEvents()
  var pair = new LocalPair()
  var active = new ActiveSync('client', log, pair.left)
  var passive = new PassiveSync('server', log, pair.right)

  active.catch(function () { })
  passive.catch(function () { })

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

function nextTick () {
  return new Promise(function (resolve) {
    setTimeout(function () {
      resolve()
    }, 1)
  })
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
    ['connected', test.passive.protocol, 'server']
  ])
})

it('checks protocol version', function () {
  var test = createTest()
  test.active.protocol = [2, 0]
  test.passive.protocol = [1, 0]

  test.active.connection.connect()
  test.passive.connection.emitter.emit('message', ['test', 1])

  expect(test.sendedPassive).toEqual([
    ['error', 'Only 1.x protocols are supported, but you use 2.0', 'protocol']
  ])
  expect(test.active.connected).toBeFalsy()
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

it('sends credentials in connect', function () {
  var test = createTest()
  test.active.options = { credentials: { a: 1, b: 2 } }

  test.active.connection.connect()
  expect(test.sendedActive).toEqual([
    ['connect', test.active.protocol, 'client', { a: 1, b: 2 }]
  ])
})

it('sends credentials in connected', function () {
  var test = createTest()
  test.passive.options = { credentials: 1 }

  test.active.connection.connect()
  expect(test.sendedPassive).toEqual([
    ['connected', test.passive.protocol, 'server', 1]
  ])
})

it('denies access for wrong users', function () {
  var test = createTest()
  test.passive.testMessage = jest.fn()
  test.passive.options = {
    auth: function () {
      return Promise.resolve(false)
    }
  }

  test.active.connection.connect()
  test.active.send(['test'])

  return nextTick().then(function () {
    expect(test.sendedPassive).toEqual([
      ['error', 'Wrong credentials', 'auth']
    ])
    expect(test.passive.testMessage).not.toBeCalled()
    expect(test.passive.connected).toBeFalsy()
  })
})

it('denies access to wrong server', function () {
  var test = createTest()
  test.active.options = {
    auth: function () {
      return Promise.resolve(false)
    }
  }

  test.active.connection.connect()

  return nextTick().then(function () {
    expect(test.sendedActive).toEqual([
      ['connect', [0, 0], 'client'],
      ['error', 'Wrong credentials', 'auth']
    ])
    expect(test.active.connected).toBeFalsy()
  })
})

it('allows access for right users', function () {
  var test = createTest()
  test.active.options = { credentials: 'a' }
  test.passive.testMessage = jest.fn()
  test.passive.options = {
    auth: function (credentials, host) {
      return Promise.resolve(credentials === 'a' && host === 'client')
    }
  }

  test.active.connection.connect()
  test.active.send(['test'])

  return nextTick().then(function () {
    expect(test.sendedPassive).toEqual([
      ['connected', [0, 0], 'server']
    ])
    expect(test.passive.testMessage).toBeCalled()
  })
})
