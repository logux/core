let NanoEvents = require('nanoevents')
let delay = require('nanodelay')

let TestTime = require('../test-time')
let TestPair = require('../test-pair')
let BaseNode = require('../base-node')

function createNode (opts) {
  let pair = new TestPair()
  let log = TestTime.getLog()
  log.on('preadd', (action, meta) => {
    meta.reasons = ['test']
  })
  return new BaseNode('client', log, pair.left, opts)
}

async function createTest () {
  let node = createNode()
  let test = node.connection.pair
  test.leftNode = node
  await test.left.connect()
  return test
}

function listeners (emitter) {
  return Object.keys(emitter.events)
    .map(i => emitter.events[i].length)
    .reduce((all, i) => all + i, 0)
}

it('saves all arguments', () => {
  let log = TestTime.getLog()
  let connection = new NanoEvents()
  let node = new BaseNode('client', log, connection, { a: 1 })

  expect(node.localNodeId).toEqual('client')
  expect(node.log).toBe(log)
  expect(node.connection).toBe(connection)
  expect(node.options).toEqual({ a: 1 })
})

it('allows to miss options', () => {
  expect(createNode().options).toEqual({ })
})

it('has protocol version', () => {
  let node = createNode()
  expect(typeof node.localProtocol).toEqual('number')
  expect(typeof node.minProtocol).toEqual('number')
  expect(node.localProtocol).toBeGreaterThanOrEqual(node.minProtocol)
})

it('unbind all listeners on destroy', () => {
  let node = new BaseNode('client', TestTime.getLog(), new NanoEvents())

  expect(listeners(node.log.emitter)).toBeGreaterThan(0)
  expect(listeners(node.connection)).toBeGreaterThan(0)

  node.destroy()
  expect(listeners(node.log.emitter)).toEqual(0)
  expect(listeners(node.connection)).toEqual(0)
})

it('destroys connection on destroy', () => {
  let node = createNode()
  node.connection.destroy = function () { }
  jest.spyOn(node.connection, 'disconnect')
  jest.spyOn(node.connection, 'destroy')

  node.destroy()
  expect(node.connection.disconnect).not.toHaveBeenCalledWith('destroy')
  expect(node.connection.destroy).toHaveBeenCalledTimes(1)
})

it('disconnects on destroy', async () => {
  let node = createNode()
  await node.connection.connect()
  node.destroy()
  expect(node.connection.connected).toBe(false)
})

it('does not throw error on send to disconnected connection', () => {
  let node = createNode()
  expect(() => {
    node.sendDuilian()
  }).not.toThrow()
})

it('sends messages to connection', async () => {
  let test = await createTest()
  test.leftNode.send(['test'])
  await test.wait()
  expect(test.leftSent).toEqual([['test']])
})

it('has connection state', async () => {
  let node = createNode()
  expect(node.connected).toBe(false)
  await node.connection.connect()
  expect(node.connected).toBe(true)
  node.connection.disconnect()
  expect(node.connected).toBe(false)
})

it('has state', async () => {
  let node = createNode()
  let pair = node.connection.pair

  let states = []
  node.on('state', () => {
    states.push(node.state)
  })

  expect(node.state).toEqual('disconnected')
  await node.connection.connect()
  node.sendConnect()
  pair.right.send(['connected', node.localProtocol, 'server', [0, 0]])
  await node.waitFor('synchronized')
  expect(node.state).toEqual('synchronized')
  await node.log.add({ type: 'a' })
  expect(node.state).toEqual('sending')
  pair.right.send(['synced', 1])
  await node.waitFor('synchronized')
  expect(node.state).toEqual('synchronized')
  node.connection.disconnect()
  expect(node.state).toEqual('disconnected')
  await node.log.add({ type: 'b' })
  expect(node.state).toEqual('disconnected')
  node.connection.emitter.emit('connecting')
  expect(node.state).toEqual('connecting')
  await node.connection.connect()
  node.sendConnect()
  pair.right.send(['connected', node.localProtocol, 'server', [0, 0]])
  await node.waitFor('sending')
  expect(node.state).toEqual('sending')
  pair.right.send(['synced', 2])
  await node.waitFor('synchronized')
  expect(node.state).toEqual('synchronized')
  await node.log.add({ type: 'c' })
  node.connection.disconnect()
  expect(states).toEqual([
    'connecting',
    'synchronized',
    'sending',
    'synchronized',
    'disconnected',
    'connecting',
    'sending',
    'synchronized',
    'sending',
    'disconnected'
  ])
})

it('does not wait for state change is current state is correct', async () => {
  await createNode().waitFor('disconnected')
})

it('loads lastSent, lastReceived and lastAdded from store', async () => {
  let log = TestTime.getLog()
  let con = new NanoEvents()
  let node

  log.store.setLastSynced({ sent: 1, received: 2 })
  await log.add({ type: 'a' }, { reasons: ['test'] })
  node = new BaseNode('client', log, con)
  await node.initializing
  expect(node.lastAddedCache).toBe(1)
  expect(node.lastSent).toBe(1)
  expect(node.lastReceived).toBe(2)
})

it('has separated timeouts', async () => {
  let node = createNode({ timeout: 100 })

  let error
  node.catch(e => {
    error = e
  })

  node.startTimeout()
  await delay(60)
  node.startTimeout()
  await delay(60)
  expect(error.message).toContain('timeout')
})

it('stops timeouts on disconnect', async () => {
  let node = createNode({ timeout: 10 })

  let error
  node.catch(e => {
    error = e
  })

  node.startTimeout()
  node.startTimeout()
  node.onDisconnect()

  await delay(50)
  node.startTimeout()
  expect(error).toBeUndefined()
})

it('accepts already connected connection', async () => {
  let pair = new TestPair()
  let node
  await pair.left.connect()
  node = new BaseNode('client', TestTime.getLog(), pair.left)
  await node.initializing
  expect(node.connected).toBe(true)
})

it('receives errors from connection', async () => {
  let test = await createTest()
  let emitted
  test.leftNode.catch(e => {
    emitted = e
  })

  let error = new Error('test')
  test.left.emitter.emit('error', error)

  expect(test.leftNode.connected).toBe(false)
  expect(test.leftEvents).toEqual([
    ['connect'],
    ['disconnect', 'error']
  ])
  expect(emitted).toEqual(error)
})

it('does not fall on sync without connection', async () => {
  await createNode().syncSince(0)
})

it('receives format errors from connection', async () => {
  let test = await createTest()
  let error = new Error('Wrong message format')
  error.received = 'options'
  test.left.emitter.emit('error', error)
  await test.wait()
  expect(test.leftNode.connected).toBe(false)
  expect(test.leftEvents).toEqual([
    ['connect'],
    ['disconnect', 'error']
  ])
  expect(test.leftSent).toEqual([
    ['error', 'wrong-format', 'options']
  ])
})

it('throws error by default', async () => {
  let error = new Error('test')
  let test = await createTest()
  test.leftNode.connection.send = () => {
    throw error
  }
  expect(() => {
    test.leftNode.send(['ping', 0])
  }).toThrow(error)
})

it('disconnect on the error during send', async () => {
  let error = new Error('test')
  let errors = []
  let test = await createTest()
  test.leftNode.catch(e => {
    errors.push(e)
  })
  test.leftNode.connection.send = () => {
    throw error
  }
  test.leftNode.send(['ping', 0])
  await delay(1)
  expect(test.leftNode.connected).toBe(false)
  expect(errors).toEqual([error])
})
