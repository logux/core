let ServerNode = require('../server-node')
let TestTime = require('../test-time')
let TestPair = require('../test-pair')

let node

async function createTest () {
  let test = new TestPair()
  node = new ServerNode('server', TestTime.getLog(), test.left)
  test.leftNode = node
  await test.left.connect()
  return test
}

afterEach(() => {
  node.destroy()
})

it('sends debug messages', async () => {
  let test = await createTest()
  test.leftNode.sendDebug('testType', 'testData')
  await test.wait('right')
  expect(test.leftSent).toEqual([['debug', 'testType', 'testData']])
})

it('emits a debug on debug error messages', () => {
  let pair = new TestPair()
  node = new ServerNode('server', TestTime.getLog(), pair.left)

  let debugs = []
  node.on('debug', (type, data) => {
    debugs.push(type, data)
  })

  node.onMessage(['debug', 'error', 'testData'])

  expect(debugs).toEqual(['error', 'testData'])
})

it('checks types', async () => {
  let wrongs = [
    ['debug'],
    ['debug', 0],
    ['debug', []],
    ['debug', {}, 'abc'],
    ['debug', 'error', 0],
    ['debug', 'error', []],
    ['debug', 'error', {}]
  ]
  await Promise.all(wrongs.map(async command => {
    let test = await createTest()
    test.right.send(command)
    await test.wait('right')
    expect(test.leftNode.connected).toBe(false)
    expect(test.leftSent).toEqual([
      ['error', 'wrong-format', JSON.stringify(command)]
    ])
  }))
})
