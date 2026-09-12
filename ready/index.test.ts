import { deepStrictEqual, equal } from 'node:assert'
import { afterEach, test } from 'node:test'
import { setTimeout } from 'node:timers/promises'

import {
  type BaseNode,
  ClientNode,
  type NodeOptions,
  ServerNode,
  type TestLog,
  TestPair,
  TestTime
} from '../index.js'

let destroyable: TestPair

afterEach(() => {
  destroyable.leftNode.destroy()
  destroyable.rightNode.destroy()
})

function privateMethods(obj: object): any {
  return obj
}

function whenReady(node: BaseNode<object, TestLog>): Promise<void> {
  if (node.remoteReady) return Promise.resolve()
  return new Promise(resolve => {
    node.on('ready', resolve)
  })
}

function types(messages: any[]): string[] {
  return messages.map(i => i[0])
}

function createPair(opts: NodeOptions = {}): TestPair {
  let time = new TestTime()
  let log1 = time.nextLog()
  let log2 = time.nextLog()
  let pair = new TestPair()

  destroyable = pair

  log1.on('preadd', (action, meta) => {
    meta.reasons = ['t']
  })
  log2.on('preadd', (action, meta) => {
    meta.reasons = ['t']
  })

  pair.leftNode = new ClientNode('client', log1, pair.left, {
    fixTime: false,
    ...opts
  })
  pair.rightNode = new ServerNode('server', log2, pair.right)

  return pair
}

test('sends ready after the initial synchronization', async () => {
  let pair = createPair()
  await pair.leftNode.log.add({ type: 'a' })

  pair.left.connect()
  await whenReady(pair.leftNode)
  await whenReady(pair.rightNode)

  await pair.leftNode.waitFor('synchronized')

  deepStrictEqual(types(pair.leftSent), ['connect', 'sync', 'ready'])
  deepStrictEqual(pair.leftSent[2], ['ready', 1])
  deepStrictEqual(types(pair.rightSent), ['connected', 'ready', 'synced'])
  deepStrictEqual(pair.rightSent[1], ['ready', 0])
})

test('sends ready without actions to synchronize', async () => {
  let pair = createPair()

  pair.left.connect()
  await whenReady(pair.leftNode)

  deepStrictEqual(pair.rightSent, [
    ['connected', pair.rightNode.localProtocol, 'server', [1, 2]],
    ['ready', 0]
  ])
  equal(pair.leftNode.state, 'synchronized')
})

test('reports the biggest examined added, not the biggest sent', async () => {
  let pair = createPair()
  pair.rightNode.options.onSend = async (action, meta) => {
    return action.type === 'b' ? false : [action, meta]
  }
  await pair.rightNode.log.add({ type: 'a' })
  await pair.rightNode.log.add({ type: 'b' })

  pair.left.connect()
  await whenReady(pair.leftNode)

  deepStrictEqual(types(pair.rightSent), ['connected', 'sync', 'ready'])
  deepStrictEqual(pair.rightSent[1]!.slice(0, 2), ['sync', 1])
  deepStrictEqual(pair.rightSent[2], ['ready', 2])
  equal(pair.leftNode.lastReceived, 2)

  let synced = await pair.leftNode.log.store.getLastSynced()
  equal(synced.received, 2)
})

test('counts the actions added before the authentication', async () => {
  let pair = createPair()
  await pair.rightNode.initializing
  await pair.rightNode.log.add({ type: 'a' })

  pair.left.connect()
  await whenReady(pair.leftNode)

  deepStrictEqual(pair.rightSent.at(-1), ['ready', 1])
})

test('waits for ready option', async () => {
  let finish = (): void => {}
  let pair = createPair({
    ready: () =>
      new Promise<void>(resolve => {
        finish = resolve
      })
  })

  pair.left.connect()
  await pair.wait('right')
  await setTimeout(10)
  deepStrictEqual(types(pair.leftSent), ['connect'])
  equal(pair.rightNode.remoteReady, false)

  finish()
  await whenReady(pair.rightNode)
  deepStrictEqual(types(pair.leftSent), ['connect', 'ready'])
})

test('sends ready after the messages from a slow onSend', async () => {
  let pair = createPair({
    onSend: async (action, meta) => {
      await setTimeout(10)
      return [action, meta]
    },
    ready: () => setTimeout(5)
  })

  pair.left.connect()
  await pair.wait('right')
  await pair.leftNode.log.add({ type: 'a' })
  await whenReady(pair.rightNode)

  deepStrictEqual(types(pair.leftSent), ['connect', 'sync', 'ready'])
})

test('reports an error from ready option', async () => {
  let error = new Error('test')
  let pair = createPair({
    ready: () => Promise.reject(error)
  })
  let caught = new Promise(resolve => {
    pair.leftNode.catch(resolve)
  })

  pair.left.connect()

  equal(await caught, error)
  deepStrictEqual(types(pair.leftSent), ['connect'])
})

test('is not synchronized until remote node is ready', async () => {
  let finish = (): void => {}
  let pair = createPair()
  pair.rightNode.options.ready = () =>
    new Promise<void>(resolve => {
      finish = resolve
    })

  let states: string[] = []
  pair.leftNode.on('state', () => {
    states.push(pair.leftNode.state)
  })

  pair.left.connect()
  await pair.wait('left')
  await setTimeout(10)

  deepStrictEqual(states, ['connecting'])
  equal(pair.leftNode.remoteReady, false)

  finish()
  await pair.leftNode.waitFor('synchronized')
  deepStrictEqual(states, ['connecting', 'synchronized'])
})

test('stays in sending until the actions are confirmed', async () => {
  let pair = createPair()
  await pair.leftNode.log.add({ type: 'a' })

  pair.left.connect()
  await whenReady(pair.leftNode)

  equal(pair.leftNode.remoteReady, true)
  equal(pair.leftNode.state, 'sending')

  await pair.leftNode.waitFor('synchronized')
})

test('emits ready only after the actions are in the log', async () => {
  let pair = createPair({
    onReceive: async (action, meta) => {
      await setTimeout(10)
      return [action, meta]
    }
  })
  await pair.rightNode.log.add({ type: 'a' })

  let actions: object[] = []
  pair.leftNode.on('ready', () => {
    actions = pair.leftNode.log.actions()
  })

  pair.left.connect()
  await whenReady(pair.leftNode)

  deepStrictEqual(actions, [{ type: 'a' }])
})

test('emits ready event only once', async () => {
  let pair = createPair()

  pair.left.connect()
  await whenReady(pair.leftNode)

  let fired = 0
  pair.leftNode.on('ready', () => {
    fired += 1
  })
  pair.right.send(['ready', 10])
  await pair.wait('left')
  await setTimeout(10)

  equal(fired, 0)
  equal(pair.leftNode.remoteReady, true)
})

test('ignores the smaller added in ready message', async () => {
  let pair = createPair()
  await pair.rightNode.log.add({ type: 'a' })
  await pair.rightNode.log.add({ type: 'b' })

  pair.left.connect()
  await whenReady(pair.leftNode)
  equal(pair.leftNode.lastReceived, 2)

  pair.right.send(['ready', 1])
  await pair.wait('left')
  await setTimeout(10)

  equal(pair.leftNode.lastReceived, 2)
})

test('resets ready state on disconnect', async () => {
  let pair = createPair()

  pair.left.connect()
  await whenReady(pair.leftNode)
  equal(pair.leftNode.remoteReady, true)

  pair.left.disconnect()
  await pair.leftNode.waitFor('disconnected')

  equal(pair.leftNode.remoteReady, false)
  equal(privateMethods(pair.leftNode).readySent, false)
})

test('checks ready types', async () => {
  let wrongs = [['ready'], ['ready', 'abc'], ['ready', 1, {}]]
  await Promise.all(
    wrongs.map(async msg => {
      let pair = new TestPair()
      let log = TestTime.getLog()
      let node = new ServerNode('server', log, pair.left)
      await pair.left.connect()
      // @ts-expect-error
      pair.right.send(msg)
      await pair.wait('right')
      equal(node.connected, false)
      deepStrictEqual(pair.leftSent, [
        ['error', 'wrong-format', JSON.stringify(msg)]
      ])
      node.destroy()
    })
  )
})
