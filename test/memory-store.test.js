var MemoryStore = require('../memory-store')

function checkContent (store, created, added) {
  return store.get('created').then(function (page) {
    expect(page.data).toEqual(created)
    expect(page.next).toBeUndefined()
  }).then(function () {
    return store.get('added').then(function (page) {
      expect(page.data).toEqual(added)
      expect(page.next).toBeUndefined()
    })
  })
}

it('is empty in the beginning', function () {
  var store = new MemoryStore()
  return checkContent(store, [], [])
})

it('adds first event', function () {
  var store = new MemoryStore()
  store.add([{ a: 1 }, { created: [1], added: [1] }])
  return checkContent(store, [
    [{ a: 1 }, { created: [1], added: [1] }]
  ], [
    [{ a: 1 }, { created: [1], added: [1] }]
  ])
})

it('stores events sorted', function () {
  var store = new MemoryStore()
  store.add([{ a: 1 }, { created: [3], added: 2 }])
  store.add([{ a: 2 }, { created: [2], added: 3 }])
  store.add([{ a: 3 }, { created: [5], added: 1 }])
  store.add([{ a: 4 }, { created: [1], added: 4 }])
  store.add([{ a: 5 }, { created: [4], added: 5 }])
  return checkContent(store, [
    [{ a: 3 }, { created: [5], added: 1 }],
    [{ a: 5 }, { created: [4], added: 5 }],
    [{ a: 1 }, { created: [3], added: 2 }],
    [{ a: 2 }, { created: [2], added: 3 }],
    [{ a: 4 }, { created: [1], added: 4 }]
  ], [
    [{ a: 5 }, { created: [4], added: 5 }],
    [{ a: 4 }, { created: [1], added: 4 }],
    [{ a: 2 }, { created: [2], added: 3 }],
    [{ a: 1 }, { created: [3], added: 2 }],
    [{ a: 3 }, { created: [5], added: 1 }]
  ])
})

it('support time array in created', function () {
  var store = new MemoryStore()
  store.add([{ }, { created: [1, 1, 1], added: 1 }])
  store.add([{ }, { created: [2, 1, 1], added: 2 }])
  store.add([{ }, { created: [2, 1, 3], added: 4 }])
  store.add([{ }, { created: [2, 2, 1], added: 5 }])
  store.add([{ }, { created: [2, 1, 2], added: 3 }])
  store.add([{ }, { created: [2, 3, 1], added: 6 }])
  store.add([{ }, { created: [3, 1, 1], added: 7 }])
  return checkContent(store, [
    [{ }, { created: [3, 1, 1], added: 7 }],
    [{ }, { created: [2, 3, 1], added: 6 }],
    [{ }, { created: [2, 2, 1], added: 5 }],
    [{ }, { created: [2, 1, 3], added: 4 }],
    [{ }, { created: [2, 1, 2], added: 3 }],
    [{ }, { created: [2, 1, 1], added: 2 }],
    [{ }, { created: [1, 1, 1], added: 1 }]
  ], [
    [{ }, { created: [3, 1, 1], added: 7 }],
    [{ }, { created: [2, 3, 1], added: 6 }],
    [{ }, { created: [2, 2, 1], added: 5 }],
    [{ }, { created: [2, 1, 3], added: 4 }],
    [{ }, { created: [2, 1, 2], added: 3 }],
    [{ }, { created: [2, 1, 1], added: 2 }],
    [{ }, { created: [1, 1, 1], added: 1 }]
  ])
})

it('removes events', function () {
  var store = new MemoryStore()
  store.add([{ }, { created: [1], added: 1 }])
  store.add([{ }, { created: [2], added: 2 }])
  store.add([{ }, { created: [3], added: 3 }])
  store.remove([{ }, { created: [2], added: 2 }])
  return checkContent(store, [
    [{ }, { created: [3], added: 3 }],
    [{ }, { created: [1], added: 1 }]
  ], [
    [{ }, { created: [3], added: 3 }],
    [{ }, { created: [1], added: 1 }]
  ])
})
