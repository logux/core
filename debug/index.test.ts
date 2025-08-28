import { deepStrictEqual, equal } from 'node:assert'
import { afterEach, test } from 'node:test'

import { ServerNode, type TestLog, TestPair, TestTime } from '../index.js'

let node: ServerNode<object, TestLog>

async function createTest(): Promise<TestPair> {
  let pair = new TestPair()
  node = new ServerNode('server', TestTime.getLog(), pair.left)
  pair.leftNode = node
  await pair.left.connect()
  return pair
}

afterEach(() => {
  node.destroy()
})

function privateMethods(obj: object): any {
  return obj
}

test('sends debug messages', async () => {
  let pair = await createTest()
  privateMethods(pair.leftNode).sendDebug('testType', 'testData')
  await pair.wait('right')
  deepStrictEqual(pair.leftSent, [['debug', 'testType', 'testData']])
})

test('emits a debug on debug error messages', () => {
  let pair = new TestPair()
  node = new ServerNode('server', TestTime.getLog(), pair.left)

  let debugs: [string, string][] = []
  node.on('debug', (type, data) => {
    debugs.push([type, data])
  })

  privateMethods(node).onMessage(['debug', 'error', 'testData'])

  deepStrictEqual(debugs, [['error', 'testData']])
})

test('checks types', async () => {
  let wrongs = [
    ['debug'],
    ['debug', 0],
    ['debug', []],
    ['debug', {}, 'abc'],
    ['debug', 'error', 0],
    ['debug', 'error', []],
    ['debug', 'error', {}]
  ]
  await Promise.all(
    wrongs.map(async msg => {
      let pair = await createTest()
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
