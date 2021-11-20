import { equal, is } from 'uvu/assert'
import { test } from 'uvu'

import { ServerNode, TestTime, TestPair, TestLog } from '../index.js'

let node: ServerNode<{}, TestLog>

async function createTest(): Promise<TestPair> {
  let pair = new TestPair()
  node = new ServerNode('server', TestTime.getLog(), pair.left)
  pair.leftNode = node
  await pair.left.connect()
  return pair
}

test.after.each(() => {
  node.destroy()
})

function privateMethods(obj: object): any {
  return obj
}

test('sends debug messages', async () => {
  let pair = await createTest()
  privateMethods(pair.leftNode).sendDebug('testType', 'testData')
  await pair.wait('right')
  equal(pair.leftSent, [['debug', 'testType', 'testData']])
})

test('emits a debug on debug error messages', () => {
  let pair = new TestPair()
  node = new ServerNode('server', TestTime.getLog(), pair.left)

  let debugs: [string, string][] = []
  node.on('debug', (type, data) => {
    debugs.push([type, data])
  })

  privateMethods(node).onMessage(['debug', 'error', 'testData'])

  equal(debugs, [['error', 'testData']])
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
      is(pair.leftNode.connected, false)
      equal(pair.leftSent, [['error', 'wrong-format', JSON.stringify(msg)]])
    })
  )
})

test.run()
