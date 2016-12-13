var MemoryStore = require('../memory-store')

function checkCreated (store, created) {
  return store.get('created').then(function (page) {
    expect(page.entries).toEqual(created)
    expect(page.next).toBeUndefined()
  })
}

it('is empty in the beginning', function () {
  var store = new MemoryStore()
  return checkCreated(store, [])
})

it('adds first event', function () {
  var store = new MemoryStore()
  store.add([{ a: 1 }, { id: [1], added: [1] }])
  return checkCreated(store, [
    [{ a: 1 }, { id: [1], added: [1] }]
  ])
})

it('stores events sorted', function () {
  var store = new MemoryStore()
  store.add([{ a: 1 }, { id: [3], added: 1 }])
  store.add([{ a: 2 }, { id: [2], added: 2 }])
  store.add([{ a: 3 }, { id: [5], added: 3 }])
  store.add([{ a: 4 }, { id: [1], added: 4 }])
  store.add([{ a: 5 }, { id: [4], added: 5 }])
  return checkCreated(store, [
    [{ a: 3 }, { id: [5], added: 3 }],
    [{ a: 5 }, { id: [4], added: 5 }],
    [{ a: 1 }, { id: [3], added: 1 }],
    [{ a: 2 }, { id: [2], added: 2 }],
    [{ a: 4 }, { id: [1], added: 4 }]
  ]).then(function () {
    return store.get('added').then(function (page) {
      expect(page.entries).toEqual([
        [{ a: 5 }, { id: [4], added: 5 }],
        [{ a: 4 }, { id: [1], added: 4 }],
        [{ a: 3 }, { id: [5], added: 3 }],
        [{ a: 2 }, { id: [2], added: 2 }],
        [{ a: 1 }, { id: [3], added: 1 }]
      ])
      expect(page.next).toBeUndefined()
    })
  })
})

it('support time array in created', function () {
  var store = new MemoryStore()
  store.add([{ }, { id: [1, 1, 1], added: 1 }])
  store.add([{ }, { id: [2, 1, 1], added: 2 }])
  store.add([{ }, { id: [2, 1, 3], added: 4 }])
  store.add([{ }, { id: [2, 2, 1], added: 5 }])
  store.add([{ }, { id: [2, 1, 2], added: 3 }])
  store.add([{ }, { id: [2, 3, 1], added: 6 }])
  store.add([{ }, { id: [3, 1, 1], added: 7 }])
  return checkCreated(store, [
    [{ }, { id: [3, 1, 1], added: 7 }],
    [{ }, { id: [2, 3, 1], added: 6 }],
    [{ }, { id: [2, 2, 1], added: 5 }],
    [{ }, { id: [2, 1, 3], added: 4 }],
    [{ }, { id: [2, 1, 2], added: 3 }],
    [{ }, { id: [2, 1, 1], added: 2 }],
    [{ }, { id: [1, 1, 1], added: 1 }]
  ])
})

it('ignores event with same time', function () {
  var store = new MemoryStore()

  return store.add([{ a: 1 }, { id: [1], added: [1] }])
    .then(function (result1) {
      expect(result1).toBeTruthy()
      return store.add([{ a: 2 }, { id: [1], added: [2] }])
    }).then(function (result2) {
      expect(result2).toBeFalsy()
      return checkCreated(store, [
        [{ a: 1 }, { id: [1], added: [1] }]
      ])
    })
})

it('removes events', function () {
  var store = new MemoryStore()
  store.add([{ }, { id: [1], added: 1 }])
  store.add([{ }, { id: [2], added: 2 }])
  store.add([{ }, { id: [3], added: 3 }])
  store.add([{ }, { id: [4], added: 4 }])
  store.add([{ }, { id: [5], added: 5 }])
  store.remove([2])
  return checkCreated(store, [
    [{ }, { id: [5], added: 5 }],
    [{ }, { id: [4], added: 4 }],
    [{ }, { id: [3], added: 3 }],
    [{ }, { id: [1], added: 1 }]
  ])
})

it('ignores unknown event', function () {
  var store = new MemoryStore()
  store.add([{ }, { id: [1], added: 1 }])
  store.remove([2])
  return checkCreated(store, [
    [{ }, { id: [1], added: 1 }]
  ])
})

it('returns current events state', function () {
  var store = new MemoryStore()
  var promise1 = checkCreated(store, [])
  var promise2 = store.add([{ type: 'a' }, { id: [1], added: 1 }])
  return Promise.all([promise1, promise2])
})
