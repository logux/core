var MemoryStore = require('../memory-store')

function check (store, type, entries) {
  return store.get(type).then(function (page) {
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

it('removes entries', function () {
  var store = new MemoryStore()
  store.add({ }, { id: [1, 'node', 0], time: 1 })
  store.add({ }, { id: [1, 'node', 1], time: 2 })
  store.add({ }, { id: [3, 'node', 0], time: 3 })
  store.remove([1, 'node', 1])
  return checkBoth(store, [
    [{ }, { id: [3, 'node', 0], time: 3, added: 3 }],
    [{ }, { id: [1, 'node', 0], time: 1, added: 1 }]
  ])
})

it('ignores unknown entry', function () {
  var store = new MemoryStore()
  store.add({ }, { id: [1], time: 1, added: 1 })
  store.remove([2])
  return check(store, 'created', [
    [{ }, { id: [1], time: 1, added: 1 }]
  ])
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

it('does not allow to change ID or added', function () {
  var store = new MemoryStore()
  expect(function () {
    store.changeMeta([1], { id: [2] })
  }).toThrowError(/id is prohibbited/)
  expect(function () {
    store.changeMeta([1], { added: 2 })
  }).toThrowError(/added is prohibbited/)
})
