import { test } from 'uvu'
import { equal, is } from 'uvu/assert'

import type { Message } from '../index.js';
import { TestPair } from '../index.js'

test('tracks events', async () => {
  let pair = new TestPair()
  equal(pair.leftEvents, [])
  equal(pair.rightEvents, [])

  pair.left.connect()
  await pair.wait()
  equal(pair.leftEvents, [['connect']])
  equal(pair.rightEvents, [['connect']])

  pair.left.send(['ping', 1])
  equal(pair.rightEvents, [['connect']])

  await pair.wait()
  equal(pair.rightEvents, [['connect'], ['message', ['ping', 1]]])

  pair.left.disconnect('timeout')
  equal(pair.leftEvents, [['connect'], ['disconnect', 'timeout']])
  equal(pair.rightEvents, [['connect'], ['message', ['ping', 1]]])
  await pair.wait()
  equal(pair.rightEvents, [
    ['connect'],
    ['message', ['ping', 1]],
    ['disconnect']
  ])

  pair.right.connect()
  await pair.wait()
  equal(pair.rightEvents, [
    ['connect'],
    ['message', ['ping', 1]],
    ['disconnect'],
    ['connect']
  ])
})

test('tracks messages', async () => {
  let pair = new TestPair()
  await pair.left.connect()
  pair.right.send(['ping', 1])
  equal(pair.rightSent, [])
  equal(pair.leftSent, [])
  await pair.wait()
  equal(pair.rightSent, [['ping', 1]])
  pair.left.send(['pong', 1])
  equal(pair.leftSent, [])
  await pair.wait()
  equal(pair.leftSent, [['pong', 1]])
  equal(pair.rightSent, [['ping', 1]])
})

test('clears tracked data', async () => {
  let pair = new TestPair()
  await pair.left.connect()
  pair.left.send(['ping', 1])
  await pair.wait()
  pair.clear()
  equal(pair.leftSent, [])
  equal(pair.rightSent, [])
  equal(pair.leftEvents, [])
  equal(pair.rightEvents, [])
})

test('clones messages', async () => {
  let pair = new TestPair()
  let msg: Message = ['ping', 1]
  await pair.left.connect()
  pair.left.send(msg)
  await pair.wait()
  msg[1] = 2
  equal(pair.leftSent, [['ping', 1]])
  equal(pair.rightEvents, [['connect'], ['message', ['ping', 1]]])
})

test('returns self in wait()', async () => {
  let pair = new TestPair()
  await pair.left.connect()
  pair.left.send(['ping', 1])
  let testPair = await pair.wait()
  is(testPair, pair)
})

test('filters events in wait()', async () => {
  let pair = new TestPair()
  await pair.left.connect()
  pair.left.send(['ping', 1])
  setTimeout(() => {
    pair.right.send(['pong', 1])
  }, 1)
  await pair.wait()
  equal(pair.rightSent, [])
  await pair.wait()
  equal(pair.rightSent, [['pong', 1]])
  pair.left.send(['ping', 2])
  setTimeout(() => {
    pair.right.send(['pong', 2])
  }, 1)
  await pair.wait('left')
  equal(pair.rightSent, [
    ['pong', 1],
    ['pong', 2]
  ])
})

test('passes delay', () => {
  let pair = new TestPair(50)
  equal(pair.delay, 50)
})

test.run()
