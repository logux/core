import { delay } from 'nanodelay'
import { spyOn } from 'nanospy'
import { deepStrictEqual, equal } from 'node:assert'
import { afterEach, test } from 'node:test'

import { ClientNode, TestPair, TestTime } from '../index.js'

let node: ClientNode
afterEach(() => {
  node.destroy()
})

function privateMethods(obj: object): any {
  return obj
}

test('connects first', async () => {
  let pair = new TestPair()
  node = new ClientNode('client', TestTime.getLog(), pair.left)
  let sendConnect = spyOn(privateMethods(node), 'sendConnect')
  await pair.left.connect()
  equal(sendConnect.callCount, 1)
})

test('saves last added from ping', async () => {
  let log = TestTime.getLog()
  let pair = new TestPair()
  node = new ClientNode('client', log, pair.left, { fixTime: false })
  await pair.left.connect()
  pair.right.send(['connected', node.localProtocol, 'server', [0, 0]])
  await pair.wait()
  equal(node.lastReceived, 0)
  pair.right.send(['ping', 1])
  await pair.wait('right')
  equal(node.lastReceived, 1)
  privateMethods(node).sendPing()
  pair.right.send(['pong', 2])
  await pair.wait('left')
  equal(node.lastReceived, 2)
})

test('does not connect before initializing', async () => {
  let log = TestTime.getLog()

  let returnLastAdded: (added: number) => void = () => {
    throw new Error('getLastAdded was not called')
  }
  log.store.getLastAdded = () => {
    return new Promise(resolve => {
      returnLastAdded = resolve
    })
  }

  let pair = new TestPair()
  node = new ClientNode('client', log, pair.left, { fixTime: false })

  await pair.left.connect()
  await delay(10)
  deepStrictEqual(pair.leftSent, [])
  returnLastAdded(10)
  await delay(10)
  deepStrictEqual(pair.leftSent, [['connect', node.localProtocol, 'client', 0]])
})
