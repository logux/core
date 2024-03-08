import { delay } from 'nanodelay'
import { spyOn } from 'nanospy'
import { deepStrictEqual, doesNotThrow, equal, ok, throws } from 'node:assert'
import { test } from 'node:test'

import {
  BaseNode,
  type NodeOptions,
  type NodeState,
  type TestLog,
  TestPair,
  TestTime
} from '../index.js'

function createNode(
  opts?: NodeOptions,
  pair = new TestPair()
): BaseNode<{}, TestLog> {
  let log = TestTime.getLog()
  log.on('preadd', (action, meta) => {
    meta.reasons = ['test']
  })
  return new BaseNode('client', log, pair.left, opts)
}

async function createTest(): Promise<TestPair> {
  let pair = new TestPair()
  let node = createNode({}, pair)
  pair.leftNode = node
  await pair.left.connect()
  return pair
}

function privateMethods(obj: object): any {
  return obj
}

function emit(obj: any, event: string, ...args: any): void {
  obj.emitter.emit(event, ...args)
}

function listeners(obj: any): number {
  let count = 0
  for (let i in obj.emitter.events) {
    count += obj.emitter.events[i]?.length ?? 0
  }
  return count
}

test('saves all arguments', () => {
  let log = TestTime.getLog()
  let pair = new TestPair()
  let options = {}
  let node = new BaseNode('client', log, pair.left, options)

  equal(node.localNodeId, 'client')
  equal(node.log, log)
  equal(node.connection, pair.left)
  equal(node.options, options)
})

test('allows to miss options', () => {
  deepStrictEqual(createNode().options, {})
})

test('has protocol version', () => {
  let node = createNode()
  equal(typeof node.localProtocol, 'number')
  equal(typeof node.minProtocol, 'number')
  ok(node.localProtocol >= node.minProtocol)
})

test('unbind all listeners on destroy', () => {
  let pair = new TestPair()
  let conListenersBefore = listeners(pair.left)
  let node = new BaseNode('client', TestTime.getLog(), pair.left)

  ok(listeners(node.log) > 0)
  ok(listeners(pair.left) > conListenersBefore)

  node.destroy()
  equal(listeners(node.log), 0)
  equal(listeners(pair.left), conListenersBefore)
})

test('destroys connection on destroy', () => {
  let node = createNode()
  node.connection.destroy = () => {}
  let disconnect = spyOn(node.connection, 'disconnect')
  let destroy = spyOn(node.connection, 'destroy')

  node.destroy()
  deepStrictEqual(disconnect.calls, [])
  equal(destroy.callCount, 1)
})

test('disconnects on destroy', async () => {
  let node = createNode()
  await node.connection.connect()
  node.destroy()
  equal(node.connection.connected, false)
})

test('does not throw error on send to disconnected connection', () => {
  let node = createNode()
  doesNotThrow(() => {
    privateMethods(node).sendDuilian()
  })
})

test('sends messages to connection', async () => {
  let pair = await createTest()
  privateMethods(pair.leftNode).send(['test'])
  await pair.wait()
  deepStrictEqual(pair.leftSent, [['test']])
})

test('has connection state', async () => {
  let node = createNode()
  equal(node.connected, false)
  await node.connection.connect()
  equal(node.connected, true)
  node.connection.disconnect()
  equal(node.connected, false)
})

test('has state', async () => {
  let pair = new TestPair()
  let node = createNode({}, pair)

  let states: NodeState[] = []
  node.on('state', () => {
    states.push(node.state)
  })

  equal(node.state, 'disconnected')
  await node.connection.connect()
  privateMethods(node).sendConnect()
  pair.right.send(['connected', node.localProtocol, 'server', [0, 0]])
  await node.waitFor('synchronized')
  equal(node.state, 'synchronized')
  await node.log.add({ type: 'a' })
  equal(node.state, 'sending')
  pair.right.send(['synced', 1])
  await node.waitFor('synchronized')
  equal(node.state, 'synchronized')
  node.connection.disconnect()
  equal(node.state, 'disconnected')
  await node.log.add({ type: 'b' })
  equal(node.state, 'disconnected')
  emit(node.connection, 'connecting')
  equal(node.state, 'connecting')
  await node.connection.connect()
  privateMethods(node).sendConnect()
  pair.right.send(['connected', node.localProtocol, 'server', [0, 0]])
  await node.waitFor('sending')
  equal(node.state, 'sending')
  pair.right.send(['synced', 2])
  await node.waitFor('synchronized')
  equal(node.state, 'synchronized')
  await node.log.add({ type: 'c' })
  node.connection.disconnect()
  deepStrictEqual(states, [
    'connecting',
    'synchronized',
    'sending',
    'synchronized',
    'disconnected',
    'connecting',
    'sending',
    'synchronized',
    'sending',
    'disconnected'
  ])
})

test('does not wait for state change is current state is correct', async () => {
  await createNode().waitFor('disconnected')
})

test('loads lastSent, lastReceived and lastAdded from store', async () => {
  let log = TestTime.getLog()
  let pair = new TestPair()
  let node

  log.store.setLastSynced({ received: 2, sent: 1 })
  await log.add({ type: 'a' }, { reasons: ['test'] })
  node = new BaseNode('client', log, pair.left)
  await node.initializing
  equal(privateMethods(node).lastAddedCache, 1)
  equal(node.lastSent, 1)
  equal(node.lastReceived, 2)
})

test('does not override smaller lastSent', async () => {
  let node = createNode()
  privateMethods(node).setLastSent(2)
  privateMethods(node).setLastSent(1)
  equal(privateMethods(node.log.store).lastSent, 2)
})

test('has separated timeouts', async () => {
  let node = createNode({ timeout: 100 })

  let error: Error | undefined
  node.catch(e => {
    error = e
  })

  privateMethods(node).startTimeout()
  await delay(60)
  privateMethods(node).startTimeout()
  await delay(60)
  if (typeof error === 'undefined') throw new Error('Error was no sent')
  ok(error.message.includes('timeout'))
})

test('stops timeouts on disconnect', async () => {
  let node = createNode({ timeout: 10 })

  let error
  node.catch(e => {
    error = e
  })

  privateMethods(node).startTimeout()
  privateMethods(node).startTimeout()
  privateMethods(node).onDisconnect()

  await delay(50)
  privateMethods(node).startTimeout()
  equal(error, undefined)
})

test('accepts already connected connection', async () => {
  let pair = new TestPair()
  let node
  await pair.left.connect()
  node = new BaseNode('client', TestTime.getLog(), pair.left)
  await node.initializing
  equal(node.connected, true)
})

test('receives errors from connection', async () => {
  let pair = await createTest()
  let emitted
  pair.leftNode.catch(e => {
    emitted = e
  })

  let error = new Error('test')
  emit(pair.left, 'error', error)

  equal(pair.leftNode.connected, false)
  deepStrictEqual(pair.leftEvents, [['connect'], ['disconnect', 'error']])
  equal(emitted, error)
})

test('cancels error catching', async () => {
  let pair = await createTest()
  let emitted
  let unbind = pair.leftNode.catch((e: Error) => {
    emitted = e
  })

  unbind()
  let error = new Error('test')
  let catched
  try {
    emit(pair.left, 'error', error)
  } catch (e) {
    catched = e
  }
  equal(emitted, undefined)
  equal(catched, error)
})

test('does not fall on sync without connection', async () => {
  await privateMethods(createNode()).syncSince(0)
})

test('receives format errors from connection', async () => {
  let pair = await createTest()
  let error = new Error('Wrong message format')
  privateMethods(error).received = 'options'
  emit(pair.left, 'error', error)
  await pair.wait()
  equal(pair.leftNode.connected, false)
  deepStrictEqual(pair.leftEvents, [['connect'], ['disconnect', 'error']])
  deepStrictEqual(pair.leftSent, [['error', 'wrong-format', 'options']])
})

test('throws error by default', async () => {
  let error = new Error('test')
  let pair = await createTest()
  pair.leftNode.connection.send = () => {
    throw error
  }
  throws(() => {
    privateMethods(pair.leftNode).send(['ping', 0])
  }, error)
})

test('disconnect on the error during send', async () => {
  let error = new Error('test')
  let errors: Error[] = []
  let pair = await createTest()
  pair.leftNode.catch(e => {
    errors.push(e)
  })
  pair.leftNode.connection.send = () => {
    throw error
  }
  privateMethods(pair.leftNode).send(['ping', 0])
  await delay(1)
  equal(pair.leftNode.connected, false)
  deepStrictEqual(errors, [error])
})
