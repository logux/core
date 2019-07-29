let NanoEvents = require('nanoevents')
let delay = require('nanodelay')

let ServerNode = require('../server-node')
let TestTime = require('../test-time')
let TestPair = require('../test-pair')

let node
afterEach(() => {
  node.destroy()
})

it('has connecting state from the beginning', () => {
  let pair = new TestPair()
  pair.right.connect()
  node = new ServerNode('server', TestTime.getLog(), pair.left)
  expect(node.state).toEqual('connecting')
})

it('destroys on disconnect', async () => {
  let pair = new TestPair()
  node = new ServerNode('server', TestTime.getLog(), pair.left)
  jest.spyOn(node, 'destroy')
  await pair.left.connect()
  pair.left.disconnect()
  expect(node.destroy).toBeCalled()
})

it('destroys on connect timeout', async () => {
  let log = TestTime.getLog()
  let pair = new TestPair()
  node = new ServerNode('server', log, pair.left, { timeout: 200 })

  let error
  node.catch(err => {
    error = err
  })

  jest.spyOn(node, 'destroy')
  await pair.left.connect()
  expect(node.destroy).not.toBeCalled()
  await delay(200)
  expect(error.message).toContain('timeout')
  expect(node.destroy).toBeCalled()
})

it('throws on fixTime option', () => {
  let log = TestTime.getLog()
  let pair = new TestPair()
  expect(() => {
    new ServerNode('a', log, pair.left, { fixTime: true })
  }).toThrowError(/fixTime/)
})

it('loads only last added from store', async () => {
  let log = TestTime.getLog()
  let con = new NanoEvents()
  log.store.setLastSynced({ sent: 1, received: 2 })
  await log.add({ type: 'a' }, { reasons: ['test'] })
  node = new ServerNode('server', log, con)
  await node.initializing
  expect(node.lastAddedCache).toBe(1)
  expect(node.lastSent).toBe(0)
  expect(node.lastReceived).toBe(0)
})

it('supports connection before initializing', async () => {
  let log = TestTime.getLog()

  let returnLastAdded
  log.store.getLastAdded = () => new Promise(resolve => {
    returnLastAdded = resolve
  })

  let pair = new TestPair()
  node = new ServerNode('server', log, pair.left, { timeout: 50, ping: 50 })

  await pair.right.connect()
  pair.right.send(['connect', node.localProtocol, 'client', 0])
  await delay(70)
  expect(pair.leftSent).toEqual([])
  returnLastAdded(10)
  await delay(70)
  expect(node.connected).toBeTruthy()
  expect(pair.leftSent).toHaveLength(2)
  expect(pair.leftSent[0][0]).toEqual('connected')
  expect(pair.leftSent[1]).toEqual(['ping', 10])
})
