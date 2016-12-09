var fakeIndexedDB = require('fake-indexeddb')

window.indexedDB = fakeIndexedDB

var IndexedDBStore = require('../indexeddb-store')

var testDB

afterEach(function () {
  testDB.close()
  fakeIndexedDB.deleteDatabase('logux_db')
})

function checkCreated (store, created) {
  return store.get('created').then(function (page) {
    expect(page.entries).toEqual(created)
    expect(page.next).toBeUndefined()
  })
}

it('is empty in the beginning', function () {
  var store = new IndexedDBStore()
  return store.init().then(function () {
    testDB = store.db
    return checkCreated(store, [])
  }).catch(function (err) {
    console.error(err)
  })
})

it('adds first event', function () {
  var store = new IndexedDBStore()
  return store.init().then(function () {
    testDB = store.db
    var entry = [{ a: 1, type: 'test' }, { created: [1], added: [1] }]
    return store.add(entry).then(function () {
      return checkCreated(store, [entry])
    })
  })
})

it('stores events sorted', function () {
  var store = new IndexedDBStore()
  return store.init().then(function () {
    testDB = store.db
    store.add([{ a: 1, type: 'test' }, { created: [3], added: 1 }])
    store.add([{ a: 2, type: 'test' }, { created: [2], added: 2 }])
    store.add([{ a: 3, type: 'test' }, { created: [5], added: 3 }])
    store.add([{ a: 4, type: 'test' }, { created: [1], added: 4 }])
    store.add([{ a: 5, type: 'test' }, { created: [4], added: 5 }])
    return checkCreated(store, [
      [{ a: 3, type: 'test' }, { created: [5], added: 3 }],
      [{ a: 5, type: 'test' }, { created: [4], added: 5 }],
      [{ a: 1, type: 'test' }, { created: [3], added: 1 }],
      [{ a: 2, type: 'test' }, { created: [2], added: 2 }],
      [{ a: 4, type: 'test' }, { created: [1], added: 4 }]
    ]).then(function () {
      return store.get('added').then(function (page) {
        expect(page.entries).toEqual([
          [{ a: 5, type: 'test' }, { created: [4], added: 5 }],
          [{ a: 4, type: 'test' }, { created: [1], added: 4 }],
          [{ a: 3, type: 'test' }, { created: [5], added: 3 }],
          [{ a: 2, type: 'test' }, { created: [2], added: 2 }],
          [{ a: 1, type: 'test' }, { created: [3], added: 1 }]
        ])
        expect(page.next).toBeUndefined()
      })
    })
  })
})

it('support time array in created', function () {
  var store = new IndexedDBStore()
  return store.init().then(function () {
    testDB = store.db
    store.add([{ type: 'test' }, { created: [1, 1, 1], added: 1 }])
    store.add([{ type: 'test' }, { created: [2, 1, 1], added: 2 }])
    store.add([{ type: 'test' }, { created: [2, 1, 3], added: 4 }])
    store.add([{ type: 'test' }, { created: [2, 2, 1], added: 5 }])
    store.add([{ type: 'test' }, { created: [2, 1, 2], added: 3 }])
    store.add([{ type: 'test' }, { created: [2, 3, 1], added: 6 }])
    store.add([{ type: 'test' }, { created: [3, 1, 1], added: 7 }])
    return checkCreated(store, [
      [{ type: 'test' }, { created: [3, 1, 1], added: 7 }],
      [{ type: 'test' }, { created: [2, 3, 1], added: 6 }],
      [{ type: 'test' }, { created: [2, 2, 1], added: 5 }],
      [{ type: 'test' }, { created: [2, 1, 3], added: 4 }],
      [{ type: 'test' }, { created: [2, 1, 2], added: 3 }],
      [{ type: 'test' }, { created: [2, 1, 1], added: 2 }],
      [{ type: 'test' }, { created: [1, 1, 1], added: 1 }]
    ])
  })
})

it('ignores event with same time', function () {
  var store = new IndexedDBStore()

  return store.init().then(function () {
    testDB = store.db
    return store.add([{ a: 1, type: 'test' }, { created: [1], added: 1 }])
      .then(function (result1) {
        expect(result1).toBeTruthy()
        return store.add([{ a: 2, type: 'test' }, { created: [1], added: 2 }])
      }).then(function (result2) {
        expect(result2).toBeFalsy()
        return checkCreated(store, [
          [{ a: 1, type: 'test' }, { created: [1], added: 1 }]
        ])
      })
  })
})

it('removes events', function () {
  var store = new IndexedDBStore()
  return store.init().then(function () {
    testDB = store.db
    store.add([{ type: 'test' }, { created: [1], added: 1 }])
    store.add([{ type: 'test' }, { created: [2], added: 2 }])
    store.add([{ type: 'test' }, { created: [3], added: 3 }])
    store.add([{ type: 'test' }, { created: [4], added: 4 }])
    store.add([{ type: 'test' }, { created: [5], added: 5 }])
    return store.remove([2]).then(function () {
      return checkCreated(store, [
        [{ type: 'test' }, { created: [5], added: 5 }],
        [{ type: 'test' }, { created: [4], added: 4 }],
        [{ type: 'test' }, { created: [3], added: 3 }],
        [{ type: 'test' }, { created: [1], added: 1 }]
      ])
    })
  })
})

it('ignores unknown event', function () {
  var store = new IndexedDBStore()
  return store.init().then(function () {
    testDB = store.db
    store.add([{ type: 'test' }, { created: [1], added: 1 }])
    store.remove([2])
    return checkCreated(store, [
      [{ type: 'test' }, { created: [1], added: 1 }]
    ])
  })
})

it('returns current events state', function () {
  var store = new IndexedDBStore()
  return store.init().then(function () {
    testDB = store.db
    var promise1 = checkCreated(store, [])
    var promise2 = store.add([{ type: 'a' }, { created: [1], added: 1 }])
    return Promise.all([promise1, promise2])
  })
})

it('searches event properly', function () {
  var store = new IndexedDBStore()
  return store.init().then(function () {
    testDB = store.db
    var entry = [{ type: 'test' }, { created: [1], added: 1 }]
    store.add(entry)
    return store.search([1]).then(function (res) {
      return expect(entry).toEqual(res)
    })
  })
})

it('initialized db resolved without reopening', function () {
  var store = new IndexedDBStore()
  return store.init().then(function () {
    testDB = store.db
    return store.init().then(function (sameStore) {
      return expect(sameStore.db).toEqual(store.db)
    })
  })
})

it('get returns page by size', function () {
  var store = new IndexedDBStore()
  return store.init().then(function () {
    testDB = store.db
    store.add([{ type: 'test' }, { created: [1], added: 1 }])
    store.add([{ type: 'test' }, { created: [2], added: 2 }])
    store.add([{ type: 'test' }, { created: [3], added: 3 }])
    store.add([{ type: 'test' }, { created: [4], added: 4 }])
    store.add([{ type: 'test' }, { created: [5], added: 5 }])
    return store.get('created', 4).then(function (res) {
      return expect(res.entries.length).toEqual(4)
    })
  })
})
