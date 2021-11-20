import { equal, is, ok, throws, not } from 'uvu/assert'
import { delay } from 'nanodelay'
import { test } from 'uvu'

import {
  BaseNode,
  ServerNode,
  ClientNode,
  LoguxError,
  TestTime,
  TestPair
} from '../index.js'

let fakeNode = new BaseNode('id', TestTime.getLog(), new TestPair().left)
const PROTOCOL = fakeNode.localProtocol

let pair: TestPair
test.after.each(() => {
  pair.leftNode.destroy()
  pair.rightNode.destroy()
})

function privateMethods(obj: object): any {
  return obj
}

function createTest(): TestPair {
  let time = new TestTime()
  let p = new TestPair()

  p.leftNode = new ClientNode('client', time.nextLog(), p.left)
  p.rightNode = new ServerNode('server', time.nextLog(), p.right)

  let current = 0
  privateMethods(p.leftNode).now = () => {
    current += 1
    return current
  }
  privateMethods(p.rightNode).now = privateMethods(p.leftNode).now

  p.leftNode.catch(() => true)
  p.rightNode.catch(() => true)

  return p
}

test('sends protocol version and name in connect message', async () => {
  pair = createTest()
  await pair.left.connect()
  await pair.wait()
  equal(pair.leftSent, [['connect', PROTOCOL, 'client', 0]])
})

test('answers with protocol version and name in connected message', async () => {
  pair = createTest()
  await pair.left.connect()
  await pair.wait('left')
  equal(pair.rightSent, [['connected', PROTOCOL, 'server', [2, 3]]])
})

test('checks client protocol version', async () => {
  pair = createTest()
  pair.leftNode.localProtocol = 1
  pair.rightNode.minProtocol = 2

  await pair.left.connect()
  await pair.wait('left')
  equal(pair.rightSent, [
    ['error', 'wrong-protocol', { supported: 2, used: 1 }]
  ])
  is(pair.rightNode.connected, false)
})

test('checks server protocol version', async () => {
  pair = createTest()
  pair.leftNode.minProtocol = 2
  pair.rightNode.localProtocol = 1

  await pair.left.connect()
  await pair.wait('left')
  await pair.wait('right')
  equal(pair.leftSent, [
    ['connect', PROTOCOL, 'client', 0],
    ['error', 'wrong-protocol', { supported: 2, used: 1 }]
  ])
  is(pair.left.connected, false)
})

test('checks types in connect message', async () => {
  let wrongs = [
    ['connect', []],
    ['connect', PROTOCOL, 'client', 0, 'abc'],
    ['connected', []],
    ['connected', PROTOCOL, 'client', [0]],
    ['connected', PROTOCOL, 'client', [0, 0], 1],
    ['connected', PROTOCOL, 'client', [0, 0], {}, 1]
  ]
  await Promise.all(
    wrongs.map(async msg => {
      let log = TestTime.getLog()
      let p = new TestPair()
      let node = new ServerNode('server', log, p.left)
      await p.left.connect()
      // @ts-expect-error
      p.right.send(msg)
      await p.wait('right')
      is(node.connected, false)
      equal(p.leftSent, [['error', 'wrong-format', JSON.stringify(msg)]])
    })
  )
})

test('saves other node name', async () => {
  pair = createTest()
  pair.left.connect()
  await pair.leftNode.waitFor('synchronized')
  equal(pair.leftNode.remoteNodeId, 'server')
  equal(pair.rightNode.remoteNodeId, 'client')
})

test('saves other client protocol', async () => {
  pair = createTest()
  pair.leftNode.minProtocol = 1
  pair.leftNode.localProtocol = 1
  pair.rightNode.minProtocol = 1
  pair.rightNode.localProtocol = 2

  pair.left.connect()
  await pair.leftNode.waitFor('synchronized')
  equal(pair.leftNode.remoteProtocol, 2)
  equal(pair.rightNode.remoteProtocol, 1)
})

test('saves other client subprotocol', async () => {
  pair = createTest()
  pair.leftNode.options.subprotocol = '1.0.0'
  pair.rightNode.options.subprotocol = '1.1.0'

  pair.left.connect()
  await pair.leftNode.waitFor('synchronized')
  equal(pair.leftNode.remoteSubprotocol, '1.1.0')
  equal(pair.rightNode.remoteSubprotocol, '1.0.0')
})

test('has default subprotocol', async () => {
  pair = createTest()
  pair.left.connect()
  await pair.leftNode.waitFor('synchronized')
  equal(pair.rightNode.remoteSubprotocol, '0.0.0')
})

test('checks subprotocol version', async () => {
  pair = createTest()
  pair.leftNode.options.subprotocol = '1.0.0'
  pair.rightNode.on('connect', () => {
    throw new LoguxError('wrong-subprotocol', {
      supported: '2.x',
      used: pair.rightNode.remoteSubprotocol ?? 'NO REMOTE'
    })
  })

  await pair.left.connect()
  await pair.wait('left')
  equal(pair.rightSent, [
    ['error', 'wrong-subprotocol', { supported: '2.x', used: '1.0.0' }]
  ])
  is(pair.rightNode.connected, false)
})

test('checks subprotocol version in client', async () => {
  pair = createTest()
  pair.rightNode.options.subprotocol = '1.0.0'
  pair.leftNode.on('connect', () => {
    throw new LoguxError('wrong-subprotocol', {
      supported: '2.x',
      used: pair.leftNode.remoteSubprotocol ?? 'NO REMOTE'
    })
  })

  await pair.left.connect()
  await pair.wait('right')
  await pair.wait('right')
  equal(pair.leftSent, [
    ['connect', PROTOCOL, 'client', 0],
    ['error', 'wrong-subprotocol', { supported: '2.x', used: '1.0.0' }]
  ])
  is(pair.leftNode.connected, false)
})

test('throws regular errors during connect event', () => {
  pair = createTest()

  let error = new Error('test')
  pair.leftNode.on('connect', () => {
    throw error
  })

  throws(() => {
    privateMethods(pair.leftNode).connectMessage(PROTOCOL, 'client', 0)
  }, error)
})

test('sends credentials in connect', async () => {
  pair = createTest()
  pair.leftNode.options = { token: '1' }

  pair.left.connect()
  await pair.leftNode.waitFor('synchronized')
  equal(pair.leftSent, [['connect', PROTOCOL, 'client', 0, { token: '1' }]])
})

test('generates credentials in connect', async () => {
  pair = createTest()
  pair.leftNode.options = { token: () => Promise.resolve('1') }

  pair.left.connect()
  await pair.leftNode.waitFor('synchronized')
  equal(pair.leftSent, [['connect', PROTOCOL, 'client', 0, { token: '1' }]])
})

test('sends credentials in connected', async () => {
  pair = createTest()
  pair.rightNode.options = { token: '1' }

  pair.left.connect()
  await pair.leftNode.waitFor('synchronized')
  equal(pair.rightSent, [
    ['connected', PROTOCOL, 'server', [2, 3], { token: '1' }]
  ])
})

test('generates credentials in connected', async () => {
  pair = createTest()
  pair.rightNode.options = { token: () => Promise.resolve('1') }

  pair.left.connect()
  await pair.leftNode.waitFor('synchronized')
  equal(pair.rightSent, [
    ['connected', PROTOCOL, 'server', [2, 3], { token: '1' }]
  ])
})

test('denies access for wrong users', async () => {
  pair = createTest()
  pair.rightNode.options = {
    async auth() {
      return false
    }
  }

  await pair.left.connect()
  await pair.wait('left')
  equal(pair.rightSent, [['error', 'wrong-credentials']])
  is(pair.rightNode.connected, false)
})

test('denies access to wrong server', async () => {
  pair = createTest()
  pair.leftNode.options = {
    async auth() {
      return false
    }
  }

  await pair.left.connect()
  await pair.wait('right')
  await pair.wait('right')
  equal(pair.leftSent, [
    ['connect', PROTOCOL, 'client', 0],
    ['error', 'wrong-credentials']
  ])
  is(pair.leftNode.connected, false)
})

test('allows access for right users', async () => {
  pair = createTest()
  pair.leftNode.options = { token: 'a' }
  pair.rightNode.options = {
    async auth(nodeId, token) {
      await delay(10)
      return token === 'a' && nodeId === 'client'
    }
  }

  await pair.left.connect()
  privateMethods(pair.leftNode).sendDuilian(0)
  await delay(50)
  equal(pair.rightSent[0], ['connected', PROTOCOL, 'server', [1, 2]])
})

test('has default timeFix', async () => {
  pair = createTest()
  pair.left.connect()
  await pair.leftNode.waitFor('synchronized')
  equal(pair.leftNode.timeFix, 0)
})

test('calculates time difference', async () => {
  pair = createTest()
  let clientTime = [10000, 10000 + 1000 + 100 + 1]
  privateMethods(pair.leftNode).now = () => clientTime.shift()
  let serverTime = [0 + 50, 0 + 50 + 1000]
  privateMethods(pair.rightNode).now = () => serverTime.shift()

  pair.leftNode.options.fixTime = true
  pair.left.connect()
  await pair.leftNode.waitFor('synchronized')
  equal(privateMethods(pair.leftNode).baseTime, 1050)
  equal(privateMethods(pair.rightNode).baseTime, 1050)
  equal(pair.leftNode.timeFix, 10000)
})

test('uses timeout between connect and connected', async () => {
  let log = TestTime.getLog()
  let p = new TestPair()
  let client = new ClientNode('client', log, p.left, { timeout: 100 })

  let error: Error | undefined
  client.catch(err => {
    error = err
  })

  await p.left.connect()
  await delay(101)
  if (typeof error === 'undefined') throw new Error('Error was not thrown')
  equal(error.name, 'LoguxError')
  not.ok(error.message.includes('received'))
  ok(error.message.includes('timeout'))
})

test('catches authentication errors', async () => {
  pair = createTest()
  let errors: Error[] = []
  pair.rightNode.catch(e => {
    errors.push(e)
  })

  let error = new Error()
  pair.rightNode.options = {
    async auth() {
      throw error
    }
  }

  await pair.left.connect()
  await pair.wait('right')
  await delay(1)
  equal(errors, [error])
  equal(pair.rightSent, [])
  is(pair.rightNode.connected, false)
})

test('sends authentication errors', async () => {
  pair = createTest()
  pair.rightNode.options = {
    async auth() {
      throw new LoguxError('bruteforce')
    }
  }

  await pair.left.connect()
  await pair.wait('right')
  await pair.wait('left')
  equal(pair.rightSent, [['error', 'bruteforce']])
  is(pair.rightNode.connected, false)
})

test('sends headers before connect message (if headers is set)', async () => {
  pair = createTest()
  pair.leftNode.setLocalHeaders({ env: 'development' })
  await pair.left.connect()
  await delay(101)
  equal(pair.leftSent, [
    ['headers', { env: 'development' }],
    ['connect', PROTOCOL, 'client', 0]
  ])
})

test('answers with headers before connected message', async () => {
  pair = createTest()
  pair.rightNode.setLocalHeaders({ env: 'development' })
  await pair.left.connect()
  await delay(101)
  equal(pair.rightSent, [
    ['headers', { env: 'development' }],
    ['connected', PROTOCOL, 'server', [2, 3]]
  ])
})

test('sends headers if connection is active', async () => {
  pair = createTest()
  await pair.left.connect()
  await pair.wait()
  equal(pair.leftSent, [['connect', PROTOCOL, 'client', 0]])

  pair.leftNode.setLocalHeaders({ env: 'development' })
  await delay(101)
  equal(pair.leftSent, [
    ['connect', PROTOCOL, 'client', 0],
    ['headers', { env: 'development' }]
  ])
})

test('saves remote headers', async () => {
  pair = createTest()
  pair.leftNode.setLocalHeaders({ env: 'development' })
  await pair.left.connect()
  await delay(101)
  equal(pair.rightNode.remoteHeaders, { env: 'development' })
})

test('allows access only with headers', async () => {
  pair = createTest()

  let authHeaders: object | undefined
  pair.leftNode.options = { token: 'a' }
  pair.rightNode.options = {
    async auth(nodeId, token, headers) {
      authHeaders = headers
      return true
    }
  }

  pair.leftNode.setLocalHeaders({ env: 'development' })
  await pair.left.connect()
  await delay(101)

  equal(authHeaders, { env: 'development' })
})

test.run()
