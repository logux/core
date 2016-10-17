var LocalPair = require('../local-pair')

var Reconnect = require('../reconnect')

it('saves connection and options', function () {
  var con = { on: function () { } }
  var recon = new Reconnect(con, { a: 1 })
  expect(recon.connection).toBe(con)
  expect(recon.options).toEqual({ a: 1 })
})

it('uses default options', function () {
  var con = { on: function () { } }
  var recon = new Reconnect(con)
  expect(recon.options).toEqual({ })
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

  pair.right.send(['error', '', 'protocol'])
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

it('reconnects automatically', function () {
  var pair = new LocalPair()
  var recon = new Reconnect(pair.left)

  recon.connect()
  pair.right.disconnect()

  expect(pair.right.connected).toBeTruthy()
})

it('allows to disable reconnecting', function () {
  var pair = new LocalPair()
  var recon = new Reconnect(pair.left)

  recon.connect()
  recon.reconnecting = false
  pair.right.disconnect()

  expect(pair.right.connected).toBeFalsy()
})
