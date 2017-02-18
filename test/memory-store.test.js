var MemoryStore = require('../memory-store')

function check (store, order, entries) {
  return store.get({ order: order }).then(function (page) {
    expect(page.entries).toEqual(entries)
    expect(page.next).toBeUndefined()
  })
}

function checkBoth (store, entries) {
  return Promise.all([
    check(store, 'created', entries),
    check(store, 'added', entries)
  ])
}

function nope () { }

it('is empty in the beginning', function () {
  var store = new MemoryStore()
  return check(store, 'created', [])
})

it('has synced values set to 0', function () {
  var store = new MemoryStore()
  return store.getLastSynced().then(function (synced) {
    expect(synced).toEqual({ sent: 0, received: 0 })
  })
})

it('updates latest sent value', function () {
  var store = new MemoryStore()
  return store.setLastSynced({ sent: 1 }).then(function () {
    return store.getLastSynced()
  }).then(function (synced) {
    expect(synced).toEqual({ sent: 1, received: 0 })
  })
})

it('updates both synced values', function () {
  var store = new MemoryStore()
  var value = { received: 1, sent: 2 }
  return store.setLastSynced(value).then(function () {
    return store.getLastSynced()
  }).then(function (synced) {
    expect(synced).toEqual(value)
  })
})

it('adds first entry', function () {
  var store = new MemoryStore()
  store.add({ a: 1 }, { id: [1], time: 1 })
  return check(store, 'created', [
    [{ a: 1 }, { id: [1], time: 1, added: 1 }]
  ])
})

it('stores entries sorted', function () {
  var store = new MemoryStore()
  store.add({ a: 1 }, { id: [1, 'a'], time: 3 })
  store.add({ a: 2 }, { id: [1, 'b'], time: 2 })
  store.add({ a: 3 }, { id: [1, 'c'], time: 5 })
  store.add({ a: 4 }, { id: [1, 'd'], time: 1 })
  store.add({ a: 5 }, { id: [1, 'e'], time: 4 })
  return check(store, 'created', [
    [{ a: 3 }, { id: [1, 'c'], time: 5, added: 3 }],
    [{ a: 5 }, { id: [1, 'e'], time: 4, added: 5 }],
    [{ a: 1 }, { id: [1, 'a'], time: 3, added: 1 }],
    [{ a: 2 }, { id: [1, 'b'], time: 2, added: 2 }],
    [{ a: 4 }, { id: [1, 'd'], time: 1, added: 4 }]
  ]).then(function () {
    return check(store, 'added', [
      [{ a: 5 }, { id: [1, 'e'], time: 4, added: 5 }],
      [{ a: 4 }, { id: [1, 'd'], time: 1, added: 4 }],
      [{ a: 3 }, { id: [1, 'c'], time: 5, added: 3 }],
      [{ a: 2 }, { id: [1, 'b'], time: 2, added: 2 }],
      [{ a: 1 }, { id: [1, 'a'], time: 3, added: 1 }]
    ])
  })
})

it('supports time array in created', function () {
  var store = new MemoryStore()
  store.add({ }, { id: [1, 1, 1], time: 1 })
  store.add({ }, { id: [2, 1, 1], time: 2 })
  store.add({ }, { id: [2, 1, 3], time: 2 })
  store.add({ }, { id: [2, 2, 1], time: 2 })
  store.add({ }, { id: [2, 1, 2], time: 2 })
  store.add({ }, { id: [2, 3, 1], time: 2 })
  store.add({ }, { id: [3, 1, 1], time: 3 })
  return check(store, 'created', [
    [{ }, { id: [3, 1, 1], time: 3, added: 7 }],
    [{ }, { id: [2, 3, 1], time: 2, added: 6 }],
    [{ }, { id: [2, 2, 1], time: 2, added: 4 }],
    [{ }, { id: [2, 1, 3], time: 2, added: 3 }],
    [{ }, { id: [2, 1, 2], time: 2, added: 5 }],
    [{ }, { id: [2, 1, 1], time: 2, added: 2 }],
    [{ }, { id: [1, 1, 1], time: 1, added: 1 }]
  ])
})

it('ignores entries with same ID', function () {
  var store = new MemoryStore()
  return store.add({ a: 1 }, { id: [1, 'node', 1], time: 1 })
    .then(function (result1) {
      expect(result1).toEqual({ id: [1, 'node', 1], time: 1, added: 1 })
      return store.add({ a: 2 }, { id: [1, 'node', 1], time: 2 })
    }).then(function (result2) {
      expect(result2).toBeFalsy()
      return checkBoth(store, [
        [{ a: 1 }, { id: [1, 'node', 1], time: 1, added: 1 }]
      ])
    })
})

it('returns current entries state', function () {
  var store = new MemoryStore()
  var promise1 = check(store, 'created', [])
  var promise2 = store.add({ type: 'a' }, { id: [1] })
  return Promise.all([promise1, promise2])
})

it('returns latest added', function () {
  var store = new MemoryStore()
  store.getLastAdded().then(function (added) {
    expect(added).toBe(added)
    return store.add({ type: 'a' }, { id: [1] })
  }).then(function () {
    return store.getLastAdded()
  }).then(function (added) {
    expect(added).toBe(1)
  })
})

it('changes meta', function () {
  var store = new MemoryStore()
  store.add({ }, { id: [1, 'node', 0], time: 1 })
  store.add({ }, { id: [1, 'node', 1], time: 2, a: 1 })
  store.add({ }, { id: [3, 'node', 0], time: 3 })
  return store.changeMeta([1, 'node', 1], { a: 2, b: 2 }).then(function (res) {
    expect(res).toBeTruthy()
    return checkBoth(store, [
      [{ }, { id: [3, 'node', 0], time: 3, added: 3 }],
      [{ }, { id: [1, 'node', 1], time: 2, added: 2, a: 2, b: 2 }],
      [{ }, { id: [1, 'node', 0], time: 1, added: 1 }]
    ])
  })
})

it('resolves to false on unknown ID in changeMeta', function () {
  var store = new MemoryStore()
  return store.changeMeta([1], { a: 1 }).then(function (res) {
    expect(res).toBeFalsy()
  })
})

it('tells that action already in store', function () {
  var store = new MemoryStore()
  store.add({ }, { id: [1, 'node', 0], time: 1 })
  store.add({ }, { id: [1, 'node', 1], time: 2 })
  store.add({ }, { id: [1, 'node', 2], time: 2 })
  store.add({ }, { id: [1, 'node', 3], time: 2 })
  store.add({ }, { id: [2, 'node', 0], time: 2 })
  return store.has([1, 'node', 0]).then(function (result) {
    expect(result).toBeTruthy()
    return store.has([1, 'node', 2])
  }).then(function (result) {
    expect(result).toBeTruthy()
    return store.has([2, 'node', 1])
  }).then(function (result) {
    expect(result).toBeFalsy()
  })
})

it('removes reasons and actions without reason', function () {
  var store = new MemoryStore()
  store.add({ type: '1' }, { id: [1], time: 1, reasons: ['a'] })
  store.add({ type: '2' }, { id: [2], time: 2, reasons: ['a'] })
  store.add({ type: '3' }, { id: [3], time: 3, reasons: ['a', 'b'] })
  store.add({ type: '4' }, { id: [4], time: 4, reasons: ['b'] })
  var removed = []
  return store.removeReason('a', { }, function (action, meta) {
    removed.push([action, meta])
  }).then(function () {
    expect(removed).toEqual([
      [{ type: '2' }, { added: 2, id: [2], time: 2, reasons: [] }],
      [{ type: '1' }, { added: 1, id: [1], time: 1, reasons: [] }]
    ])
    return checkBoth(store, [
      [{ type: '4' }, { added: 4, id: [4], time: 4, reasons: ['b'] }],
      [{ type: '3' }, { added: 3, id: [3], time: 3, reasons: ['b'] }]
    ])
  })
})

it('removes reason with minimum added', function () {
  var store = new MemoryStore()
  store.add({ type: '1' }, { id: [1], time: 1, reasons: ['a'] })
  store.add({ type: '2' }, { id: [2], time: 2, reasons: ['a'] })
  store.add({ type: '3' }, { id: [3], time: 3, reasons: ['a'] })
  return store.removeReason('a', { minAdded: 2 }, nope).then(function () {
    return checkBoth(store, [
      [{ type: '1' }, { added: 1, id: [1], time: 1, reasons: ['a'] }]
    ])
  })
})

it('removes reason with maximum added', function () {
  var store = new MemoryStore()
  store.add({ type: '1' }, { id: [1], time: 1, reasons: ['a'] })
  store.add({ type: '2' }, { id: [2], time: 2, reasons: ['a'] })
  store.add({ type: '3' }, { id: [3], time: 3, reasons: ['a'] })
  return store.removeReason('a', { maxAdded: 2 }, nope).then(function () {
    return checkBoth(store, [
      [{ type: '3' }, { added: 3, id: [3], time: 3, reasons: ['a'] }]
    ])
  })
})

it('removes reason with minimum and maximum added', function () {
  var store = new MemoryStore()
  store.add({ type: '1' }, { id: [1], time: 1, reasons: ['a'] })
  store.add({ type: '2' }, { id: [2], time: 2, reasons: ['a'] })
  store.add({ type: '3' }, { id: [3], time: 3, reasons: ['a'] })
  return store.removeReason('a', { maxAdded: 2, minAdded: 2 }, nope)
    .then(function () {
      return checkBoth(store, [
        [{ type: '3' }, { added: 3, id: [3], time: 3, reasons: ['a'] }],
        [{ type: '1' }, { added: 1, id: [1], time: 1, reasons: ['a'] }]
      ])
    })
})

it('removes reason with zero at maximum added', function () {
  var store = new MemoryStore()
  store.add({ type: '1' }, { id: [1], time: 1, reasons: ['a'] })
  return store.removeReason('a', { maxAdded: 0 }, nope).then(function () {
    return checkBoth(store, [
      [{ type: '1' }, { added: 1, id: [1], time: 1, reasons: ['a'] }]
    ])
  })
})

it('removes entries', function () {
  var store = new MemoryStore()
  store.add({ type: '1' }, { id: [1, 'node1', 0], time: 1 })
  store.add({ type: '2' }, { id: [1, 'node1', 1], time: 2 })
  store.add({ type: '3' }, { id: [1, 'node1', 2], time: 2 })
  store.add({ type: '4' }, { id: [1, 'node1', 3], time: 2 })
  store.add({ type: '5' }, { id: [1, 'node2', 0], time: 2 })
  store.add({ type: '6' }, { id: [4, 'node1', 0], time: 4 })
  store.remove([1, 'node1', 2]).then(function (result) {
    expect(result).toEqual([
      { type: '3' }, { id: [1, 'node1', 2], time: 2, added: 3 }
    ])
    return checkBoth(store, [
      [{ type: '6' }, { id: [4, 'node1', 0], time: 4, added: 6 }],
      [{ type: '5' }, { id: [1, 'node2', 0], time: 2, added: 5 }],
      [{ type: '4' }, { id: [1, 'node1', 3], time: 2, added: 4 }],
      [{ type: '2' }, { id: [1, 'node1', 1], time: 2, added: 2 }],
      [{ type: '1' }, { id: [1, 'node1', 0], time: 1, added: 1 }]
    ])
  })
})

it('ignores unknown entry', function () {
  var store = new MemoryStore()
  store.add({ }, { id: [1], time: 1, added: 1 })
  store.remove([2]).then(function (result) {
    expect(result).toBeFalsy()
    return check(store, 'created', [
      [{ }, { id: [1], time: 1, added: 1 }]
    ])
  })
})
