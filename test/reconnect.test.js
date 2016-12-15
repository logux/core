var NanoEvents = require('nanoevents')

var LocalPair = require('../local-pair')
var Reconnect = require('../reconnect')

function wait (ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms)
  })
}

it('saves connection and options', function () {
  var con = { on: function () { } }
  var recon = new Reconnect(con, { a: 1 })
  expect(recon.connection).toBe(con)
  expect(recon.options.a).toEqual(1)
})

it('uses default options', function () {
  var con = { on: function () { } }
  var recon = new Reconnect(con)
  expect(typeof recon.options.minDelay).toEqual('number')
})

it('enables reconnecting on connect', function () {
  var con = {
    on: function () { },
    connect: function () { },
    connected: false
  }
  var recon = new Reconnect(con)
  expect(recon.reconnecting).toBeFalsy()

  recon.connect()
  expect(recon.reconnecting).toBeTruthy()
})

it('enables reconnecting if connection was already connected', function () {
  var con = {
    on: function () { },
    connect: function () { },
    connected: true
  }
  var recon = new Reconnect(con)
  expect(recon.reconnecting).toBeTruthy()
})

it('disables reconnecting on manually disconnect', function () {
  var con = {
    on: function () { },
    connected: true,
    disconnect: function () { }
  }
  var recon = new Reconnect(con)

  recon.disconnect()
  expect(recon.reconnecting).toBeFalsy()
})

it('reconnects on timeout disconnect', function () {
  var con = {
    on: function () { },
    connected: true,
    disconnect: function () { }
  }
  var recon = new Reconnect(con)

  recon.disconnect('timeout')
  expect(recon.reconnecting).toBeTruthy()
})

it('proxies connection methods', function () {
  var sent = []
  var con = {
    on: function () { },
    send: function (msg) {
      sent.push(msg)
    },
    connect: function () {
      this.connected = true
    },
    connected: false,
    disconnect: function () {
      this.connected = false
    }
  }
  var recon = new Reconnect(con)
  expect(recon.connected).toBeFalsy()

  recon.connect()
  expect(recon.connected).toBeTruthy()

  recon.send(['test'])
  expect(sent).toEqual([['test']])

  recon.disconnect()
  expect(recon.connected).toBeFalsy()
})

it('proxies connection events', function () {
  var pair = new LocalPair()
  var recon = new Reconnect(pair.left)

  var received = []
  var unbind = recon.on('message', function (msg) {
    received.push(msg)
  })

  recon.connect()
  pair.right.send(1)
  pair.right.send(2)
  unbind()
  pair.right.send(3)

  expect(received).toEqual([1, 2])
})

it('disables reconnection on protocol error', function () {
  var pair = new LocalPair()
  var recon = new Reconnect(pair.left)

  recon.connect()

  pair.right.send(['error', 'wrong-protocol'])
  pair.right.disconnect()

  expect(recon.reconnecting).toBeFalsy()
})

it('disables reconnection on authentication error', function () {
  var pair = new LocalPair()
  var recon = new Reconnect(pair.left)

  recon.connect()

  pair.right.send(['error', 'wrong-credentials'])
  pair.right.disconnect()

  expect(recon.reconnecting).toBeFalsy()
})

it('disables reconnection on subprotocol error', function () {
  var pair = new LocalPair()
  var recon = new Reconnect(pair.left)

  recon.connect()

  pair.right.send(['error', 'wrong-subprotocol'])
  pair.right.disconnect()

  expect(recon.reconnecting).toBeFalsy()
})

it('disconnects and unbind listeners on destory', function () {
  var pair = new LocalPair()
  var recon = new Reconnect(pair.left)

  recon.connect()
  recon.destroy()

  expect(Object.keys(pair.left.emitter.events)).toEqual([])
  expect(pair.right.connected).toBeFalsy()
})

it('reconnects automatically with delay', function () {
  var pair = new LocalPair()
  var recon = new Reconnect(pair.left, { minDelay: 50, maxDelay: 50 })

  recon.connect()
  pair.right.disconnect()
  expect(pair.right.connected).toBeFalsy()

  return wait(70).then(function () {
    expect(pair.right.connected).toBeTruthy()
  })
})

it('allows to disable reconnecting', function () {
  var pair = new LocalPair()
  var recon = new Reconnect(pair.left)

  recon.connect()
  recon.reconnecting = false
  pair.right.disconnect()

  expect(pair.right.connected).toBeFalsy()
})

it('has maximum reconnection attempts', function () {
  var con = new NanoEvents()
  var connects = 0
  con.connect = function () {
    connects += 1
    con.emit('disconnect')
  }

  var recon = new Reconnect(con, {
    attempts: 3,
    minDelay: 0,
    maxDelay: 0
  })

  recon.connect()

  return wait(10).then(function () {
    expect(recon.reconnecting).toBeFalsy()
    expect(connects).toBe(3)
  })
})

it('tracks connecting state', function () {
  var pair = new LocalPair()
  var recon = new Reconnect(pair.left, {
    minDelay: 1000,
    maxDelay: 5000
  })

  expect(recon.connecting).toBeFalsy()

  pair.left.emitter.emit('connecting')
  expect(recon.connecting).toBeTruthy()

  pair.left.emitter.emit('disconnect')
  expect(recon.connecting).toBeFalsy()

  pair.left.emitter.emit('connecting')
  pair.left.emitter.emit('connect')
  expect(recon.connecting).toBeFalsy()
})

it('has dynamic delay', function () {
  var pair = new LocalPair()
  var recon = new Reconnect(pair.left, {
    minDelay: 1000,
    maxDelay: 5000
  })

  function attemptsIsAround (attempt, ms) {
    recon.attempts = attempt
    var delay = recon.nextDelay()
    expect(Math.abs(delay - ms)).toBeLessThan(1000)
  }

  attemptsIsAround(0, 1000)
  attemptsIsAround(1, 2200)
  attemptsIsAround(2, 4500)
  attemptsIsAround(3, 5000)

  function attemptsIs (attempt, ms) {
    recon.attempts = attempt
    var delay = recon.nextDelay()
    expect(delay).toEqual(ms)
  }

  for (var i = 4; i < 30; i++) {
    attemptsIs(i, 5000)
  }
})

it('reconnects when user open a tab', function () {
  var listener
  document.addEventListener = function (name, callback) {
    expect(name).toEqual('visibilitychange')
    listener = callback
  }
  document.removeEventListener = jest.fn()

  var pair = new LocalPair()
  var recon = new Reconnect(pair.left)

  recon.connect()
  pair.right.disconnect()
  expect(pair.right.connected).toBeFalsy()

  Object.defineProperty(document, 'hidden', {
    get: function () {
      return false
    }
  })
  listener()
  expect(pair.right.connected).toBeTruthy()

  recon.destroy()
  expect(document.removeEventListener).toBeCalled()
})
