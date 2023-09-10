import { delay } from 'nanodelay'
import { test } from 'uvu'
import { equal, is, type } from 'uvu/assert'

import { ClientNode, ServerNode, TestPair, TestTime } from '../index.js'

let destroyable: TestPair

test.after.each(() => {
  destroyable.leftNode.destroy()
  destroyable.rightNode.destroy()
})

function privateMethods(obj: object): any {
  return obj
}

function createPair(): TestPair {
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

  pair.leftNode = new ClientNode('client', log1, pair.left, { fixTime: false })
  pair.rightNode = new ServerNode('server', log2, pair.right)

  return pair
}

async function createTest(
  before?: (testPair: TestPair) => void
): Promise<TestPair> {
  let pair = createPair()
  before?.(pair)
  pair.left.connect()
  await pair.leftNode.waitFor('synchronized')
  pair.clear()
  privateMethods(pair.leftNode).baseTime = 0
  privateMethods(pair.rightNode).baseTime = 0
  return pair
}

test('sends sync messages', async () => {
  let actionA = { type: 'a' }
  let actionB = { type: 'b' }
  let pair = await createTest()
  pair.leftNode.log.add(actionA)
  await pair.wait('left')
  equal(pair.leftSent, [
    ['sync', 1, actionA, { id: [1, 'test1', 0], reasons: ['t'], time: 1 }]
  ])
  equal(pair.rightSent, [['synced', 1]])

  pair.rightNode.log.add(actionB)
  await pair.wait('right')
  equal(pair.leftSent, [
    ['sync', 1, actionA, { id: [1, 'test1', 0], reasons: ['t'], time: 1 }],
    ['synced', 2]
  ])
  equal(pair.rightSent, [
    ['synced', 1],
    ['sync', 2, actionB, { id: [2, 'test2', 0], reasons: ['t'], time: 2 }]
  ])
})

test('uses last added on non-added action', async () => {
  let pair = await createTest()
  pair.leftNode.log.on('preadd', (action, meta) => {
    meta.reasons = []
  })
  pair.leftNode.log.add({ type: 'a' })
  await pair.wait('left')
  equal(pair.leftSent, [
    ['sync', 0, { type: 'a' }, { id: [1, 'test1', 0], reasons: [], time: 1 }]
  ])
})

test('checks sync types', async () => {
  let wrongs = [
    ['sync'],
    ['sync', 0, { type: 'a' }],
    ['sync', 0, { type: 'a' }, []],
    ['sync', 0, { type: 'a' }, {}],
    ['sync', 0, { type: 'a' }, { id: 0 }],
    ['sync', 0, { type: 'a' }, { time: 0 }],
    ['sync', 0, { type: 'a' }, { id: 0, time: '0' }],
    ['sync', 0, { type: 'a' }, { id: [0], time: 0 }],
    ['sync', 0, { type: 'a' }, { id: [0, 'node'], time: 0 }],
    ['sync', 0, { type: 'a' }, { id: '1 node 0', time: 0 }],
    ['sync', 0, { type: 'a' }, { id: [1, 'node', 1, '0'], time: 0 }],
    ['sync', 0, {}, { id: 0, time: 0 }],
    ['synced'],
    ['synced', 'abc']
  ]
  await Promise.all(
    wrongs.map(async msg => {
      let pair = await createTest()
      pair.leftNode.catch(() => true)
      // @ts-expect-error
      pair.leftNode.send(msg)
      await pair.wait('left')
      is(pair.rightNode.connected, false)
      equal(pair.rightSent, [['error', 'wrong-format', JSON.stringify(msg)]])
    })
  )
})

test('synchronizes actions', async () => {
  let pair = await createTest()
  pair.leftNode.log.add({ type: 'a' })
  await pair.wait('left')
  equal(pair.leftNode.log.actions(), [{ type: 'a' }])
  equal(pair.leftNode.log.actions(), pair.rightNode.log.actions())
  pair.rightNode.log.add({ type: 'b' })
  await pair.wait('right')
  equal(pair.leftNode.log.actions(), [{ type: 'a' }, { type: 'b' }])
  equal(pair.leftNode.log.actions(), pair.rightNode.log.actions())
})

test('remembers synced added', async () => {
  let pair = await createTest()
  equal(pair.leftNode.lastSent, 0)
  equal(pair.leftNode.lastReceived, 0)
  pair.leftNode.log.add({ type: 'a' })
  await pair.wait('left')
  equal(pair.leftNode.lastSent, 1)
  equal(pair.leftNode.lastReceived, 0)
  pair.rightNode.log.add({ type: 'b' })
  await pair.wait('right')
  equal(pair.leftNode.lastSent, 1)
  equal(pair.leftNode.lastReceived, 2)
  equal(privateMethods(pair.leftNode.log.store).lastSent, 1)
  equal(privateMethods(pair.leftNode.log.store).lastReceived, 2)
})

test('filters output actions', async () => {
  let pair = await createTest(async created => {
    created.leftNode.options.outFilter = async (action, meta) => {
      type(meta.id, 'string')
      type(meta.time, 'number')
      type(meta.added, 'number')
      return action.type === 'b'
    }
    await Promise.all([
      created.leftNode.log.add({ type: 'a' }),
      created.leftNode.log.add({ type: 'b' })
    ])
  })
  equal(pair.rightNode.log.actions(), [{ type: 'b' }])
  await Promise.all([
    pair.leftNode.log.add({ type: 'a' }),
    pair.leftNode.log.add({ type: 'b' })
  ])
  await pair.leftNode.waitFor('synchronized')
  equal(pair.rightNode.log.actions(), [{ type: 'b' }, { type: 'b' }])
})

test('maps output actions', async () => {
  let pair = await createTest()
  pair.leftNode.options.outMap = async (action, meta) => {
    type(meta.id, 'string')
    type(meta.time, 'number')
    type(meta.added, 'number')
    return [{ type: action.type + '1' }, meta]
  }
  pair.leftNode.log.add({ type: 'a' })
  await pair.wait('left')
  equal(pair.leftNode.log.actions(), [{ type: 'a' }])
  equal(pair.rightNode.log.actions(), [{ type: 'a1' }])
})

test('uses output filter before map', async () => {
  let calls: string[] = []
  let pair = await createTest()
  pair.leftNode.options.outMap = async (action, meta) => {
    calls.push('map')
    return [action, meta]
  }
  pair.leftNode.options.outFilter = async () => {
    calls.push('filter')
    return true
  }
  pair.leftNode.log.add({ type: 'a' })
  await pair.wait('left')
  equal(calls, ['filter', 'map'])
})

test('filters input actions', async () => {
  let pair = await createTest(created => {
    created.rightNode.options.onReceive = async (process, action, meta) => {
      type(meta.id, 'string')
      type(meta.time, 'number')
      if (action.type !== 'c') process(action, meta)
    }
    created.leftNode.log.add({ type: 'a' })
    created.leftNode.log.add({ type: 'b' })
    created.leftNode.log.add({ type: 'c' })
  })
  equal(pair.leftNode.log.actions(), [
    { type: 'a' },
    { type: 'b' },
    { type: 'c' }
  ])
  equal(pair.rightNode.log.actions(), [{ type: 'a' }, { type: 'b' }])
})

test('maps input actions', async () => {
  let pair = await createTest()
  pair.rightNode.options.onReceive = async (process, action, meta) => {
    type(meta.id, 'string')
    type(meta.time, 'number')
    let result = process({ type: action.type + '1' }, meta)
    type(result.then, 'function')
  }
  pair.leftNode.log.add({ type: 'a' })
  await pair.wait('left')
  equal(pair.leftNode.log.actions(), [{ type: 'a' }])
  equal(pair.rightNode.log.actions(), [{ type: 'a1' }])
})

test('handles error in onReceive', async () => {
  let error = new Error('test')
  let catched: Error[] = []

  let pair = await createTest()
  pair.rightNode.options.onReceive = () => {
    throw error
  }
  pair.rightNode.catch(e => {
    catched.push(e)
  })
  pair.leftNode.log.add({ type: 'a' })

  await delay(50)
  equal(catched, [error])
})

test('reports errors during initial output filter', async () => {
  let error = new Error('test')
  let catched: Error[] = []
  let pair = createPair()
  pair.rightNode.log.add({ type: 'a' })
  pair.rightNode.catch(e => {
    catched.push(e)
  })
  pair.rightNode.options.outFilter = async () => {
    throw error
  }
  pair.left.connect()
  await delay(50)
  equal(catched, [error])
})

test('reports errors during output filter', async () => {
  let error = new Error('test')
  let catched: Error[] = []
  let pair = await createTest(created => {
    created.rightNode.catch(e => {
      catched.push(e)
    })
    created.rightNode.options.outFilter = async () => {
      throw error
    }
  })
  pair.rightNode.log.add({ type: 'a' })
  await delay(50)
  equal(catched, [error])
})

test('reports errors during initial output map', async () => {
  let error = new Error('test')
  let catched: Error[] = []
  let pair = createPair()
  pair.rightNode.log.add({ type: 'a' })
  pair.rightNode.catch(e => {
    catched.push(e)
  })
  pair.rightNode.options.outMap = async () => {
    throw error
  }
  pair.left.connect()
  await delay(50)
  equal(catched, [error])
})

test('reports errors during output map', async () => {
  let error = new Error('test')
  let catched: Error[] = []
  let pair = await createTest(created => {
    created.rightNode.catch(e => {
      catched.push(e)
    })
    created.rightNode.options.outMap = async () => {
      throw error
    }
  })
  pair.rightNode.log.add({ type: 'a' })
  await delay(50)
  equal(catched, [error])
})

test('compresses time', async () => {
  let pair = await createTest()
  privateMethods(pair.leftNode).baseTime = 100
  privateMethods(pair.rightNode).baseTime = 100
  await pair.leftNode.log.add({ type: 'a' }, { id: '1 test1 0', time: 1 })
  await pair.leftNode.waitFor('synchronized')
  equal(pair.leftSent, [
    [
      'sync',
      1,
      { type: 'a' },
      { id: [-99, 'test1', 0], reasons: ['t'], time: -99 }
    ]
  ])
  equal(pair.rightNode.log.entries(), [
    [{ type: 'a' }, { added: 1, id: '1 test1 0', reasons: ['t'], time: 1 }]
  ])
})

test('compresses IDs', async () => {
  let pair = await createTest()
  await Promise.all([
    pair.leftNode.log.add({ type: 'a' }, { id: '1 client 0', time: 1 }),
    pair.leftNode.log.add({ type: 'a' }, { id: '1 client 1', time: 1 }),
    pair.leftNode.log.add({ type: 'a' }, { id: '1 o 0', time: 1 })
  ])
  await pair.leftNode.waitFor('synchronized')
  equal(pair.leftSent, [
    ['sync', 1, { type: 'a' }, { id: 1, reasons: ['t'], time: 1 }],
    ['sync', 2, { type: 'a' }, { id: [1, 1], reasons: ['t'], time: 1 }],
    ['sync', 3, { type: 'a' }, { id: [1, 'o', 0], reasons: ['t'], time: 1 }]
  ])
  equal(pair.rightNode.log.entries(), [
    [{ type: 'a' }, { added: 1, id: '1 client 0', reasons: ['t'], time: 1 }],
    [{ type: 'a' }, { added: 2, id: '1 client 1', reasons: ['t'], time: 1 }],
    [{ type: 'a' }, { added: 3, id: '1 o 0', reasons: ['t'], time: 1 }]
  ])
})

test('synchronizes any meta fields', async () => {
  let a = { type: 'a' }
  let pair = await createTest()
  await pair.leftNode.log.add(a, { id: '1 test1 0', one: 1, time: 1 })
  await pair.leftNode.waitFor('synchronized')
  equal(pair.leftSent, [
    ['sync', 1, a, { id: [1, 'test1', 0], one: 1, reasons: ['t'], time: 1 }]
  ])
  equal(pair.rightNode.log.entries(), [
    [a, { added: 1, id: '1 test1 0', one: 1, reasons: ['t'], time: 1 }]
  ])
})

test('fixes created time', async () => {
  let pair = await createTest()
  pair.leftNode.timeFix = 10
  await Promise.all([
    pair.leftNode.log.add({ type: 'a' }, { id: '11 test1 0', time: 11 }),
    pair.rightNode.log.add({ type: 'b' }, { id: '2 test2 0', time: 2 })
  ])
  await pair.leftNode.waitFor('synchronized')
  equal(pair.leftNode.log.entries(), [
    [{ type: 'a' }, { added: 1, id: '11 test1 0', reasons: ['t'], time: 11 }],
    [{ type: 'b' }, { added: 2, id: '2 test2 0', reasons: ['t'], time: 12 }]
  ])
  equal(pair.rightNode.log.entries(), [
    [{ type: 'a' }, { added: 2, id: '11 test1 0', reasons: ['t'], time: 1 }],
    [{ type: 'b' }, { added: 1, id: '2 test2 0', reasons: ['t'], time: 2 }]
  ])
})

test('supports multiple actions in sync', async () => {
  let pair = await createTest()
  privateMethods(pair.rightNode).sendSync(2, [
    [{ type: 'b' }, { added: 2, id: '2 test2 0', time: 2 }],
    [{ type: 'a' }, { added: 1, id: '1 test2 0', time: 1 }]
  ])
  await pair.wait('right')
  equal(pair.leftNode.lastReceived, 2)
  equal(pair.leftNode.log.entries(), [
    [{ type: 'a' }, { added: 1, id: '1 test2 0', reasons: ['t'], time: 1 }],
    [{ type: 'b' }, { added: 2, id: '2 test2 0', reasons: ['t'], time: 2 }]
  ])
})

test('starts and ends timeout', async () => {
  let pair = await createTest()
  privateMethods(pair.leftNode).sendSync(1, [
    [{ type: 'a' }, { added: 1, id: '1 test2 0', time: 1 }]
  ])
  privateMethods(pair.leftNode).sendSync(2, [
    [{ type: 'a' }, { added: 1, id: '2 test2 0', time: 2 }]
  ])
  equal(privateMethods(pair.leftNode).timeouts.length, 2)

  privateMethods(pair.leftNode).syncedMessage(1)
  equal(privateMethods(pair.leftNode).timeouts.length, 1)

  privateMethods(pair.leftNode).syncedMessage(2)
  equal(privateMethods(pair.leftNode).timeouts.length, 0)
})

test('should nothing happend if syncedMessage of empty syncing', async () => {
  let pair = await createTest()
  equal(privateMethods(pair.leftNode).timeouts.length, 0)

  privateMethods(pair.leftNode).syncedMessage(1)
  equal(privateMethods(pair.leftNode).timeouts.length, 0)
})

test('uses always latest added', async () => {
  let pair = await createTest()
  pair.leftNode.log.on('preadd', (action, meta) => {
    meta.reasons = action.type === 'a' ? ['t'] : []
  })
  privateMethods(pair.rightNode).send = () => {}
  pair.leftNode.log.add({ type: 'a' })
  await delay(1)
  pair.leftNode.log.add({ type: 'b' })
  await delay(1)
  equal(pair.leftSent[1][1], 1)
})

test('changes multiple actions in map', async () => {
  let pair = await createTest(created => {
    created.leftNode.options.outMap = async (action, meta) => {
      return [{ type: action.type.toUpperCase() }, meta]
    }
    created.leftNode.log.add({ type: 'a' })
    created.leftNode.log.add({ type: 'b' })
  })
  await pair.leftNode.waitFor('synchronized')
  equal(pair.rightNode.lastReceived, 2)
  equal(pair.rightNode.log.actions(), [{ type: 'A' }, { type: 'B' }])
})

test('synchronizes actions on connect', async () => {
  let added: string[] = []
  let pair = await createTest()
  pair.leftNode.log.on('add', action => {
    added.push(action.type)
  })
  await Promise.all([
    pair.leftNode.log.add({ type: 'a' }),
    pair.rightNode.log.add({ type: 'b' })
  ])
  await pair.leftNode.waitFor('synchronized')
  pair.left.disconnect()
  await pair.wait('right')
  equal(pair.leftNode.lastSent, 1)
  equal(pair.leftNode.lastReceived, 1)
  await Promise.all([
    pair.leftNode.log.add({ type: 'c' }),
    pair.leftNode.log.add({ type: 'd' }),
    pair.rightNode.log.add({ type: 'e' }),
    pair.rightNode.log.add({ type: 'f' })
  ])
  await pair.left.connect()
  pair.rightNode = new ServerNode('server2', pair.rightNode.log, pair.right)
  await pair.leftNode.waitFor('synchronized')
  equal(pair.leftNode.log.actions(), [
    { type: 'a' },
    { type: 'b' },
    { type: 'c' },
    { type: 'd' },
    { type: 'e' },
    { type: 'f' }
  ])
  equal(pair.leftNode.log.actions(), pair.rightNode.log.actions())
  equal(added, ['a', 'b', 'c', 'd', 'e', 'f'])
})

test.run()
