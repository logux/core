let NanoEvents = require('nanoevents')
let delay = require('nanodelay')

let TestPair = require('../test-pair')
let Reconnect = require('../reconnect')

afterEach(() => {
  delete global.window
  delete global.document
  delete global.navigator
})

it('saves connection and options', () => {
  let con = { on () { } }
  let recon = new Reconnect(con, { a: 1 })
  expect(recon.connection).toBe(con)
  expect(recon.options.a).toEqual(1)
})

it('uses default options', () => {
  let con = { on () { } }
  let recon = new Reconnect(con)
  expect(typeof recon.options.minDelay).toEqual('number')
})

it('enables reconnecting on connect', () => {
  let con = {
    on () { },
    connect () { },
    connected: false
  }
  let recon = new Reconnect(con)
  expect(recon.reconnecting).toBeFalsy()

  recon.connect()
  expect(recon.reconnecting).toBeTruthy()
})

it('enables reconnecting if connection was already connected', () => {
  let con = {
    on () { },
    connect () { },
    connected: true
  }
  let recon = new Reconnect(con)
  expect(recon.reconnecting).toBeTruthy()
})

it('disables reconnecting on destroy and empty disconnect', async () => {
  let pair = new TestPair()
  let recon = new Reconnect(pair.left)

  await recon.connect()
  recon.disconnect('destroy')
  expect(recon.reconnecting).toBeFalsy()
  expect(pair.leftEvents).toEqual([
    ['connect'],
    ['disconnect', 'destroy']
  ])
  await recon.connect()
  recon.disconnect()
  expect(recon.reconnecting).toBeFalsy()
})

it('reconnects on timeout and error disconnect', () => {
  let con = {
    on () { },
    connected: true,
    disconnect () { }
  }
  let recon = new Reconnect(con)

  recon.disconnect('timeout')
  expect(recon.reconnecting).toBeTruthy()

  recon.disconnect('error')
  expect(recon.reconnecting).toBeTruthy()
})

it('proxies connection methods', () => {
  let sent = []
  let con = {
    on () { },
    send (msg) {
      sent.push(msg)
    },
    connect () {
      this.connected = true
    },
    connected: false,
    disconnect () {
      this.connected = false
    }
  }
  let recon = new Reconnect(con)
  expect(recon.connected).toBeFalsy()

  recon.connect()
  expect(recon.connected).toBeTruthy()

  recon.send(['test'])
  expect(sent).toEqual([['test']])

  recon.disconnect()
  expect(recon.connected).toBeFalsy()
})

it('proxies connection events', async () => {
  let pair = new TestPair()
  let recon = new Reconnect(pair.left)

  let received = []
  let unbind = recon.on('message', msg => {
    received.push(msg)
  })

  await recon.connect()
  pair.right.send(1)
  await pair.wait()
  pair.right.send(2)
  await pair.wait()
  unbind()
  pair.right.send(3)
  await pair.wait()
  expect(received).toEqual([1, 2])
})

it('disables reconnection on protocol error', async () => {
  let pair = new TestPair()
  let recon = new Reconnect(pair.left)
  await recon.connect()
  pair.right.send(['error', 'wrong-protocol'])
  pair.right.disconnect()
  await pair.wait()
  expect(recon.reconnecting).toBeFalsy()
})

it('disables reconnection on authentication error', async () => {
  let pair = new TestPair()
  let recon = new Reconnect(pair.left)
  await recon.connect()
  pair.right.send(['error', 'wrong-credentials'])
  pair.right.disconnect()
  await pair.wait()
  expect(recon.reconnecting).toBeFalsy()
})

it('disables reconnection on subprotocol error', async () => {
  let pair = new TestPair()
  let recon = new Reconnect(pair.left)
  await recon.connect()
  pair.right.send(['error', 'wrong-subprotocol'])
  pair.right.disconnect()
  await pair.wait()
  expect(recon.reconnecting).toBeFalsy()
})

it('disconnects and unbind listeners on destory', async () => {
  let pair = new TestPair()
  let origin = pair.left.emitter.events.connect.length

  let recon = new Reconnect(pair.left)
  expect(pair.left.emitter.events.connect).not.toHaveLength(origin)

  await recon.connect()
  recon.destroy()
  await pair.wait()
  expect(pair.left.emitter.events.connect).toHaveLength(origin)
  expect(pair.right.connected).toBeFalsy()
})

it('reconnects automatically with delay', async () => {
  let pair = new TestPair()
  let recon = new Reconnect(pair.left, { minDelay: 50, maxDelay: 50 })
  await recon.connect()
  pair.right.disconnect()
  await pair.wait()
  expect(pair.right.connected).toBeFalsy()
  await delay(70)
  expect(pair.right.connected).toBeTruthy()
})

it('allows to disable reconnecting', async () => {
  let pair = new TestPair()
  let recon = new Reconnect(pair.left)
  await recon.connect()
  recon.reconnecting = false
  pair.right.disconnect()
  await pair.wait()
  await delay(1)
  expect(pair.right.connected).toBeFalsy()
})

it('has maximum reconnection attempts', async () => {
  let con = new NanoEvents()
  let connects = 0
  con.connect = () => {
    connects += 1
    con.emit('disconnect')
  }

  let recon = new Reconnect(con, {
    attempts: 3,
    minDelay: 0,
    maxDelay: 0
  })

  recon.connect()

  await delay(10)
  expect(recon.reconnecting).toBeFalsy()
  expect(connects).toBe(3)
})

it('tracks connecting state', () => {
  let pair = new TestPair()
  let recon = new Reconnect(pair.left, {
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

it('has dynamic delay', () => {
  let con = new NanoEvents()
  let recon = new Reconnect(con, {
    minDelay: 1000,
    maxDelay: 5000
  })

  function attemptsIsAround (attempt, ms) {
    recon.attempts = attempt
    let time = recon.nextDelay()
    expect(Math.abs(time - ms)).toBeLessThan(1000)
  }

  attemptsIsAround(0, 1000)
  attemptsIsAround(1, 2200)
  attemptsIsAround(2, 4500)
  attemptsIsAround(3, 5000)

  function attemptsIs (attempt, ms) {
    recon.attempts = attempt
    let time = recon.nextDelay()
    expect(time).toEqual(ms)
  }

  for (let i = 4; i < 100; i++) {
    attemptsIs(i, 5000)
  }
})

it('listens for window events', async () => {
  let listeners = { }
  global.navigator = { }
  global.window = {
    addEventListener (name, callback) {
      listeners[name] = callback
    },
    removeEventListener (name, callback) {
      if (listeners[name] === callback) {
        delete listeners[name]
      }
    }
  }
  global.document = global.window

  let pair = new TestPair()
  let recon = new Reconnect(pair.left)

  await recon.connect()
  pair.right.disconnect()
  await pair.wait()
  expect(recon.connected).toBeFalsy()

  document.hidden = true
  listeners.visibilitychange()
  expect(recon.connecting).toBeFalsy()

  document.hidden = false
  listeners.visibilitychange()
  await pair.wait()
  expect(recon.connected).toBeTruthy()

  listeners.freeze()
  expect(recon.connecting).toBeFalsy()
  expect(recon.connected).toBeFalsy()

  navigator.onLine = false
  listeners.resume()
  expect(recon.connecting).toBeFalsy()

  navigator.onLine = true
  listeners.resume()
  await delay(10)
  expect(recon.connected).toBeTruthy()
  pair.right.disconnect()
  await pair.wait()
  expect(pair.right.connected).toBeFalsy()

  navigator.onLine = true
  listeners.online()
  await pair.wait()
  expect(pair.right.connected).toBeTruthy()

  recon.destroy()
  expect(Object.keys(listeners)).toHaveLength(0)
})
