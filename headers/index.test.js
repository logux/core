let { ServerNode, TestTime, TestPair } = require('..')

let node

afterEach(() => {
  if (node) {
    node.destroy()
    node = undefined
  }
})

async function createTestPair () {
  let pair = new TestPair()
  node = new ServerNode('server', TestTime.getLog(), pair.left)
  pair.leftNode = node
  await pair.left.connect()

  return pair
}

it('emits a headers on header messages', async () => {
  let test = await createTestPair()

  let headers = {}
  test.leftNode.on('headers', data => {
    headers = data
  })

  test.leftNode.onMessage(['headers', { test: 'test' }])

  expect(headers).toEqual({ test: 'test' })
})

it('checks types', async () => {
  let wrongs = [
    ['headers'],
    ['headers', true],
    ['headers', 0],
    ['headers', []],
    ['headers', 'abc'],
    ['headers', {}, 'abc']
  ]
  await Promise.all(
    wrongs.map(async command => {
      let test = await createTestPair()
      test.right.send(command)
      await test.wait('right')
      expect(test.leftNode.connected).toBe(false)
      expect(test.leftSent).toEqual([
        ['error', 'wrong-format', JSON.stringify(command)]
      ])
      node.destroy()
    })
  )
})
