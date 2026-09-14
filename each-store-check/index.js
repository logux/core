/* node:coverage disable */
function ok(value) {
  if (!value) {
    throw new Error('Expected value to be truthy, but got false')
  }
}

async function add(store, action, meta) {
  let [result] = await store.add([[action, meta]])
  return result
}

function deepEqual(a, b) {
  if (a === b) {
    return true
  } else if (a instanceof Uint8Array || b instanceof Uint8Array) {
    if (!(a instanceof Uint8Array) || !(b instanceof Uint8Array)) {
      return false
    } else if (a.length !== b.length) {
      return false
    } else {
      for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false
      }
      return true
    }
  } else if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      return false
    } else {
      for (let i = 0; i < a.length; i++) {
        if (!deepEqual(a[i], b[i])) return false
      }
      return true
    }
  } else if (typeof a === 'object' && typeof b === 'object') {
    if (Object.keys(a).length !== Object.keys(b).length) {
      return false
    } else {
      for (let i in a) {
        if (!deepEqual(a[i], b[i])) return false
      }
      return true
    }
  } else {
    return false
  }
}

function equal(a, b) {
  if (!deepEqual(a, b)) {
    throw new Error(
      `Expected ${JSON.stringify(a)} to equal ${JSON.stringify(b)}`
    )
  }
}
/* node:coverage enable */

async function all(request, list) {
  if (!list) list = []
  let page = await request
  list = page.entries.concat(list)
  return page.next ? all(page.next(), list) : list
}

async function check(store, opts, list) {
  let actual = await all(store.get(opts))
  equal(actual, list)
}

async function checkBoth(store, expected) {
  await Promise.all([
    check(store, { order: 'created' }, expected),
    check(store, { order: 'added' }, expected)
  ])
}

async function checkIndex(store, index, expected) {
  await Promise.all([
    check(store, { index, order: 'created' }, expected),
    check(store, { index, order: 'added' }, expected)
  ])
}

async function checkLastAdded(store, expected) {
  let lastAdded = await store.getLastAdded()
  equal(lastAdded, expected)
}

async function checkLastSynced(store, expectedSent, expectedRecieved) {
  let lastSynced = await store.getLastSynced()
  equal(lastSynced, {
    received: expectedRecieved,
    sent: expectedSent
  })
}

let noop = () => {}

/**
 * Most fixtures follow a single convention: the action `N` has `N n` ID
 * and `N` time, and it is the Nth action added to the store.
 */
function seed(store, specs) {
  return Promise.all(
    specs.map(([num, meta]) =>
      add(store, { type: `${num}` }, { id: `${num} n`, time: num, ...meta })
    )
  )
}

function entries(...specs) {
  return specs.map(([num, meta]) => [
    { type: `${num}` },
    { added: num, id: `${num} n`, time: num, ...meta }
  ])
}

function collect() {
  let removed = []
  return [
    removed,
    action => {
      removed.push(action.type)
    }
  ]
}

// A fresh object per call: stores change `meta.reasons` in place
function reasoned(nums) {
  return nums.map(num => [num, { reasons: ['a'] }])
}

let m1 = { id: '1 n', time: 1 }
let m2 = { id: '2 n', time: 2 }
let m3 = { id: '3 n', time: 3 }

// Every case starts from the same three actions with the `a` reason
// and differs only by the criteria and by the actions, which keep the reason
const REMOVE_CRITERIA = [
  {
    criteria: { olderThan: m3, youngerThan: m1 },
    keep: [1, 3],
    name: 'removes reason by time'
  },
  {
    criteria: { olderThan: m2 },
    keep: [2, 3],
    name: 'removes reason for older action'
  },
  {
    criteria: { youngerThan: m2 },
    keep: [1, 2],
    name: 'removes reason for younger action'
  },
  {
    criteria: { minAdded: 2 },
    keep: [1],
    name: 'removes reason with minimum added'
  },
  {
    criteria: { maxAdded: 2 },
    keep: [3],
    name: 'removes reason with maximum added'
  },
  {
    criteria: { maxAdded: 2, minAdded: 2 },
    keep: [1, 3],
    name: 'removes reason with minimum and maximum added'
  },
  {
    criteria: { ids: ['1 n', '3 n'], maxAdded: 2 },
    keep: [2, 3],
    name: 'combines ids with other criteria'
  },
  {
    criteria: { ids: [] },
    keep: [1, 2, 3],
    name: 'removes reason with empty ids'
  },
  {
    criteria: { maxAdded: 0 },
    keep: [1, 2, 3],
    name: 'removes reason with zero at maximum added'
  }
]

export function eachStoreCheck(test) {
  test('is empty in the beginning', factory => async () => {
    let store = factory()
    await Promise.all([checkLastAdded(store, 0), checkLastSynced(store, 0, 0)])
  })

  test('updates latest synced values', factory => async () => {
    let store = factory()
    await store.setLastSynced({ sent: 1 })
    await checkLastSynced(store, 1, 0)
    await store.setLastSynced({ received: 1 })
    await checkLastSynced(store, 1, 1)
  })

  test('updates both synced values', factory => async () => {
    let store = factory()
    await store.setLastSynced({ received: 1, sent: 2 })
    await checkLastSynced(store, 2, 1)
  })

  test('stores entries sorted', factory => async () => {
    let store = factory()
    await Promise.all([
      add(store, { type: '1' }, { id: '1 a', time: 1 }),
      add(store, { type: '2' }, { id: '1 c', time: 2 }),
      add(store, { type: '3' }, { id: '1 b', time: 2 }),
      add(store, { type: '4' }, { id: '3 b', time: 2 })
    ])
    await check(store, { order: 'created' }, [
      [{ type: '1' }, { added: 1, id: '1 a', time: 1 }],
      [{ type: '3' }, { added: 3, id: '1 b', time: 2 }],
      [{ type: '4' }, { added: 4, id: '3 b', time: 2 }],
      [{ type: '2' }, { added: 2, id: '1 c', time: 2 }]
    ])
    await check(store, { order: 'added' }, [
      [{ type: '1' }, { added: 1, id: '1 a', time: 1 }],
      [{ type: '2' }, { added: 2, id: '1 c', time: 2 }],
      [{ type: '3' }, { added: 3, id: '1 b', time: 2 }],
      [{ type: '4' }, { added: 4, id: '3 b', time: 2 }]
    ])
  })

  test('indexed entries sorted', factory => async () => {
    let store = factory()
    await Promise.all([
      add(store, { type: '1' }, { id: '2 node1', indexes: ['a'], time: 2 }),
      add(store, { type: '2' }, { id: '1 node1', indexes: ['a'], time: 1 }),
      add(store, { type: '3' }, { id: '3 node1', time: 3 })
    ])
    await check(store, { index: 'a', order: 'created' }, [
      [{ type: '2' }, { added: 2, id: '1 node1', indexes: ['a'], time: 1 }],
      [{ type: '1' }, { added: 1, id: '2 node1', indexes: ['a'], time: 2 }]
    ])
    await check(store, { index: 'a', order: 'added' }, [
      [{ type: '1' }, { added: 1, id: '2 node1', indexes: ['a'], time: 2 }],
      [{ type: '2' }, { added: 2, id: '1 node1', indexes: ['a'], time: 1 }]
    ])
  })

  test('returns entries with reason', factory => async () => {
    let store = factory()
    await seed(store, [
      [1, { reasons: ['b'] }],
      [2, { reasons: [] }],
      [3, { reasons: ['a'] }],
      [4, { reasons: ['b'] }],
      [5, { reasons: ['a', 'b'] }]
    ])
    await check(
      store,
      { order: 'created', reason: 'a' },
      entries([3, { reasons: ['a'] }], [5, { reasons: ['a', 'b'] }])
    )
    await check(
      store,
      { order: 'added', reason: 'a' },
      entries([3, { reasons: ['a'] }], [5, { reasons: ['a', 'b'] }])
    )
    await check(
      store,
      { order: 'added', reason: 'b' },
      entries(
        [1, { reasons: ['b'] }],
        [4, { reasons: ['b'] }],
        [5, { reasons: ['a', 'b'] }]
      )
    )
    await check(store, { order: 'added', reason: 'c' }, [])
  })

  test('returns indexed entries with reason', factory => async () => {
    let store = factory()
    await seed(store, [
      [1, { indexes: ['a'], reasons: ['a'] }],
      [2, { indexes: ['a'], reasons: ['b'] }],
      [3, { reasons: ['a'] }]
    ])
    await check(
      store,
      { index: 'a', order: 'created', reason: 'a' },
      entries([1, { indexes: ['a'], reasons: ['a'] }])
    )
    await check(
      store,
      { index: 'a', order: 'added', reason: 'a' },
      entries([1, { indexes: ['a'], reasons: ['a'] }])
    )
  })

  test('returns latest added', factory => async () => {
    let store = factory()
    await add(store, { type: 'A' }, { id: '1 n', time: 1 })
    let added = await store.getLastAdded()
    ok(added)
    await add(store, { type: 'A' }, { id: '1 n' })
    await checkLastAdded(store, 1)
  })

  test('changes meta', factory => async () => {
    let store = factory()
    await add(store, {}, { a: 1, id: '1 n', indexes: ['a'], time: 1 })
    let result = await store.changeMeta('1 n', { a: 2, b: 2 })
    equal(result, true)
    await checkBoth(store, [
      [{}, { a: 2, added: 1, b: 2, id: '1 n', indexes: ['a'], time: 1 }]
    ])
    await checkIndex(store, 'a', [
      [{}, { a: 2, added: 1, b: 2, id: '1 n', indexes: ['a'], time: 1 }]
    ])
  })

  test('resolves to false on unknown ID in changeMeta', factory => async () => {
    let store = factory()
    let result = await store.changeMeta('1 n', { a: 1 })
    equal(result, false)
  })

  test('removes entries', factory => async () => {
    let store = factory()
    await Promise.all([
      add(store, { type: '1' }, { id: '1 node1', time: 1 }),
      add(store, { type: '1' }, { id: '1 node1', time: 1 }),
      add(store, { type: '2' }, { id: '2 node1', time: 2 }),
      add(store, { type: '3' }, { id: '3 node1', time: 3 }),
      add(store, { type: '4' }, { id: '4 node1', time: 4 }),
      add(store, { type: '5' }, { id: '4 node2', time: 4 }),
      add(store, { type: '6' }, { id: '5 node1', time: 5 })
    ])
    let result = await store.remove('2 node1')
    equal(result, [{ type: '2' }, { added: 2, id: '2 node1', time: 2 }])
    await checkBoth(store, [
      [{ type: '1' }, { added: 1, id: '1 node1', time: 1 }],
      [{ type: '3' }, { added: 3, id: '3 node1', time: 3 }],
      [{ type: '4' }, { added: 4, id: '4 node1', time: 4 }],
      [{ type: '5' }, { added: 5, id: '4 node2', time: 4 }],
      [{ type: '6' }, { added: 6, id: '5 node1', time: 5 }]
    ])
  })

  test('removes entry with 0 time', factory => async () => {
    let store = factory()
    await Promise.all([
      add(store, { type: '1' }, { id: '1 node1', time: 1 }),
      add(store, { type: '2' }, { id: '2 node1', time: 2 }),
      add(store, { type: '3' }, { id: '3 node1', time: 0 })
    ])
    await store.remove('3 node1')
    await checkBoth(store, [
      [{ type: '1' }, { added: 1, id: '1 node1', time: 1 }],
      [{ type: '2' }, { added: 2, id: '2 node1', time: 2 }]
    ])
  })

  test('ignores removing unknown entry', factory => async () => {
    let store = factory()
    await add(store, { type: 'A' }, { added: 1, id: '1 n', time: 1 })
    let result = await store.remove('2 n')
    equal(result, false)
    await check(store, { order: 'created' }, [
      [{ type: 'A' }, { added: 1, id: '1 n', time: 1 }]
    ])
  })

  test('removes entry with indexes', factory => async () => {
    let store = factory()
    await Promise.all([
      add(store, { type: '1' }, { id: '1 node1', time: 1 }),
      add(
        store,
        { type: '2' },
        { id: '2 node1', indexes: ['a', 'b'], time: 2 }
      ),
      add(store, { type: '3' }, { id: '3 node1', indexes: ['b'], time: 3 })
    ])
    await store.remove('2 node1')
    await checkBoth(store, [
      [{ type: '1' }, { added: 1, id: '1 node1', time: 1 }],
      [{ type: '3' }, { added: 3, id: '3 node1', indexes: ['b'], time: 3 }]
    ])
    await checkIndex(store, 'a', [])
    await checkIndex(store, 'b', [
      [{ type: '3' }, { added: 3, id: '3 node1', indexes: ['b'], time: 3 }]
    ])
  })

  test('removes reasons and actions without reason', factory => async () => {
    let store = factory()
    await seed(store, [
      [1, { reasons: ['a'] }],
      [2, { reasons: ['a'] }],
      [3, { reasons: ['a', 'b'] }],
      [4, { reasons: ['b'] }]
    ])
    await store.removeReason(['a'], {}, noop)
    await checkBoth(
      store,
      entries([3, { reasons: ['b'] }], [4, { reasons: ['b'] }])
    )
  })

  test('removes reason from indexes', factory => async () => {
    let store = factory()
    await seed(store, [
      [1, { indexes: ['a', 'b'], reasons: ['a'] }],
      [2, { indexes: ['b'], reasons: ['b'] }]
    ])
    await store.removeReason(['a'], {}, noop)
    await checkIndex(store, 'a', [])
    await checkIndex(
      store,
      'b',
      entries([2, { indexes: ['b'], reasons: ['b'] }])
    )
  })

  for (let { criteria, keep, name } of REMOVE_CRITERIA) {
    test(name, factory => async () => {
      let store = factory()
      await seed(store, reasoned([1, 2, 3]))
      await store.removeReason(['a'], criteria, noop)
      await checkBoth(store, entries(...reasoned(keep)))
    })
  }

  test('removes reasons and actions by id', factory => async () => {
    let store = factory()
    let [removed, push] = collect()
    await seed(store, [
      [1, { reasons: ['a'] }],
      [2, { reasons: ['a', 'b'] }],
      [3, { reasons: ['a'] }]
    ])
    await Promise.all([
      store.removeReason(['a'], { id: '1 n' }, push),
      store.removeReason(['b'], { id: '2 n' }, push),
      store.removeReason(['c'], { id: '3 n' }, push),
      store.removeReason(['a'], { id: '4 n' }, push)
    ])
    equal(removed, ['1'])
    await checkBoth(
      store,
      entries([2, { reasons: ['a'] }], [3, { reasons: ['a'] }])
    )
  })

  test('removes reasons and actions by ids', factory => async () => {
    let store = factory()
    let [removed, push] = collect()
    await seed(store, [
      [1, { reasons: ['a'] }],
      [2, { reasons: ['a', 'b'] }],
      [3, { reasons: ['a'] }],
      [4, { reasons: ['a'] }],
      [5, { reasons: ['a'] }]
    ])
    await store.removeReason(['a'], { ids: ['1 n', '2 n', '4 n', '6 n'] }, push)
    equal(
      removed.toSorted((a, b) => a.localeCompare(b)),
      ['1', '4']
    )
    await checkBoth(
      store,
      entries(
        [2, { reasons: ['b'] }],
        [3, { reasons: ['a'] }],
        [5, { reasons: ['a'] }]
      )
    )
  })

  test('removes many reasons in a single pass', factory => async () => {
    let store = factory()
    let [removed, push] = collect()
    await seed(store, [
      [1, { reasons: ['a', 'b'] }],
      [2, { reasons: ['a', 'c'] }],
      [3, { reasons: ['c'] }]
    ])
    await store.removeReason(['a', 'b'], {}, push)
    equal(removed, ['1'])
    await checkBoth(
      store,
      entries([2, { reasons: ['c'] }], [3, { reasons: ['c'] }])
    )
  })

  test('removes reason by index', factory => async () => {
    let store = factory()
    await seed(store, [
      [1, { indexes: ['a', 'b'], reasons: ['r'] }],
      [2, { indexes: ['b'], reasons: ['r'] }],
      [3, { reasons: ['r'] }]
    ])
    await store.removeReason(['r'], { index: 'a' }, noop)
    await store.removeReason(['r'], { index: 'unknown' }, noop)
    await checkBoth(
      store,
      entries([2, { indexes: ['b'], reasons: ['r'] }], [3, { reasons: ['r'] }])
    )
    await checkIndex(store, 'a', [])
    await checkIndex(
      store,
      'b',
      entries([2, { indexes: ['b'], reasons: ['r'] }])
    )
  })

  test('combines index with other criteria', factory => async () => {
    let store = factory()
    await seed(store, [
      [1, { indexes: ['a'], reasons: ['r'] }],
      [2, { indexes: ['a'], reasons: ['r'] }],
      [3, { indexes: ['a'], reasons: ['r'] }]
    ])
    await store.removeReason(['r'], { index: 'a', maxAdded: 2 }, noop)
    await checkIndex(
      store,
      'a',
      entries([3, { indexes: ['a'], reasons: ['r'] }])
    )
  })

  test('adds reasons to actions', factory => async () => {
    let store = factory()
    await seed(store, [
      [1, { reasons: ['a'] }],
      [2, { reasons: ['a'] }]
    ])
    await store.addReason(['b', 'c'], {})
    let reasons = ['a', 'b', 'c']
    await checkBoth(store, entries([1, { reasons }], [2, { reasons }]))
  })

  test('adds reasons by ID', factory => async () => {
    let store = factory()
    await seed(store, [
      [1, { reasons: ['a'] }],
      [2, { reasons: ['a'] }]
    ])
    await store.addReason(['b'], { id: '2 n' })
    await store.addReason(['b'], { id: '3 n' })
    await checkBoth(
      store,
      entries([1, { reasons: ['a'] }], [2, { reasons: ['a', 'b'] }])
    )
  })

  test('does not duplicate reasons', factory => async () => {
    let store = factory()
    await seed(store, [[1, { reasons: ['a'] }]])
    await store.addReason(['a', 'b'], { ids: ['1 n'] })
    await checkBoth(store, entries([1, { reasons: ['a', 'b'] }]))
  })

  test('removes reason except the index', factory => async () => {
    let store = factory()
    await seed(store, [
      [1, { indexes: ['a', 'b'], reasons: ['r'] }],
      [2, { indexes: ['a'], reasons: ['r'] }]
    ])
    await store.removeReason(['r'], { exceptIndex: 'b', index: 'a' }, noop)
    await checkBoth(
      store,
      entries([1, { indexes: ['a', 'b'], reasons: ['r'] }])
    )
  })

  test('adds reasons except the index', factory => async () => {
    let store = factory()
    await seed(store, [
      [1, { indexes: ['a', 'b'], reasons: ['r'] }],
      [2, { indexes: ['a'], reasons: ['r'] }]
    ])
    await store.addReason(['new'], { exceptIndex: 'b', index: 'a' })
    await checkBoth(
      store,
      entries(
        [1, { indexes: ['a', 'b'], reasons: ['r'] }],
        [2, { indexes: ['a'], reasons: ['r', 'new'] }]
      )
    )
  })

  test('adds reasons by index', factory => async () => {
    let store = factory()
    await seed(store, [
      [1, { indexes: ['a'], reasons: ['r'] }],
      [2, { indexes: ['b'], reasons: ['r'] }],
      [3, { reasons: ['r'] }]
    ])
    await store.addReason(['new'], { index: 'a' })
    await store.addReason(['new'], { index: 'unknown' })
    await checkBoth(
      store,
      entries(
        [1, { indexes: ['a'], reasons: ['r', 'new'] }],
        [2, { indexes: ['b'], reasons: ['r'] }],
        [3, { reasons: ['r'] }]
      )
    )
  })

  test('checks index on action from ID', factory => async () => {
    let store = factory()
    await seed(store, [
      [1, { indexes: ['b'], reasons: ['r'] }],
      [2, { reasons: ['r'] }]
    ])
    await store.addReason(['new'], { id: '1 n', index: 'a' })
    await store.addReason(['new'], { id: '2 n', index: 'a' })
    await checkBoth(
      store,
      entries([1, { indexes: ['b'], reasons: ['r'] }], [2, { reasons: ['r'] }])
    )
  })

  test('returns action by ID', factory => async () => {
    let store = factory()
    await Promise.all([
      add(store, { type: 'A' }, { id: '1 node', time: 1 }),
      add(store, { type: 'B' }, { id: '2 node', time: 2 }),
      add(store, { type: 'C' }, { id: '3 node', time: 3 }),
      add(store, { type: 'D' }, { id: '4 node', time: 4 }),
      add(store, { type: 'E' }, { id: '5 node2', time: 5 })
    ])
    let [action1, meta1] = await store.byId('1 node')
    equal(action1, { type: 'A' })
    equal(meta1.time, 1)
    let [action2] = await store.byId('3 node')
    equal(action2, { type: 'C' })
    let [action3, meta3] = await store.byId('6 node')
    equal(action3, null)
    equal(meta3, null)
  })

  test('adds many actions by a single call', factory => async () => {
    let store = factory()
    equal(await store.add([]), [])
    let results = await store.add([
      [{ type: 'A' }, { id: '1 node', time: 1 }],
      [{ type: 'B' }, { id: '2 node', indexes: ['a'], time: 2 }],
      // The duplicate of the first action of the same call
      [{ type: 'C' }, { id: '1 node', time: 3 }],
      [{ type: 'D' }, { id: '3 node', time: 3 }]
    ])
    equal(results, [
      { added: 1, id: '1 node', time: 1 },
      { added: 2, id: '2 node', indexes: ['a'], time: 2 },
      false,
      { added: 3, id: '3 node', time: 3 }
    ])
    await checkBoth(store, [
      [{ type: 'A' }, { added: 1, id: '1 node', time: 1 }],
      [{ type: 'B' }, { added: 2, id: '2 node', indexes: ['a'], time: 2 }],
      [{ type: 'D' }, { added: 3, id: '3 node', time: 3 }]
    ])
    await checkIndex(store, 'a', [
      [{ type: 'B' }, { added: 2, id: '2 node', indexes: ['a'], time: 2 }]
    ])
    await checkLastAdded(store, 3)
  })

  test('checks many IDs by a single call', factory => async () => {
    let store = factory()
    await Promise.all([
      add(store, { type: 'A' }, { id: '1 node', time: 1 }),
      add(store, { type: 'B' }, { id: '2 node', time: 2 }),
      add(store, { type: 'C' }, { id: '3 node', time: 3 })
    ])
    equal(await store.has([]), [])
    equal(await store.has(['4 node']), [])
    equal((await store.has(['3 node', '4 node', '1 node'])).toSorted(), [
      '1 node',
      '3 node'
    ])
  })

  test('ignores entries with same ID', factory => async () => {
    let store = factory()
    let id = '1 a'
    let meta1 = await add(store, { a: 1 }, { id, time: 1 })
    equal(meta1, { added: 1, id, time: 1 })
    let meta2 = await add(store, { a: 2 }, { id, time: 2 })
    ok(!meta2)
    await checkBoth(store, [[{ a: 1 }, { added: 1, id, time: 1 }]])
  })

  test('stores any metadata', factory => async () => {
    let store = factory()
    await add(store, { type: 'A' }, { id: '1 a', test: 1, time: 1 })
    await checkBoth(store, [
      [{ type: 'A' }, { added: 1, id: '1 a', test: 1, time: 1 }]
    ])
  })

  test('keeps bytes in actions', factory => async () => {
    let store = factory()
    let action = {
      d: new Uint8Array([1, 2, 3]),
      iv: new Uint8Array(12),
      type: '0'
    }
    await add(store, action, { id: '1 n', reasons: ['a'], time: 1 })

    let [byId] = await store.byId('1 n')
    equal(byId, action)
    ok(byId.d instanceof Uint8Array)

    await store.changeMeta('1 n', { reasons: ['a', 'b'] })
    await store.removeReason(['b'], {}, noop)
    await checkBoth(store, [
      [action, { added: 1, id: '1 n', reasons: ['a'], time: 1 }]
    ])

    let removed = await store.remove('1 n')
    equal(removed[0], action)
    ok(removed[0].d instanceof Uint8Array)
  })

  test('cleans whole store if implemented', factory => async () => {
    let store = factory()
    await Promise.all([
      add(store, { type: 'A' }, { id: '1', time: 1 }),
      add(store, { type: 'B' }, { id: '2', indexes: ['a'], time: 2 }),
      add(store, { type: 'C' }, { id: '3', time: 3 }),
      add(store, { type: 'D' }, { id: '4', indexes: ['a'], time: 4 }),
      add(store, { type: 'E' }, { id: '5', indexes: ['a', 'b'], time: 5 })
    ])
    await store.clean()

    let store2 = factory()
    await Promise.all([
      checkBoth(store2, []),
      checkIndex(store2, 'a', []),
      checkIndex(store2, 'b', []),
      checkLastAdded(store2, 0),
      checkLastSynced(store2, 0, 0)
    ])
  })
}
