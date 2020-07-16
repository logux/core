import { TestPair, Message } from '../index.js'

it('tracks events', async () => {
  let pair = new TestPair()
  expect(pair.leftEvents).toEqual([])
  expect(pair.rightEvents).toEqual([])

  pair.left.connect()
  await pair.wait()
  expect(pair.leftEvents).toEqual([['connect']])
  expect(pair.rightEvents).toEqual([['connect']])

  pair.left.send(['ping', 1])
  expect(pair.rightEvents).toEqual([['connect']])

  await pair.wait()
  expect(pair.rightEvents).toEqual([['connect'], ['message', ['ping', 1]]])

  pair.left.disconnect('timeout')
  expect(pair.leftEvents).toEqual([['connect'], ['disconnect', 'timeout']])
  expect(pair.rightEvents).toEqual([['connect'], ['message', ['ping', 1]]])
  await pair.wait()
  expect(pair.rightEvents).toEqual([
    ['connect'],
    ['message', ['ping', 1]],
    ['disconnect']
  ])

  pair.right.connect()
  await pair.wait()
  expect(pair.rightEvents).toEqual([
    ['connect'],
    ['message', ['ping', 1]],
    ['disconnect'],
    ['connect']
  ])
})

it('tracks messages', async () => {
  let pair = new TestPair()
  await pair.left.connect()
  pair.right.send(['ping', 1])
  expect(pair.rightSent).toEqual([])
  expect(pair.leftSent).toEqual([])
  await pair.wait()
  expect(pair.rightSent).toEqual([['ping', 1]])
  pair.left.send(['pong', 1])
  expect(pair.leftSent).toEqual([])
  await pair.wait()
  expect(pair.leftSent).toEqual([['pong', 1]])
  expect(pair.rightSent).toEqual([['ping', 1]])
})

it('clears tracked data', async () => {
  let pair = new TestPair()
  await pair.left.connect()
  pair.left.send(['ping', 1])
  await pair.wait()
  pair.clear()
  expect(pair.leftSent).toEqual([])
  expect(pair.rightSent).toEqual([])
  expect(pair.leftEvents).toEqual([])
  expect(pair.rightEvents).toEqual([])
})

it('clones messages', async () => {
  let pair = new TestPair()
  let msg: Message = ['ping', 1]
  await pair.left.connect()
  pair.left.send(msg)
  await pair.wait()
  msg[1] = 2
  expect(pair.leftSent).toEqual([['ping', 1]])
  expect(pair.rightEvents).toEqual([['connect'], ['message', ['ping', 1]]])
})

it('returns self in wait()', async () => {
  let pair = new TestPair()
  await pair.left.connect()
  pair.left.send(['ping', 1])
  let test = await pair.wait()
  expect(test).toBe(pair)
})

it('filters events in wait()', async () => {
  let pair = new TestPair()
  await pair.left.connect()
  pair.left.send(['ping', 1])
  setTimeout(() => {
    pair.right.send(['pong', 1])
  }, 1)
  await pair.wait()
  expect(pair.rightSent).toEqual([])
  await pair.wait()
  expect(pair.rightSent).toEqual([['pong', 1]])
  pair.left.send(['ping', 2])
  setTimeout(() => {
    pair.right.send(['pong', 2])
  }, 1)
  await pair.wait('left')
  expect(pair.rightSent).toEqual([
    ['pong', 1],
    ['pong', 2]
  ])
})

it('passes delay', () => {
  let pair = new TestPair(50)
  expect(pair.delay).toEqual(50)
})
