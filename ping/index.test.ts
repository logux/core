import { delay } from 'nanodelay'
import { deepStrictEqual, equal, ok, throws } from 'node:assert'
import { afterEach, test } from 'node:test'

import {
  type BaseNode,
  ClientNode,
  type NodeOptions,
  ServerNode,
  type TestLog,
  TestPair,
  TestTime
} from '../index.js'

let node: BaseNode<object, TestLog> | undefined

afterEach(() => {
  node?.destroy()
})

function privateMethods(obj: object): any {
  return obj
}

async function createTest(opts: NodeOptions): Promise<TestPair> {
  let log = TestTime.getLog()
  let pair = new TestPair()
  await log.add({ type: 'test' }, { reasons: ['test'] })
  privateMethods(log.store).lastSent = 1
  node = new ClientNode('client', log, pair.left, opts)
  pair.leftNode = node
  await pair.left.connect()
  await pair.wait()
  let protocol = pair.leftNode.localProtocol
  pair.right.send(['connected', protocol, 'server', [0, 0]])
  pair.clear()
  return pair
}

test('throws on ping and no timeout options', () => {
  let pair = new TestPair()
  let log = TestTime.getLog()
  throws(() => {
    new ClientNode('client', log, pair.left, { ping: 1000, timeout: 0 })
  }, /set timeout option/)
})

test('answers pong on ping', async () => {
  let pair = await createTest({ fixTime: false })
  pair.right.send(['ping', 1])
  await pair.wait('right')
  deepStrictEqual(pair.leftSent, [['pong', 1]])
})

test('sends ping on idle connection', async () => {
  let error: Error | undefined
  let pair = await createTest({
    fixTime: false,
    ping: 300,
    timeout: 100
  })
  pair.leftNode.catch(err => {
    error = err
  })
  await delay(250)
  privateMethods(pair.right).send(['duilian', ''])
  await delay(250)
  privateMethods(pair.leftNode).send(['duilian', ''])
  await delay(250)
  equal(typeof error, 'undefined')
  deepStrictEqual(pair.leftSent, [['duilian', '']])
  await delay(100)
  equal(typeof error, 'undefined')
  deepStrictEqual(pair.leftSent, [
    ['duilian', ''],
    ['ping', 1]
  ])
  pair.right.send(['pong', 1])
  await delay(250)
  equal(typeof error, 'undefined')
  deepStrictEqual(pair.leftSent, [
    ['duilian', ''],
    ['ping', 1]
  ])
  await delay(100)
  equal(typeof error, 'undefined')
  deepStrictEqual(pair.leftSent, [
    ['duilian', ''],
    ['ping', 1],
    ['ping', 1]
  ])
  await delay(250)
  if (typeof error === 'undefined') throw new Error('Error was not sent')
  ok(error.message.includes('timeout'))
  deepStrictEqual(pair.leftSent, [
    ['duilian', ''],
    ['ping', 1],
    ['ping', 1]
  ])
  deepStrictEqual(pair.leftEvents[3], ['disconnect', 'timeout'])
})

test('does not ping before authentication', async () => {
  let log = TestTime.getLog()
  let pair = new TestPair()
  pair.leftNode = new ClientNode('client', log, pair.left, {
    fixTime: false,
    ping: 100,
    timeout: 300
  })
  pair.leftNode.catch(() => true)
  await pair.left.connect()
  await pair.wait()
  pair.clear()
  await delay(250)
  deepStrictEqual(pair.leftSent, [])
})

test('sends only one ping if timeout is bigger than ping', async () => {
  let pair = await createTest({
    fixTime: false,
    ping: 100,
    timeout: 300
  })
  await delay(250)
  deepStrictEqual(pair.leftSent, [['ping', 1]])
})

test('do not try clear timeout if it does not set', async () => {
  let pair = await createTest({
    ping: undefined
  })
  await delay(250)
  privateMethods(pair.leftNode).sendPing()
  deepStrictEqual(pair.leftSent, [])
})

test('do not send ping if not connected', async () => {
  let pair = await createTest({ fixTime: false })
  pair.right.send(['ping', 1])
  pair.left.disconnect()
  await pair.wait('right')
  deepStrictEqual(pair.leftSent, [])
})

test('checks types', async () => {
  let wrongs = [
    ['ping'],
    ['ping', 'abc'],
    ['ping', []],
    ['pong'],
    ['pong', 'abc'],
    ['pong', {}]
  ]
  await Promise.all(
    wrongs.map(async msg => {
      let pair = new TestPair()
      let log = TestTime.getLog()
      pair.leftNode = new ServerNode('server', log, pair.left)
      await pair.left.connect()
      // @ts-expect-error
      pair.right.send(msg)
      await pair.wait('right')
      equal(pair.leftNode.connected, false)
      deepStrictEqual(pair.leftSent, [
        ['error', 'wrong-format', JSON.stringify(msg)]
      ])
    })
  )
})
