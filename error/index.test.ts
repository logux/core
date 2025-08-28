import { deepStrictEqual, equal, throws } from 'node:assert'
import { afterEach, test } from 'node:test'

import {
  LoguxError,
  ServerNode,
  type TestLog,
  TestPair,
  TestTime
} from '../index.js'

let node: ServerNode<object, TestLog>

afterEach(() => {
  node.destroy()
})

function privateMethods(obj: object): any {
  return obj
}

function createNode(): ServerNode<object, TestLog> {
  let pair = new TestPair()
  return new ServerNode('server', TestTime.getLog(), pair.left)
}

async function createTest(): Promise<TestPair> {
  let pair = new TestPair()
  node = new ServerNode('server', TestTime.getLog(), pair.left)
  pair.leftNode = node
  await pair.left.connect()
  return pair
}

test('sends error on wrong message format', async () => {
  let wrongs = [1, { hi: 1 }, [], [1]]
  await Promise.all(
    wrongs.map(async msg => {
      let pair = await createTest()
      // @ts-expect-error
      pair.right.send(msg)
      await pair.wait('right')
      equal(pair.left.connected, false)
      deepStrictEqual(pair.leftSent, [
        ['error', 'wrong-format', JSON.stringify(msg)]
      ])
    })
  )
})

test('sends error on wrong error parameters', async () => {
  let wrongs = [['error'], ['error', 1], ['error', {}]]
  await Promise.all(
    wrongs.map(async msg => {
      let pair = await createTest()
      // @ts-expect-error
      pair.right.send(msg)
      await pair.wait('right')
      equal(pair.left.connected, false)
      deepStrictEqual(pair.leftSent, [
        ['error', 'wrong-format', JSON.stringify(msg)]
      ])
    })
  )
})

test('sends error on unknown message type', async () => {
  let pair = await createTest()
  // @ts-expect-error
  pair.right.send(['test'])
  await pair.wait('right')
  equal(pair.left.connected, false)
  deepStrictEqual(pair.leftSent, [['error', 'unknown-message', 'test']])
})

test('throws a error on error message by default', () => {
  node = createNode()
  throws(
    () => {
      privateMethods(node).onMessage(['error', 'wrong-format', '1'])
    },
    new LoguxError('wrong-format', '1', true)
  )
})

test('does not throw errors which are not relevant to code', () => {
  node = createNode()
  privateMethods(node).onMessage(['error', 'timeout', '1'])
  privateMethods(node).onMessage(['error', 'wrong-protocol', {}])
  privateMethods(node).onMessage(['error', 'wrong-subprotocol', {}])
})

test('disables throwing a error on listener', () => {
  node = createNode()

  let errors: Error[] = []
  node.catch(error => {
    errors.push(error)
  })

  privateMethods(node).onMessage(['error', 'wrong-format', '2'])
  deepStrictEqual(errors, [new LoguxError('wrong-format', '2', true)])
})

test('emits a event on error sending', async () => {
  let pair = await createTest()
  let errors: Error[] = []
  pair.leftNode.on('clientError', err => {
    errors.push(err)
  })

  let error = new LoguxError('timeout', 10)
  privateMethods(pair.leftNode).sendError(error)
  deepStrictEqual(errors, [error])
})
