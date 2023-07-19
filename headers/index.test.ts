import { test } from 'uvu'
import { equal, is } from 'uvu/assert'

import { ServerNode, type TestLog, TestPair, TestTime } from '../index.js'

let node: ServerNode<{}, TestLog>

test.after.each(() => {
  node.destroy()
})

function privateMethods(obj: object): any {
  return obj
}

async function createTestPair(): Promise<TestPair> {
  let pair = new TestPair()
  node = new ServerNode<{}, TestLog>('server', TestTime.getLog(), pair.left)
  pair.leftNode = node
  await pair.left.connect()

  return pair
}

test('emits a headers on header messages', async () => {
  let pair = await createTestPair()

  let headers = {}
  pair.leftNode.on('headers', data => {
    headers = data
  })

  privateMethods(pair.leftNode).onMessage(['headers', { test: 'test' }])

  equal(headers, { test: 'test' })
})

test('checks types', async () => {
  let wrongs = [
    ['headers'],
    ['headers', true],
    ['headers', 0],
    ['headers', []],
    ['headers', 'abc'],
    ['headers', {}, 'abc']
  ]
  await Promise.all(
    wrongs.map(async msg => {
      let pair = await createTestPair()
      // @ts-expect-error
      pair.right.send(msg)
      await pair.wait('right')
      is(pair.leftNode.connected, false)
      equal(pair.leftSent, [['error', 'wrong-format', JSON.stringify(msg)]])
      pair.leftNode.destroy()
    })
  )
})

test.run()
