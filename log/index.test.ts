import { deepStrictEqual, equal, ok, throws } from 'node:assert'
import { afterEach, test } from 'node:test'

import {
  type Action,
  fromCompat,
  idToTime,
  isFirstOlder,
  Log,
  type LogPage,
  MemoryStore,
  type Meta,
  toCompat,
  toSorted
} from '../index.js'

function createLog(): Log<Meta, MemoryStore> {
  return new Log({
    nodeId: 'test',
    store: new MemoryStore()
  })
}

function checkActions(log: Log<Meta, MemoryStore>, expected: Action[]): void {
  let actions = log.store.entries.map(entry => entry[0])
  deepStrictEqual(actions, expected)
}

function checkEntries(
  log: Log<Meta, MemoryStore>,
  expected: [Action, Partial<Meta>][]
): void {
  let entries = log.store.entries.map(entry => [entry[0], entry[1]])
  deepStrictEqual(entries, expected)
}

async function logWith(
  entries: [Action, Partial<Meta>][]
): Promise<Log<Meta, MemoryStore>> {
  let log = createLog()
  await Promise.all(entries.map(entry => log.add(entry[0], entry[1])))
  return log
}

async function getError(cb: () => Promise<any>): Promise<string> {
  try {
    await cb()
  } catch (e) {
    if (e instanceof Error) return e.message
  }
  throw new Error('Error was not thrown')
}

let originNow = Date.now
afterEach(() => {
  Date.now = originNow
})

test('requires node ID', () => {
  throws(() => {
    // @ts-expect-error
    new Log()
  }, /node ID/)
})

test('requires store', () => {
  throws(() => {
    // @ts-expect-error
    new Log({ nodeId: 'test' })
  }, /store/)
})

test('checks node ID', () => {
  throws(() => {
    new Log({ nodeId: 'a b', store: new MemoryStore() })
  }, /Space/)
})

test('requires type for action', async () => {
  let log = createLog()
  // @ts-expect-error
  ok((await getError(() => log.add({ a: 1 }))).includes('"type" in action'))
})

test('rejects on action without type instead of throwing', async () => {
  let log = createLog()
  // @ts-expect-error
  let promise = log.add({ a: 1 })
  ok((await getError(() => promise)).includes('"type" in action'))
})

test('sends new entries to listeners', async () => {
  let log = createLog()
  let actions1: Action[] = []
  let actions2: Action[] = []

  await log.add({ type: 'A' })
  log.on('add', (action, meta) => {
    equal(typeof meta, 'object')
    actions1.push(action)
  })

  log.on('add', action => {
    actions2.push(action)
  })

  deepStrictEqual(actions1, [])
  deepStrictEqual(actions2, [])

  await log.add({ type: 'B' })
  await log.add({ type: 'C' })
  deepStrictEqual(actions1, [{ type: 'B' }, { type: 'C' }])
  deepStrictEqual(actions2, actions1)
})

test('unsubscribes listeners', async () => {
  let log = createLog()

  let actions: Action[] = []
  let unsubscribe = log.on('add', action => {
    actions.push(action)
  })

  await log.add({ type: 'A' })
  unsubscribe()
  await log.add({ type: 'B' })
  deepStrictEqual(actions, [{ type: 'A' }])
})

test('ignore entry with existed ID', async () => {
  let log = createLog()

  let added: Action[] = []
  log.on('add', action => {
    added.push(action)
  })

  let meta = { id: '0 n', reasons: ['test'] }
  let result1 = await log.add({ type: 'A' }, meta)
  equal(typeof result1, 'object')
  let result2 = await log.add({ type: 'B' }, meta)
  equal(result2, false)
  checkActions(log, [{ type: 'A' }])
  deepStrictEqual(added, [{ type: 'A' }])
})

test('iterates through added entries', async () => {
  let log = await logWith([
    [{ type: 'A' }, { id: '3 n', reasons: ['test'], time: 3 }],
    [{ type: 'B' }, { id: '2 n', reasons: ['test'], time: 2 }],
    [{ type: 'C' }, { id: '1 n', reasons: ['test'], time: 1 }]
  ])
  let entries: [Action, Meta][] = []
  await log.each((action, meta) => {
    entries.push([action, meta])
  })
  deepStrictEqual(entries, [
    [{ type: 'A' }, { added: 1, id: '3 n', reasons: ['test'], time: 3 }],
    [{ type: 'B' }, { added: 2, id: '2 n', reasons: ['test'], time: 2 }],
    [{ type: 'C' }, { added: 3, id: '1 n', reasons: ['test'], time: 1 }]
  ])
})

test('iterates by added order', async () => {
  let log = await logWith([
    [{ type: 'A' }, { id: '3 n', reasons: ['test'] }],
    [{ type: 'B' }, { id: '2 n', reasons: ['test'] }],
    [{ type: 'C' }, { id: '1 n', reasons: ['test'] }]
  ])
  let actions: Action[] = []
  await log.each({ order: 'added' }, action => {
    actions.push(action)
  })
  deepStrictEqual(actions, [{ type: 'C' }, { type: 'B' }, { type: 'A' }])
})

test('iterates by index', async () => {
  let log = await logWith([
    [{ type: 'A' }, { id: '3 n', indexes: ['a'], reasons: ['test'] }],
    [{ type: 'B' }, { id: '2 n', indexes: ['a', 'b'], reasons: ['test'] }],
    [{ type: 'C' }, { id: '1 n', indexes: ['b'], reasons: ['test'] }]
  ])
  let actions: Action[] = []
  await log.each({ index: 'b' }, action => {
    actions.push(action)
  })
  deepStrictEqual(actions, [{ type: 'C' }, { type: 'B' }])
})

test('disables iteration on false', async () => {
  let log = await logWith([
    [{ type: 'A' }, { reasons: ['test'] }],
    [{ type: 'B' }, { reasons: ['test'] }]
  ])
  let actions: Action[] = []
  await log.each(action => {
    actions.push(action)
    return false
  })
  deepStrictEqual(actions, [{ type: 'B' }])
})

test('supports multi-pages stores', async () => {
  let store = new MemoryStore()
  let meta: Meta = { added: 0, id: '1 0', reasons: [], time: 0 }
  let get: (opts?: object) => Promise<LogPage> = async () => {
    return {
      entries: [[{ type: 'a' }, meta]],
      async next(): Promise<LogPage> {
        return { entries: [[{ type: 'b' }, meta]] }
      }
    }
  }
  store.get = get
  let log = new Log({ nodeId: 'test', store })

  let actions: Action[] = []
  await log.each(action => {
    actions.push(action)
  })
  deepStrictEqual(actions, [{ type: 'a' }, { type: 'b' }])
})

test('generates ID from time', async () => {
  let log = createLog()
  Date.now = () => 100
  await log.add({ type: 'TIMED' }, { reasons: ['test'] })
  checkEntries(log, [
    [
      { type: 'TIMED' },
      {
        added: 1,
        id: '0Z test',
        reasons: ['test'],
        time: 100
      }
    ]
  ])
})

test('keeps existed ID, time and reasons', async () => {
  let log = await logWith([
    [{ type: 'TIMED' }, { id: '100 n', reasons: ['a'], time: 1 }]
  ])
  checkEntries(log, [
    [{ type: 'TIMED' }, { added: 1, id: '100 n', reasons: ['a'], time: 1 }]
  ])
})

test('sets default ID and time and empty reasons for new entries', async () => {
  let log = createLog()
  let called = 0
  log.on('add', (action, meta) => {
    called += 1
    equal(typeof meta.added, 'undefined')
    deepStrictEqual(meta.reasons, [])
    deepStrictEqual(typeof meta.time, 'number')
    equal(meta.id, `${toCompat(meta.time)} test`)
  })
  await log.add({ type: 'A' })
  equal(called, 1)
})

test('generates unique ID', () => {
  let log = createLog()
  let used: string[] = []
  for (let i = 0; i < 100; i++) {
    let id = log.generateId()
    ok(!used.includes(id))
    used.push(id)
  }
})

test('always generates biggest ID', () => {
  let log = createLog()
  let times = [10, 9]

  Date.now = () => times.shift() ?? 0

  equal(log.generateId(), `${toCompat(10)} test`)
  equal(log.generateId(), `${toCompat(11)} test`)
})

test('encodes time in ID', () => {
  let log = createLog()

  Date.now = () => 1000

  equal(log.generateId(), 'Ec test')
  equal(fromCompat('Ec'), 1000)
})

test('encodes numbers to ASCII-sorted alphabet', () => {
  equal(toCompat(0), '-')
  equal(toCompat(1), '0')
  equal(toCompat(63), 'z')
  equal(toCompat(64), '0-')
  equal(toCompat(1786312345678), 'OzcVoWD')

  let numbers = [0, 1, 10, 63, 64, 4095, 4096, 1e6, 7059950678]
  for (let number of numbers) {
    equal(fromCompat(toCompat(number)), number)
  }
})

test('keeps numbers order in encoded strings of same length', () => {
  let encoded = []
  for (let i = 64; i < 4096; i++) encoded.push(toCompat(i))
  deepStrictEqual(encoded.toSorted(), encoded)
})

test('takes time from ID', () => {
  equal(idToTime('Ec test'), 1000)
  equal(idToTime(toCompat(1786312345678)), 1786312345678)
})

test('creates string to sort actions in database', () => {
  let meta = {
    added: 1,
    id: 'Ec test',
    reasons: [],
    time: 1000
  }
  equal(toSorted(meta), '------Ec test ------Ec')
})

test('sorts strings in the same order as isFirstOlder()', () => {
  let metas: Meta[] = []
  for (let time of [1, 2, 63, 64, 4095, 4096]) {
    for (let nodeId of ['a', 'ab', 'b']) {
      metas.push({
        added: 0,
        id: `${toCompat(time)} ${nodeId}`,
        reasons: [],
        time: time
      })
    }
  }

  for (let time of [1, 2, 63, 64]) {
    metas.push({ added: 0, id: `${toCompat(time)} test1`, reasons: [], time })
  }
  for (let idTime of [1, 2, 63, 64]) {
    metas.push({
      added: 0,
      id: `${toCompat(idTime)} same`,
      reasons: [],
      time: 1000
    })
  }

  let byCompare = metas.toSorted((a, b) => (isFirstOlder(a, b) ? -1 : 1))
  let byString = metas.toSorted((a, b) => (toSorted(a) < toSorted(b) ? -1 : 1))
  deepStrictEqual(
    byString.map(i => i.id),
    byCompare.map(i => i.id)
  )
})

test('changes meta', async () => {
  let log = await logWith([
    [{ type: 'A' }, { id: '1 node', reasons: ['t'], time: 1 }],
    [
      { type: 'B' },
      { a: 1, id: '2 node', indexes: ['a'], reasons: ['t'], time: 2 }
    ]
  ])
  let result = await log.changeMeta('2 node', { a: 2, b: 2 })
  equal(result, true)
  checkEntries(log, [
    [{ type: 'A' }, { added: 1, id: '1 node', reasons: ['t'], time: 1 }],
    [
      { type: 'B' },
      {
        a: 2,
        added: 2,
        b: 2,
        id: '2 node',
        indexes: ['a'],
        reasons: ['t'],
        time: 2
      }
    ]
  ])
})

test('does not allow to change ID, added or indexes', async () => {
  let log = createLog()
  for (let key of ['id', 'added', 'time', 'subprotocol', 'indexes']) {
    ok(
      (await getError(() => log.changeMeta('1 n', { [key]: true }))).includes(
        `"${key}" is read-only`
      )
    )
  }
})

test('removes action on setting entry reasons', async () => {
  let log = await logWith([
    [{ type: 'A' }, { id: '1 n', reasons: ['test'], time: 1 }],
    [{ type: 'B' }, { id: '2 n', reasons: ['test'], time: 2 }]
  ])
  let cleaned: [Action, Meta][] = []
  log.on('clean', (action, meta) => {
    cleaned.push([action, meta])
  })

  let result1 = await log.changeMeta('2 n', { a: 1, reasons: [] })
  equal(result1, true)
  deepStrictEqual(cleaned, [
    [{ type: 'B' }, { a: 1, added: 2, id: '2 n', reasons: [], time: 2 }]
  ])
  checkEntries(log, [
    [{ type: 'A' }, { added: 1, id: '1 n', reasons: ['test'], time: 1 }]
  ])
  let result2 = await log.changeMeta('3 n', { reasons: [] })
  equal(result2, false)
})

test('returns action by ID', async () => {
  let log = await logWith([[{ type: 'A' }, { id: '1 n', reasons: ['test'] }]])

  let result1 = await log.byId('1 n')
  if (result1[0] === null) throw new Error('Action was no found')
  deepStrictEqual(result1[0], { type: 'A' })
  deepStrictEqual(result1[1].reasons, ['test'])

  let result2 = await log.byId('2 n')
  equal(result2[0], null)
  equal(result2[1], null)
})

test('cleans log by reason', async () => {
  let log = await logWith([
    [{ type: 'A' }, { reasons: ['a'] }],
    [{ type: 'AB' }, { reasons: ['a', 'b'] }],
    [{ type: 'B' }, { reasons: ['b'] }]
  ])
  let cleaned: [Action, Meta['added'], Meta['reasons']][] = []
  log.on('clean', (action, meta) => {
    cleaned.push([action, meta.added, meta.reasons])
  })
  await log.removeReason('a')
  checkActions(log, [{ type: 'AB' }, { type: 'B' }])
  deepStrictEqual(log.store.entries[1]![1].reasons, ['b'])
  deepStrictEqual(cleaned, [[{ type: 'A' }, 1, []]])
})

test('removes reason with minimum and maximum added', async () => {
  let log = await logWith([
    [{ type: '1' }, { reasons: ['a'] }],
    [{ type: '2' }, { reasons: ['a'] }],
    [{ type: '3' }, { reasons: ['a'] }]
  ])
  await log.removeReason('a', { maxAdded: 2, minAdded: 2 })
  checkActions(log, [{ type: '1' }, { type: '3' }])
})

test('does not put actions without reasons to log', async () => {
  let log = createLog()

  let added: [Action, Meta['added']][] = []
  log.on('add', (action, meta) => {
    equal(typeof meta.id, 'string')
    added.push([action, meta.added])
  })
  let cleaned: [Action, Meta['added']][] = []
  log.on('clean', (action, meta) => {
    cleaned.push([action, meta.added])
  })

  let meta = await log.add({ type: 'A' })
  if (meta === false) throw new Error('Action was no added')
  deepStrictEqual(meta.reasons, [])
  deepStrictEqual(added, [[{ type: 'A' }, undefined]])
  deepStrictEqual(cleaned, [[{ type: 'A' }, undefined]])
  checkActions(log, [])
  await log.add({ type: 'B' }, { reasons: ['test'] })
  deepStrictEqual(added, [
    [{ type: 'A' }, undefined],
    [{ type: 'B' }, 1]
  ])
  deepStrictEqual(cleaned, [[{ type: 'A' }, undefined]])
  checkActions(log, [{ type: 'B' }])
})

test('checks ID for actions without reasons', async () => {
  let log = createLog()

  let added: [Action, Meta['added']][] = []
  log.on('add', (action, meta) => {
    added.push([action, meta.added])
  })
  let cleaned: [Action, Meta['added']][] = []
  log.on('clean', (action, meta) => {
    cleaned.push([action, meta.added])
  })

  await log.add({ type: 'A' }, { id: '1 n', reasons: ['t'] })
  let meta1 = await log.add({ type: 'B' }, { id: '1 n' })
  equal(meta1, false)
  deepStrictEqual(added, [[{ type: 'A' }, 1]])
  deepStrictEqual(cleaned, [])
  let meta2 = await log.add({ type: 'C' }, { id: '2 n' })
  equal(typeof meta2, 'object')
  deepStrictEqual(added, [
    [{ type: 'A' }, 1],
    [{ type: 'C' }, undefined]
  ])
  deepStrictEqual(cleaned, [[{ type: 'C' }, undefined]])
})

test('fires preadd event', async () => {
  let log = createLog()

  let add: string[] = []
  log.on('add', action => {
    add.push(action.type)
  })

  let preadd: string[] = []
  log.on('preadd', (action, meta) => {
    equal(typeof meta.added, 'undefined')
    if (action.type === 'A') meta.reasons.push('test')
    preadd.push(action.type)
  })

  await log.add({ type: 'A' }, { id: '1 n', time: 1 })
  checkEntries(log, [
    [{ type: 'A' }, { added: 1, id: '1 n', reasons: ['test'], time: 1 }]
  ])
  deepStrictEqual(preadd, ['A'])
  deepStrictEqual(add, ['A'])
  await log.add({ type: 'B' }, { id: '1 n' })
  deepStrictEqual(preadd, ['A', 'B'])
  deepStrictEqual(add, ['A'])
})

test('removes reasons when keepLast option is used', async () => {
  let log = await logWith([
    [{ type: '1' }, { keepLast: 'a' }],
    [{ type: '2' }, { keepLast: 'a' }],
    [{ type: '3' }, { keepLast: 'a' }]
  ])
  checkActions(log, [{ type: '3' }])
})

test('allows to set keepLast in preadd', async () => {
  let log = createLog()
  log.on('preadd', (action, meta) => {
    meta.keepLast = 'a'
  })
  await Promise.all([
    log.add({ type: '1' }),
    log.add({ type: '2' }),
    log.add({ type: '3' })
  ])
  checkActions(log, [{ type: '3' }])
})

test('ensures `reasons` to be array of string values', async () => {
  let log = createLog()

  let meta1 = await log.add({ type: '1' })
  if (meta1 === false) throw new Error('Action was no found')
  deepStrictEqual(meta1.reasons, [])

  equal(
    // @ts-expect-error
    await getError(() => log.add({ type: '3' }, { reasons: 1 })),
    'Expected "reasons" to be an array of strings'
  )

  equal(
    // @ts-expect-error
    await getError(() => log.add({ type: '3' }, { reasons: [false, 1] })),
    'Expected "reasons" to be an array of strings'
  )
})

test('ensures `indexes` to be array of string values', async () => {
  let log = createLog()

  equal(
    // @ts-expect-error
    await getError(() => log.add({ type: '3' }, { indexes: 'a' })),
    'Expected "indexes" to be an array of strings'
  )

  equal(
    // @ts-expect-error
    await getError(() => log.add({ type: '3' }, { indexes: [false, 1] })),
    'Expected "indexes" to be an array of strings'
  )
})

test('has type listeners', async () => {
  let events: string[] = []
  let log = createLog()

  let unsubscribeA = log.type('A', (action, meta) => {
    equal(typeof meta.id, 'string')
    events.push(`A: ${action.type}`)
  })

  log.type(
    'B',
    (action, meta) => {
      equal(typeof meta.id, 'string')
      events.push(`B add: ${action.type}`)
    },
    { event: 'add' }
  )

  log.type(
    'C',
    (action, meta) => {
      equal(typeof meta.id, 'string')
      events.push(`C preadd: ${action.type}`)
    },
    { event: 'preadd' }
  )

  log.type(
    'A',
    (action, meta) => {
      equal(typeof meta.id, 'string')
      events.push(`A clean: ${action.type}`)
    },
    { event: 'clean' }
  )

  log.on('add', action => {
    events.push(`add: ${action.type}`)
  })

  await log.add({ type: 'A' })
  await log.add({ type: 'A' }, { reasons: ['test'] })
  await log.add({ type: 'A' }, { id: '0 test', reasons: ['test', 'test2'] })
  await log.add({ type: 'B' })
  await log.add({ type: 'C' })
  await log.add({ type: 'D' })
  await log.removeReason('test')
  await log.changeMeta('0 test', { reasons: [] })
  unsubscribeA()
  await log.add({ type: 'A' })

  deepStrictEqual(events, [
    'A: A',
    'add: A',
    'A clean: A',
    'A: A',
    'add: A',
    'A: A',
    'add: A',
    'B add: B',
    'add: B',
    'C preadd: C',
    'add: C',
    'add: D',
    'A clean: A',
    'A clean: A',
    'add: A',
    'A clean: A'
  ])
})

test('has type and action.id listener', async () => {
  let events: string[] = []
  let log = createLog()

  interface A {
    id: string
    name: string
    type: 'A'
  }

  log.type<A>('A', action => {
    events.push(`A add all ${action.name}`)
  })
  log.type<A>(
    'A',
    action => {
      events.push(`A add ID ${action.name}`)
    },
    { id: 'ID' }
  )
  log.type<A>(
    'A',
    action => {
      events.push(`A preadd ID ${action.name}`)
    },
    { event: 'preadd', id: 'ID' }
  )

  await log.add({ id: 'ID', name: 'a', type: 'A' })
  await log.add({ id: 'Other', name: 'b', type: 'A' })
  await log.add({ id: 'ID', name: 'c', type: 'O' })

  deepStrictEqual(events, [
    'A preadd ID a',
    'A add ID a',
    'A add all a',
    'A add all b'
  ])
})

test('adds array of actions', async () => {
  let log = createLog()
  let preadded: Action[] = []
  let added: Action[] = []
  let cleaned: Action[] = []
  log.on('preadd', action => {
    preadded.push(action)
  })
  log.on('add', action => {
    added.push(action)
  })
  log.on('clean', action => {
    cleaned.push(action)
  })

  let metas = await log.add([
    [{ type: 'A' }, { reasons: ['test'] }],
    [{ type: 'B' }],
    [{ type: 'C' }, { reasons: ['test'] }]
  ])

  deepStrictEqual(preadded, [{ type: 'A' }, { type: 'B' }, { type: 'C' }])
  deepStrictEqual(added, [{ type: 'A' }, { type: 'B' }, { type: 'C' }])
  deepStrictEqual(cleaned, [{ type: 'B' }])
  deepStrictEqual(
    metas.map(meta => meta && meta.added),
    [1, undefined, 2]
  )
  checkActions(log, [{ type: 'A' }, { type: 'C' }])
})

test('returns false for duplicates in array', async () => {
  let log = createLog()
  let metas = await log.add([
    [{ type: 'A' }, { id: '1 node 0', reasons: ['test'] }],
    [{ type: 'B' }, { id: '1 node 0', reasons: ['test'] }]
  ])
  equal(metas[1], false)
  checkActions(log, [{ type: 'A' }])
})

test('emits batch event', async () => {
  let log = createLog()
  let batches: Action[][] = []
  log.on('batch', entries => {
    batches.push(entries.map(entry => entry[0]))
  })

  await log.add({ type: 'A' })
  await log.add({ type: 'B' }, { reasons: ['test'] })
  await log.add([[{ type: 'C' }], [{ type: 'D' }, { reasons: ['test'] }]])
  await log.add([])
  await log.add({ type: 'E' }, { id: '1 node 0', reasons: ['test'] })
  await log.add({ type: 'F' }, { id: '1 node 0', reasons: ['test'] })

  deepStrictEqual(batches, [
    [{ type: 'A' }],
    [{ type: 'B' }],
    [{ type: 'C' }, { type: 'D' }],
    [{ type: 'E' }]
  ])
})

test('emits batch event with metadata', async () => {
  let log = createLog()
  let ids: string[] = []
  log.on('batch', entries => {
    ids = entries.map(entry => entry[1].id)
  })

  let metas = await log.add([[{ type: 'A' }], [{ type: 'B' }]])
  deepStrictEqual(ids, [metas[0] && metas[0].id, metas[1] && metas[1].id])
})
