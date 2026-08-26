/* node:coverage disable */
function ok(value) {
  if (!value) {
    throw new Error('Expected value to be truthy, but got false')
  }
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
  let entries = await all(store.get(opts))
  equal(entries, list)
}

async function checkBoth(store, entries) {
  await Promise.all([
    check(store, { order: 'created' }, entries),
    check(store, { order: 'added' }, entries)
  ])
}

async function checkIndex(store, index, entries) {
  await Promise.all([
    check(store, { index, order: 'created' }, entries),
    check(store, { index, order: 'added' }, entries)
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
      store.add({ type: '1' }, { id: '1 a', time: 1 }),
      store.add({ type: '2' }, { id: '1 c', time: 2 }),
      store.add({ type: '3' }, { id: '1 b', time: 2 }),
      store.add({ type: '4' }, { id: '3 b', time: 2 })
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
      store.add({ type: '1' }, { id: '2 node1', indexes: ['a'], time: 2 }),
      store.add({ type: '2' }, { id: '1 node1', indexes: ['a'], time: 1 }),
      store.add({ type: '3' }, { id: '3 node1', time: 3 })
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
    await Promise.all([
      store.add({ type: '1' }, { id: '1 n', reasons: ['b'], time: 1 }),
      store.add({ type: '2' }, { id: '2 n', reasons: [], time: 2 }),
      store.add({ type: '3' }, { id: '3 n', reasons: ['a'], time: 3 }),
      store.add({ type: '4' }, { id: '4 n', reasons: ['b'], time: 4 }),
      store.add({ type: '5' }, { id: '5 n', reasons: ['a', 'b'], time: 5 })
    ])
    await check(store, { order: 'created', reason: 'a' }, [
      [{ type: '3' }, { added: 3, id: '3 n', reasons: ['a'], time: 3 }],
      [{ type: '5' }, { added: 5, id: '5 n', reasons: ['a', 'b'], time: 5 }]
    ])
    await check(store, { order: 'added', reason: 'a' }, [
      [{ type: '3' }, { added: 3, id: '3 n', reasons: ['a'], time: 3 }],
      [{ type: '5' }, { added: 5, id: '5 n', reasons: ['a', 'b'], time: 5 }]
    ])
    await check(store, { order: 'added', reason: 'b' }, [
      [{ type: '1' }, { added: 1, id: '1 n', reasons: ['b'], time: 1 }],
      [{ type: '4' }, { added: 4, id: '4 n', reasons: ['b'], time: 4 }],
      [{ type: '5' }, { added: 5, id: '5 n', reasons: ['a', 'b'], time: 5 }]
    ])
    await check(store, { order: 'added', reason: 'c' }, [])
  })

  test('returns indexed entries with reason', factory => async () => {
    let store = factory()
    await Promise.all([
      store.add(
        { type: '1' },
        { id: '1 n', indexes: ['a'], reasons: ['a'], time: 1 }
      ),
      store.add(
        { type: '2' },
        { id: '2 n', indexes: ['a'], reasons: ['b'], time: 2 }
      ),
      store.add({ type: '3' }, { id: '3 n', reasons: ['a'], time: 3 })
    ])
    await check(store, { index: 'a', order: 'created', reason: 'a' }, [
      [
        { type: '1' },
        { added: 1, id: '1 n', indexes: ['a'], reasons: ['a'], time: 1 }
      ]
    ])
    await check(store, { index: 'a', order: 'added', reason: 'a' }, [
      [
        { type: '1' },
        { added: 1, id: '1 n', indexes: ['a'], reasons: ['a'], time: 1 }
      ]
    ])
  })

  test('returns latest added', factory => async () => {
    let store = factory()
    await store.add({ type: 'A' }, { id: '1 n', time: 1 })
    let added = await store.getLastAdded()
    ok(added)
    await store.add({ type: 'A' }, { id: '1 n' })
    await checkLastAdded(store, 1)
  })

  test('changes meta', factory => async () => {
    let store = factory()
    await store.add({}, { a: 1, id: '1 n', indexes: ['a'], time: 1 })
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
      store.add({ type: '1' }, { id: '1 node1', time: 1 }),
      store.add({ type: '1' }, { id: '1 node1', time: 1 }),
      store.add({ type: '2' }, { id: '2 node1', time: 2 }),
      store.add({ type: '3' }, { id: '3 node1', time: 3 }),
      store.add({ type: '4' }, { id: '4 node1', time: 4 }),
      store.add({ type: '5' }, { id: '4 node2', time: 4 }),
      store.add({ type: '6' }, { id: '5 node1', time: 5 })
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
      store.add({ type: '1' }, { id: '1 node1', time: 1 }),
      store.add({ type: '2' }, { id: '2 node1', time: 2 }),
      store.add({ type: '3' }, { id: '3 node1', time: 0 })
    ])
    await store.remove('3 node1')
    await checkBoth(store, [
      [{ type: '1' }, { added: 1, id: '1 node1', time: 1 }],
      [{ type: '2' }, { added: 2, id: '2 node1', time: 2 }]
    ])
  })

  test('ignores removing unknown entry', factory => async () => {
    let store = factory()
    await store.add({ type: 'A' }, { added: 1, id: '1 n', time: 1 })
    let result = await store.remove('2 n')
    equal(result, false)
    await check(store, { order: 'created' }, [
      [{ type: 'A' }, { added: 1, id: '1 n', time: 1 }]
    ])
  })

  test('removes entry with indexes', factory => async () => {
    let store = factory()
    await Promise.all([
      store.add({ type: '1' }, { id: '1 node1', time: 1 }),
      store.add({ type: '2' }, { id: '2 node1', indexes: ['a', 'b'], time: 2 }),
      store.add({ type: '3' }, { id: '3 node1', indexes: ['b'], time: 3 })
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
    await Promise.all([
      store.add({ type: '1' }, { id: '1 n', reasons: ['a'], time: 1 }),
      store.add({ type: '2' }, { id: '2 n', reasons: ['a'], time: 2 }),
      store.add({ type: '3' }, { id: '3 n', reasons: ['a', 'b'], time: 3 }),
      store.add({ type: '4' }, { id: '4 n', reasons: ['b'], time: 4 })
    ])
    await store.removeReason(['a'], {}, () => {})
    await checkBoth(store, [
      [{ type: '3' }, { added: 3, id: '3 n', reasons: ['b'], time: 3 }],
      [{ type: '4' }, { added: 4, id: '4 n', reasons: ['b'], time: 4 }]
    ])
  })

  test('removes reason from indexes', factory => async () => {
    let store = factory()
    await Promise.all([
      store.add(
        { type: '1' },
        { id: '1 n', indexes: ['a', 'b'], reasons: ['a'], time: 1 }
      ),
      store.add(
        { type: '2' },
        { id: '2 n', indexes: ['b'], reasons: ['b'], time: 2 }
      )
    ])
    await store.removeReason(['a'], {}, () => {})
    await checkIndex(store, 'a', [])
    await checkIndex(store, 'b', [
      [
        { type: '2' },
        { added: 2, id: '2 n', indexes: ['b'], reasons: ['b'], time: 2 }
      ]
    ])
  })

  test('removes reason by time', factory => async () => {
    let store = factory()
    await Promise.all([
      store.add({ type: '1' }, { id: '1 n', reasons: ['a'], time: 1 }),
      store.add({ type: '2' }, { id: '2 n', reasons: ['a'], time: 2 }),
      store.add({ type: '3' }, { id: '3 n', reasons: ['a'], time: 3 })
    ])
    let m1 = { id: '1 n', time: 1 }
    let m3 = { id: '3 n', time: 3 }
    let criteria = { olderThan: m3, youngerThan: m1 }
    await store.removeReason(['a'], criteria, () => {})
    await checkBoth(store, [
      [{ type: '1' }, { added: 1, id: '1 n', reasons: ['a'], time: 1 }],
      [{ type: '3' }, { added: 3, id: '3 n', reasons: ['a'], time: 3 }]
    ])
  })

  test('removes reason for older action', factory => async () => {
    let store = factory()
    await Promise.all([
      store.add({ type: '1' }, { id: '1 n', reasons: ['a'], time: 1 }),
      store.add({ type: '2' }, { id: '2 n', reasons: ['a'], time: 2 }),
      store.add({ type: '3' }, { id: '3 n', reasons: ['a'], time: 3 })
    ])
    let m2 = { id: '2 n', time: 2 }
    await store.removeReason(['a'], { olderThan: m2 }, () => {})
    await checkBoth(store, [
      [{ type: '2' }, { added: 2, id: '2 n', reasons: ['a'], time: 2 }],
      [{ type: '3' }, { added: 3, id: '3 n', reasons: ['a'], time: 3 }]
    ])
  })

  test('removes reason for younger action', factory => async () => {
    let store = factory()
    await Promise.all([
      store.add({ type: '1' }, { id: '1 n', reasons: ['a'], time: 1 }),
      store.add({ type: '2' }, { id: '2 n', reasons: ['a'], time: 2 }),
      store.add({ type: '3' }, { id: '3 n', reasons: ['a'], time: 3 })
    ])
    let m2 = { id: '2 n', time: 2 }
    await store.removeReason(['a'], { youngerThan: m2 }, () => {})
    await checkBoth(store, [
      [{ type: '1' }, { added: 1, id: '1 n', reasons: ['a'], time: 1 }],
      [{ type: '2' }, { added: 2, id: '2 n', reasons: ['a'], time: 2 }]
    ])
  })

  test('removes reason with minimum added', factory => async () => {
    let store = factory()
    await Promise.all([
      store.add({ type: '1' }, { id: '1 n', reasons: ['a'], time: 1 }),
      store.add({ type: '2' }, { id: '2 n', reasons: ['a'], time: 2 }),
      store.add({ type: '3' }, { id: '3 n', reasons: ['a'], time: 3 })
    ])
    await store.removeReason(['a'], { minAdded: 2 }, () => {})
    await checkBoth(store, [
      [{ type: '1' }, { added: 1, id: '1 n', reasons: ['a'], time: 1 }]
    ])
  })

  test('removes reason with maximum added', factory => async () => {
    let store = factory()
    await Promise.all([
      store.add({ type: '1' }, { id: '1 n', reasons: ['a'], time: 1 }),
      store.add({ type: '2' }, { id: '2 n', reasons: ['a'], time: 2 }),
      store.add({ type: '3' }, { id: '3 n', reasons: ['a'], time: 3 })
    ])
    await store.removeReason(['a'], { maxAdded: 2 }, () => {})
    await checkBoth(store, [
      [{ type: '3' }, { added: 3, id: '3 n', reasons: ['a'], time: 3 }]
    ])
  })

  test('removes reason with minimum and maximum added', factory => async () => {
    let store = factory()
    await Promise.all([
      store.add({ type: '1' }, { id: '1 n', reasons: ['a'], time: 1 }),
      store.add({ type: '2' }, { id: '2 n', reasons: ['a'], time: 2 }),
      store.add({ type: '3' }, { id: '3 n', reasons: ['a'], time: 3 })
    ])
    await store.removeReason(['a'], { maxAdded: 2, minAdded: 2 }, () => {})
    await checkBoth(store, [
      [{ type: '1' }, { added: 1, id: '1 n', reasons: ['a'], time: 1 }],
      [{ type: '3' }, { added: 3, id: '3 n', reasons: ['a'], time: 3 }]
    ])
  })

  test('removes reason with zero at maximum added', factory => async () => {
    let store = factory()
    await store.add({}, { id: '1 n', reasons: ['a'], time: 1 })
    await store.removeReason(['a'], { maxAdded: 0 }, () => {})
    await checkBoth(store, [
      [{}, { added: 1, id: '1 n', reasons: ['a'], time: 1 }]
    ])
  })

  test('removes reasons and actions by id', factory => async () => {
    let store = factory()
    let removed = []
    function push(action) {
      removed.push(action.type)
    }
    await Promise.all([
      store.add({ type: '1' }, { id: '1 n', reasons: ['a'], time: 1 }),
      store.add({ type: '2' }, { id: '2 n', reasons: ['a', 'b'], time: 2 }),
      store.add({ type: '3' }, { id: '3 n', reasons: ['a'], time: 3 })
    ])
    await Promise.all([
      store.removeReason(['a'], { id: '1 n' }, push),
      store.removeReason(['b'], { id: '2 n' }, push),
      store.removeReason(['c'], { id: '3 n' }, push),
      store.removeReason(['a'], { id: '4 n' }, push)
    ])
    equal(removed, ['1'])
    await checkBoth(store, [
      [{ type: '2' }, { added: 2, id: '2 n', reasons: ['a'], time: 2 }],
      [{ type: '3' }, { added: 3, id: '3 n', reasons: ['a'], time: 3 }]
    ])
  })

  test('removes reasons and actions by ids', factory => async () => {
    let store = factory()
    let removed = []
    function push(action) {
      removed.push(action.type)
    }
    await Promise.all([
      store.add({ type: '1' }, { id: '1 n', reasons: ['a'], time: 1 }),
      store.add({ type: '2' }, { id: '2 n', reasons: ['a', 'b'], time: 2 }),
      store.add({ type: '3' }, { id: '3 n', reasons: ['a'], time: 3 }),
      store.add({ type: '4' }, { id: '4 n', reasons: ['a'], time: 4 }),
      store.add({ type: '5' }, { id: '5 n', reasons: ['a'], time: 5 })
    ])
    await store.removeReason(['a'], { ids: ['1 n', '2 n', '4 n', '6 n'] }, push)
    equal(
      removed.toSorted((a, b) => a.localeCompare(b)),
      ['1', '4']
    )
    await checkBoth(store, [
      [{ type: '2' }, { added: 2, id: '2 n', reasons: ['b'], time: 2 }],
      [{ type: '3' }, { added: 3, id: '3 n', reasons: ['a'], time: 3 }],
      [{ type: '5' }, { added: 5, id: '5 n', reasons: ['a'], time: 5 }]
    ])
  })

  test('removes reason by ids from indexes', factory => async () => {
    let store = factory()
    await Promise.all([
      store.add(
        { type: '1' },
        { id: '1 n', indexes: ['a', 'b'], reasons: ['a'], time: 1 }
      ),
      store.add(
        { type: '2' },
        { id: '2 n', indexes: ['b'], reasons: ['a'], time: 2 }
      )
    ])
    await store.removeReason(['a'], { ids: ['1 n'] }, () => {})
    await checkIndex(store, 'a', [])
    await checkIndex(store, 'b', [
      [
        { type: '2' },
        { added: 2, id: '2 n', indexes: ['b'], reasons: ['a'], time: 2 }
      ]
    ])
  })

  test('combines ids with other criteria', factory => async () => {
    let store = factory()
    await Promise.all([
      store.add({ type: '1' }, { id: '1 n', reasons: ['a'], time: 1 }),
      store.add({ type: '2' }, { id: '2 n', reasons: ['a'], time: 2 }),
      store.add({ type: '3' }, { id: '3 n', reasons: ['a'], time: 3 })
    ])
    let criteria = { ids: ['1 n', '3 n'], maxAdded: 2 }
    await store.removeReason(['a'], criteria, () => {})
    await checkBoth(store, [
      [{ type: '2' }, { added: 2, id: '2 n', reasons: ['a'], time: 2 }],
      [{ type: '3' }, { added: 3, id: '3 n', reasons: ['a'], time: 3 }]
    ])
  })

  test('removes reason with empty ids', factory => async () => {
    let store = factory()
    await store.add({ type: '1' }, { id: '1 n', reasons: ['a'], time: 1 })
    await store.removeReason(['a'], { ids: [] }, () => {})
    await checkBoth(store, [
      [{ type: '1' }, { added: 1, id: '1 n', reasons: ['a'], time: 1 }]
    ])
  })

  test('removes many reasons in a single pass', factory => async () => {
    let store = factory()
    let removed = []
    function push(action) {
      removed.push(action.type)
    }
    await Promise.all([
      store.add({ type: '1' }, { id: '1 n', reasons: ['a', 'b'], time: 1 }),
      store.add({ type: '2' }, { id: '2 n', reasons: ['a', 'c'], time: 2 }),
      store.add({ type: '3' }, { id: '3 n', reasons: ['c'], time: 3 })
    ])
    await store.removeReason(['a', 'b'], {}, push)
    equal(removed, ['1'])
    await checkBoth(store, [
      [{ type: '2' }, { added: 2, id: '2 n', reasons: ['c'], time: 2 }],
      [{ type: '3' }, { added: 3, id: '3 n', reasons: ['c'], time: 3 }]
    ])
  })

  test('removes reason by index', factory => async () => {
    let store = factory()
    await Promise.all([
      store.add(
        { type: '1' },
        { id: '1 n', indexes: ['a', 'b'], reasons: ['r'], time: 1 }
      ),
      store.add(
        { type: '2' },
        { id: '2 n', indexes: ['b'], reasons: ['r'], time: 2 }
      ),
      store.add({ type: '3' }, { id: '3 n', reasons: ['r'], time: 3 })
    ])
    await store.removeReason(['r'], { index: 'a' }, () => {})
    await store.removeReason(['r'], { index: 'unknown' }, () => {})
    await checkBoth(store, [
      [
        { type: '2' },
        { added: 2, id: '2 n', indexes: ['b'], reasons: ['r'], time: 2 }
      ],
      [{ type: '3' }, { added: 3, id: '3 n', reasons: ['r'], time: 3 }]
    ])
    await checkIndex(store, 'a', [])
    await checkIndex(store, 'b', [
      [
        { type: '2' },
        { added: 2, id: '2 n', indexes: ['b'], reasons: ['r'], time: 2 }
      ]
    ])
  })

  test('combines index with other criteria', factory => async () => {
    let store = factory()
    await Promise.all([
      store.add(
        { type: '1' },
        { id: '1 n', indexes: ['a'], reasons: ['r'], time: 1 }
      ),
      store.add(
        { type: '2' },
        { id: '2 n', indexes: ['a'], reasons: ['r'], time: 2 }
      ),
      store.add(
        { type: '3' },
        { id: '3 n', indexes: ['a'], reasons: ['r'], time: 3 }
      )
    ])
    await store.removeReason(['r'], { index: 'a', maxAdded: 2 }, () => {})
    await checkIndex(store, 'a', [
      [
        { type: '3' },
        { added: 3, id: '3 n', indexes: ['a'], reasons: ['r'], time: 3 }
      ]
    ])
  })

  test('adds reasons to actions', factory => async () => {
    let store = factory()
    await Promise.all([
      store.add({ type: '1' }, { id: '1 n', reasons: ['a'], time: 1 }),
      store.add({ type: '2' }, { id: '2 n', reasons: ['a'], time: 2 })
    ])
    await store.addReason(['b', 'c'], {})
    let reasons = ['a', 'b', 'c']
    await checkBoth(store, [
      [{ type: '1' }, { added: 1, id: '1 n', reasons, time: 1 }],
      [{ type: '2' }, { added: 2, id: '2 n', reasons, time: 2 }]
    ])
  })

  test('adds reasons by ID', factory => async () => {
    let store = factory()
    await Promise.all([
      store.add({ type: '1' }, { id: '1 n', reasons: ['a'], time: 1 }),
      store.add({ type: '2' }, { id: '2 n', reasons: ['a'], time: 2 })
    ])
    await store.addReason(['b'], { id: '2 n' })
    await store.addReason(['b'], { id: '3 n' })
    await checkBoth(store, [
      [{ type: '1' }, { added: 1, id: '1 n', reasons: ['a'], time: 1 }],
      [{ type: '2' }, { added: 2, id: '2 n', reasons: ['a', 'b'], time: 2 }]
    ])
  })

  test('does not duplicate reasons', factory => async () => {
    let store = factory()
    await store.add({ type: '1' }, { id: '1 n', reasons: ['a'], time: 1 })
    await store.addReason(['a', 'b'], { ids: ['1 n'] })
    await checkBoth(store, [
      [{ type: '1' }, { added: 1, id: '1 n', reasons: ['a', 'b'], time: 1 }]
    ])
  })

  test('removes reason except the index', factory => async () => {
    let store = factory()
    await Promise.all([
      store.add(
        { type: '1' },
        { id: '1 n', indexes: ['a', 'b'], reasons: ['r'], time: 1 }
      ),
      store.add(
        { type: '2' },
        { id: '2 n', indexes: ['a'], reasons: ['r'], time: 2 }
      )
    ])
    await store.removeReason(['r'], { exceptIndex: 'b', index: 'a' }, () => {})
    await checkBoth(store, [
      [
        { type: '1' },
        { added: 1, id: '1 n', indexes: ['a', 'b'], reasons: ['r'], time: 1 }
      ]
    ])
  })

  test('adds reasons except the index', factory => async () => {
    let store = factory()
    await Promise.all([
      store.add(
        { type: '1' },
        { id: '1 n', indexes: ['a', 'b'], reasons: ['r'], time: 1 }
      ),
      store.add(
        { type: '2' },
        { id: '2 n', indexes: ['a'], reasons: ['r'], time: 2 }
      )
    ])
    await store.addReason(['new'], { exceptIndex: 'b', index: 'a' })
    await checkBoth(store, [
      [
        { type: '1' },
        { added: 1, id: '1 n', indexes: ['a', 'b'], reasons: ['r'], time: 1 }
      ],
      [
        { type: '2' },
        {
          added: 2,
          id: '2 n',
          indexes: ['a'],
          reasons: ['r', 'new'],
          time: 2
        }
      ]
    ])
  })

  test('adds reasons by index', factory => async () => {
    let store = factory()
    await Promise.all([
      store.add(
        { type: '1' },
        { id: '1 n', indexes: ['a'], reasons: ['r'], time: 1 }
      ),
      store.add(
        { type: '2' },
        { id: '2 n', indexes: ['b'], reasons: ['r'], time: 2 }
      ),
      store.add({ type: '3' }, { id: '3 n', reasons: ['r'], time: 3 })
    ])
    await store.addReason(['new'], { index: 'a' })
    await store.addReason(['new'], { index: 'unknown' })
    await checkBoth(store, [
      [
        { type: '1' },
        { added: 1, id: '1 n', indexes: ['a'], reasons: ['r', 'new'], time: 1 }
      ],
      [
        { type: '2' },
        { added: 2, id: '2 n', indexes: ['b'], reasons: ['r'], time: 2 }
      ],
      [{ type: '3' }, { added: 3, id: '3 n', reasons: ['r'], time: 3 }]
    ])
  })

  test('checks index on action from ID', factory => async () => {
    let store = factory()
    await Promise.all([
      store.add(
        { type: '1' },
        { id: '1 n', indexes: ['b'], reasons: ['r'], time: 1 }
      ),
      store.add({ type: '2' }, { id: '2 n', reasons: ['r'], time: 2 })
    ])
    await store.addReason(['new'], { id: '1 n', index: 'a' })
    await store.addReason(['new'], { id: '2 n', index: 'a' })
    await checkBoth(store, [
      [
        { type: '1' },
        { added: 1, id: '1 n', indexes: ['b'], reasons: ['r'], time: 1 }
      ],
      [{ type: '2' }, { added: 2, id: '2 n', reasons: ['r'], time: 2 }]
    ])
  })

  test('returns action by ID', factory => async () => {
    let store = factory()
    await Promise.all([
      store.add({ type: 'A' }, { id: '1 node', time: 1 }),
      store.add({ type: 'B' }, { id: '2 node', time: 2 }),
      store.add({ type: 'C' }, { id: '3 node', time: 3 }),
      store.add({ type: 'D' }, { id: '4 node', time: 4 }),
      store.add({ type: 'E' }, { id: '5 node2', time: 5 })
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

  test('ignores entries with same ID', factory => async () => {
    let store = factory()
    let id = '1 a'
    let meta1 = await store.add({ a: 1 }, { id, time: 1 })
    equal(meta1, { added: 1, id, time: 1 })
    let meta2 = await store.add({ a: 2 }, { id, time: 2 })
    ok(!meta2)
    await checkBoth(store, [[{ a: 1 }, { added: 1, id, time: 1 }]])
  })

  test('stores any metadata', factory => async () => {
    let store = factory()
    await store.add({ type: 'A' }, { id: '1 a', test: 1, time: 1 })
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
    await store.add(action, { id: '1 n', reasons: ['a'], time: 1 })

    let [byId] = await store.byId('1 n')
    equal(byId, action)
    ok(byId.d instanceof Uint8Array)

    await store.changeMeta('1 n', { reasons: ['a', 'b'] })
    await store.removeReason(['b'], {}, () => {})
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
      store.add({ type: 'A' }, { id: '1', time: 1 }),
      store.add({ type: 'B' }, { id: '2', indexes: ['a'], time: 2 }),
      store.add({ type: 'C' }, { id: '3', time: 3 }),
      store.add({ type: 'D' }, { id: '4', indexes: ['a'], time: 4 }),
      store.add({ type: 'E' }, { id: '5', indexes: ['a', 'b'], time: 5 })
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
