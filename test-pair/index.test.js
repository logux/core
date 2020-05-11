let { TestPair } = require('..')

it('tracks events', async () => {
  let pair = new TestPair()
  expect(pair.leftEvents).toEqual([])
  expect(pair.rightEvents).toEqual([])

  pair.left.connect()
  await pair.wait()
  expect(pair.leftEvents).toEqual([['connect']])
  expect(pair.rightEvents).toEqual([['connect']])

  pair.left.send('test')
  expect(pair.rightEvents).toEqual([['connect']])

  await pair.wait()
  expect(pair.rightEvents).toEqual([['connect'], ['message', 'test']])

  pair.left.disconnect('timeout')
  expect(pair.leftEvents).toEqual([['connect'], ['disconnect', 'timeout']])
  expect(pair.rightEvents).toEqual([['connect'], ['message', 'test']])
  await pair.wait()
  expect(pair.rightEvents).toEqual([
    ['connect'],
    ['message', 'test'],
    ['disconnect']
  ])

  pair.right.connect()
  await pair.wait()
  expect(pair.rightEvents).toEqual([
    ['connect'],
    ['message', 'test'],
    ['disconnect'],
    ['connect']
  ])
})

it('tracks messages', async () => {
  let pair = new TestPair()
  await pair.left.connect()
  pair.right.send('a')
  expect(pair.rightSent).toEqual([])
  expect(pair.leftSent).toEqual([])
  await pair.wait()
  expect(pair.rightSent).toEqual(['a'])
  pair.left.send('b')
  expect(pair.leftSent).toEqual([])
  await pair.wait()
  expect(pair.leftSent).toEqual(['b'])
  expect(pair.rightSent).toEqual(['a'])
})

it('clears tracked data', async () => {
  let pair = new TestPair()
  await pair.left.connect()
  pair.left.send('a')
  await pair.wait()
  pair.clear()
  expect(pair.leftSent).toEqual([])
  expect(pair.rightSent).toEqual([])
  expect(pair.leftEvents).toEqual([])
  expect(pair.rightEvents).toEqual([])
})

it('clones messages', async () => {
  let pair = new TestPair()
  let msg = { list: [1] }
  await pair.left.connect()
  pair.left.send(msg)
  await pair.wait()
  msg.list[0] = 2
  expect(pair.leftSent).toEqual([{ list: [1] }])
  expect(pair.rightEvents).toEqual([['connect'], ['message', { list: [1] }]])
})

it('returns self in wait()', async () => {
  let pair = new TestPair()
  await pair.left.connect()
  pair.left.send('test')
  let test = await pair.wait()
  expect(test).toBe(pair)
})

it('filters events in wait()', async () => {
  let pair = new TestPair()
  await pair.left.connect()
  pair.left.send('left1')
  setTimeout(() => {
    pair.right.send('right1')
  }, 1)
  await pair.wait()
  expect(pair.rightSent).toEqual([])
  await pair.wait()
  expect(pair.rightSent).toEqual(['right1'])
  pair.left.send('left2')
  setTimeout(() => {
    pair.right.send('right2')
  }, 1)
  await pair.wait('left')
  expect(pair.rightSent).toEqual(['right1', 'right2'])
})

it('passes delay', () => {
  let pair = new TestPair(50)
  expect(pair.delay).toEqual(50)
})
