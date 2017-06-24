var MemoryStore = require('../memory-store')
var eachTest = require('logux-store-tests')

function check (store, order, entries) {
  return store.get({ order: order }).then(function (page) {
    expect(page.entries).toEqual(entries)
    expect(page.next).toBeUndefined()
  })
}

eachTest(function (desc, creator) {
  it(desc, creator(function () { return new MemoryStore() }))
})

it('has synced values set to 0', function () {
  var store = new MemoryStore()
  return store.getLastSynced().then(function (synced) {
    expect(synced).toEqual({ sent: 0, received: 0 })
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

it('supports time array in created', function () {
  var store = new MemoryStore()
  store.add({}, { id: [1, 1, 1], time: 1 })
  store.add({}, { id: [2, 1, 1], time: 2 })
  store.add({}, { id: [2, 1, 3], time: 2 })
  store.add({}, { id: [2, 2, 1], time: 2 })
  store.add({}, { id: [2, 1, 2], time: 2 })
  store.add({}, { id: [2, 3, 1], time: 2 })
  store.add({}, { id: [3, 1, 1], time: 3 })
  return check(store, 'created', [
    [{}, { id: [3, 1, 1], time: 3, added: 7 }],
    [{}, { id: [2, 3, 1], time: 2, added: 6 }],
    [{}, { id: [2, 2, 1], time: 2, added: 4 }],
    [{}, { id: [2, 1, 3], time: 2, added: 3 }],
    [{}, { id: [2, 1, 2], time: 2, added: 5 }],
    [{}, { id: [2, 1, 1], time: 2, added: 2 }],
    [{}, { id: [1, 1, 1], time: 1, added: 1 }]
  ])
})

it('returns current entries state', function () {
  var store = new MemoryStore()
  var promise1 = check(store, 'created', [])
  var promise2 = store.add({ type: 'a' }, { id: [1] })
  return Promise.all([promise1, promise2])
})

it('tells that action already in store', function () {
  var store = new MemoryStore()
  store.add({}, { id: [1, 'node', 0], time: 1 })
  store.add({}, { id: [1, 'node', 1], time: 2 })
  store.add({}, { id: [1, 'node', 2], time: 2 })
  store.add({}, { id: [1, 'node', 3], time: 2 })
  store.add({}, { id: [2, 'node', 0], time: 2 })
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
