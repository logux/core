import { deepStrictEqual, equal, ok } from 'node:assert'
import { test } from 'node:test'

import type { Message } from '../index.js'
import { TestPair } from '../index.js'

test('tracks events', async () => {
  let pair = new TestPair()
  deepStrictEqual(pair.leftEvents, [])
  deepStrictEqual(pair.rightEvents, [])

  pair.left.connect()
  await pair.wait()
  deepStrictEqual(pair.leftEvents, [['connect']])
  deepStrictEqual(pair.rightEvents, [['connect']])

  pair.left.send(['ping', 1])
  deepStrictEqual(pair.rightEvents, [['connect']])

  await pair.wait()
  deepStrictEqual(pair.rightEvents, [['connect'], ['message', ['ping', 1]]])

  pair.left.disconnect('timeout')
  deepStrictEqual(pair.leftEvents, [['connect'], ['disconnect', 'timeout']])
  deepStrictEqual(pair.rightEvents, [['connect'], ['message', ['ping', 1]]])
  await pair.wait()
  deepStrictEqual(pair.rightEvents, [
    ['connect'],
    ['message', ['ping', 1]],
    ['disconnect']
  ])

  pair.right.connect()
  await pair.wait()
  deepStrictEqual(pair.rightEvents, [
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
  deepStrictEqual(pair.rightSent, [])
  deepStrictEqual(pair.leftSent, [])
  await pair.wait()
  deepStrictEqual(pair.rightSent, [['ping', 1]])
  pair.left.send(['pong', 1])
  deepStrictEqual(pair.leftSent, [])
  await pair.wait()
  deepStrictEqual(pair.leftSent, [['pong', 1]])
  deepStrictEqual(pair.rightSent, [['ping', 1]])
})

test('clears tracked data', async () => {
  let pair = new TestPair()
  await pair.left.connect()
  pair.left.send(['ping', 1])
  await pair.wait()
  pair.clear()
  deepStrictEqual(pair.leftSent, [])
  deepStrictEqual(pair.rightSent, [])
  deepStrictEqual(pair.leftEvents, [])
  deepStrictEqual(pair.rightEvents, [])
})

test('clones messages', async () => {
  let pair = new TestPair()
  let msg: Message = ['ping', 1]
  await pair.left.connect()
  pair.left.send(msg)
  await pair.wait()
  msg[1] = 2
  deepStrictEqual(pair.leftSent, [['ping', 1]])
  deepStrictEqual(pair.rightEvents, [['connect'], ['message', ['ping', 1]]])
})

test('clones binary bytes in actions', async () => {
  let pair = new TestPair()
  let action = {
    compressed: true,
    d: new Uint8Array([1, 2, 3]),
    iv: new Uint8Array([4, 5, 6]),
    type: '0'
  }
  let msg: Message = ['sync', 1, action, { id: '0', time: 1 }]
  await pair.left.connect()
  pair.left.send(msg)
  await pair.wait()

  action.d[0] = 9
  action.iv[0] = 9

  let sent = pair.leftSent[0] as [string, number, typeof action, object]
  ok(sent[2].d instanceof Uint8Array)
  ok(sent[2].iv instanceof Uint8Array)
  deepStrictEqual(sent[2].d, new Uint8Array([1, 2, 3]))
  deepStrictEqual(sent[2].iv, new Uint8Array([4, 5, 6]))
})

test('returns self in wait()', async () => {
  let pair = new TestPair()
  await pair.left.connect()
  pair.left.send(['ping', 1])
  let testPair = await pair.wait()
  equal(testPair, pair)
})

test('filters events in wait()', async () => {
  let pair = new TestPair()
  await pair.left.connect()
  pair.left.send(['ping', 1])
  setTimeout(() => {
    pair.right.send(['pong', 1])
  }, 1)
  await pair.wait()
  deepStrictEqual(pair.rightSent, [])
  await pair.wait()
  deepStrictEqual(pair.rightSent, [['pong', 1]])
  pair.left.send(['ping', 2])
  setTimeout(() => {
    pair.right.send(['pong', 2])
  }, 1)
  await pair.wait('left')
  deepStrictEqual(pair.rightSent, [
    ['pong', 1],
    ['pong', 2]
  ])
})

test('passes delay', () => {
  let pair = new TestPair(50)
  equal(pair.delay, 50)
})
