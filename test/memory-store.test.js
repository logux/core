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

it('has synced properties set to 0', function () {
  var store = new MemoryStore()
  return store.getLatestSynced(function (synced) {
    expect(synced).toEqual({
      latestSent: 0,
      latestReceived: 0
    })
  })
})

it('stores latestReceived value', function () {
  var store = new MemoryStore()
  return store.setLatestSynced({ latestReceived: 1 }).then(function () {
    expect(store.latestReceived).toEqual(1)
  })
})

it('stores latestSent value', function () {
  var store = new MemoryStore()
  return store.setLatestSynced({ latestSent: 1 }).then(function () {
    expect(store.latestSent).toEqual(1)
  })
})

it('stores both sync values', function () {
  var store = new MemoryStore()
  var synced = { latestReceived: 1, latestSent: 2 }
  return store.setLatestSynced(synced).then(function () {
    expect(store.latestReceived).toEqual(1)
    expect(store.latestSent).toEqual(2)
  })
})

it('gets synced properties of store', function () {
  var store = new MemoryStore()
  var synced = { latestReceived: 1, latestSent: 2 }
  return store.setLatestSynced(synced).then(function () {
    return store.getLatestSynced().then(function (syncedVals) {
      expect(syncedVals).toEqual(synced)
    })
  })
})

it('adds first entry', function () {
  var store = new MemoryStore()
  store.add({ a: 1 }, { id: [1], time: 1, added: [1] })
  return check(store, 'created', [
    [{ a: 1 }, { id: [1], time: 1, added: [1] }]
  ])
})

it('stores entries sorted', function () {
  var store = new MemoryStore()
  store.add({ a: 1 }, { id: [1, 'a'], time: 3, added: 1 })
  store.add({ a: 2 }, { id: [1, 'b'], time: 2, added: 2 })
  store.add({ a: 3 }, { id: [1, 'c'], time: 5, added: 3 })
  store.add({ a: 4 }, { id: [1, 'd'], time: 1, added: 4 })
  store.add({ a: 5 }, { id: [1, 'e'], time: 4, added: 5 })
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

it('support time array in created', function () {
  var store = new MemoryStore()
  store.add({ }, { id: [1, 1, 1], time: 1, added: 1 })
  store.add({ }, { id: [2, 1, 1], time: 2, added: 2 })
  store.add({ }, { id: [2, 1, 3], time: 2, added: 4 })
  store.add({ }, { id: [2, 2, 1], time: 2, added: 5 })
  store.add({ }, { id: [2, 1, 2], time: 2, added: 3 })
  store.add({ }, { id: [2, 3, 1], time: 2, added: 6 })
  store.add({ }, { id: [3, 1, 1], time: 3, added: 7 })
  return check(store, 'created', [
    [{ }, { id: [3, 1, 1], time: 3, added: 7 }],
    [{ }, { id: [2, 3, 1], time: 2, added: 6 }],
    [{ }, { id: [2, 2, 1], time: 2, added: 5 }],
    [{ }, { id: [2, 1, 3], time: 2, added: 4 }],
    [{ }, { id: [2, 1, 2], time: 2, added: 3 }],
    [{ }, { id: [2, 1, 1], time: 2, added: 2 }],
    [{ }, { id: [1, 1, 1], time: 1, added: 1 }]
  ])
})

it('ignores entries with same ID', function () {
  var store = new MemoryStore()
  return store.add({ a: 1 }, { id: [1], time: 1, added: [1] })
    .then(function (result1) {
      expect(result1).toBeTruthy()
      return store.add({ a: 2 }, { id: [1], time: 2, added: [2] })
    }).then(function (result2) {
      expect(result2).toBeFalsy()
      return checkBoth(store, [
        [{ a: 1 }, { id: [1], time: 1, added: [1] }]
      ])
    })
})

it('removes entries', function () {
  var store = new MemoryStore()
  store.add({ }, { id: [1], time: 1, added: 1 })
  store.add({ }, { id: [2], time: 2, added: 2 })
  store.add({ }, { id: [3], time: 3, added: 3 })
  store.add({ }, { id: [4], time: 4, added: 4 })
  store.remove([2])
  return checkBoth(store, [
    [{ }, { id: [4], time: 4, added: 4 }],
    [{ }, { id: [3], time: 3, added: 3 }],
    [{ }, { id: [1], time: 1, added: 1 }]
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
  var promise2 = store.add({ type: 'a' }, { id: [1], added: 1 })
  return Promise.all([promise1, promise2])
})
