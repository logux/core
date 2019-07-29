let delay = require('nanodelay')

let ServerNode = require('../server-node')
let ClientNode = require('../client-node')
let TestTime = require('../test-time')
let TestPair = require('../test-pair')

let node

async function createTest (opts) {
  let log = TestTime.getLog()
  let test = new TestPair()
  await log.add({ type: 'test' }, { reasons: ['test'] })
  log.store.lastSent = 1
  node = new ClientNode('client', log, test.left, opts)
  test.leftNode = node
  await test.left.connect()
  await test.wait()
  let protocol = test.leftNode.localProtocol
  test.right.send(['connected', protocol, 'server', [0, 0]])
  test.clear()
  return test
}

afterEach(() => {
  if (node) {
    node.destroy()
    node = undefined
  }
})

it('throws on ping and no timeout options', () => {
  expect(() => {
    new ClientNode('client', null, null, { ping: 1000, timeout: 0 })
  }).toThrowError(/set timeout option/)
})

it('answers pong on ping', async () => {
  let test = await createTest({ fixTime: false })
  test.right.send(['ping', 1])
  await test.wait('right')
  expect(test.leftSent).toEqual([['pong', 1]])
})

it('sends ping on idle connection', async () => {
  let error
  let test = await createTest({
    ping: 300,
    timeout: 100,
    fixTime: false
  })
  test.leftNode.catch(err => {
    error = err
  })
  await delay(250)
  test.right.send(['duilian', ''])
  await delay(250)
  test.leftNode.send(['duilian', ''])
  await delay(250)
  expect(error).toBeUndefined()
  expect(test.leftSent).toEqual([['duilian', '']])
  await delay(100)
  expect(error).toBeUndefined()
  expect(test.leftSent).toEqual([['duilian', ''], ['ping', 1]])
  test.right.send(['pong', 1])
  await delay(250)
  expect(error).toBeUndefined()
  expect(test.leftSent).toEqual([['duilian', ''], ['ping', 1]])
  await delay(100)
  expect(error).toBeUndefined()
  expect(test.leftSent).toEqual([['duilian', ''], ['ping', 1], ['ping', 1]])
  await delay(250)
  expect(error.message).toContain('timeout')
  expect(test.leftSent).toEqual([['duilian', ''], ['ping', 1], ['ping', 1]])
  expect(test.leftEvents[3]).toEqual(['disconnect', 'timeout'])
})

it('does not ping before authentication', async () => {
  let log = TestTime.getLog()
  let test = new TestPair()
  test.leftNode = new ClientNode('client', log, test.left, {
    ping: 100,
    timeout: 300,
    fixTime: false
  })
  test.leftNode.catch(() => true)
  await test.left.connect()
  await test.wait()
  test.clear()
  await delay(250)
  expect(test.leftSent).toEqual([])
})

it('sends only one ping if timeout is bigger than ping', async () => {
  let test = await createTest({
    ping: 100,
    timeout: 300,
    fixTime: false
  })
  await delay(250)
  expect(test.leftSent).toEqual([['ping', 1]])
})

it('checks types', async () => {
  let wrongs = [
    ['ping'],
    ['ping', 'abc'],
    ['ping', []],
    ['pong'],
    ['pong', 'abc'],
    ['pong', {}]
  ]
  await Promise.all(wrongs.map(async command => {
    let test = new TestPair()
    let log = TestTime.getLog()
    test.leftNode = new ServerNode('server', log, test.left)
    await test.left.connect()
    test.right.send(command)
    await test.wait('right')
    expect(test.leftNode.connected).toBeFalsy()
    expect(test.leftSent).toEqual([
      ['error', 'wrong-format', JSON.stringify(command)]
    ])
  }))
})
