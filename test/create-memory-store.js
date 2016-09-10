var test = require('ava')

var createMemoryStore = require('../create-memory-store')

function checkContent (t, store, events) {
  return store.get().then(page => {
    t.deepEqual(page.data, events)
    t.deepEqual(typeof page.next, 'undefined')
  })
}

test('is empty in the beginning', t => {
  var store = createMemoryStore()
  return checkContent(t, store, [])
})

test('adds first event', t => {
  var store = createMemoryStore()
  store.add({ time: [1] })
  return checkContent(t, store, [
    { time: [1] }
  ])
})

test('stores events sorted', t => {
  var store = createMemoryStore()
  store.add({ time: [3] })
  store.add({ time: [2] })
  store.add({ time: [5] })
  store.add({ time: [1] })
  store.add({ time: [4] })
  return checkContent(t, store, [
    { time: [5] },
    { time: [4] },
    { time: [3] },
    { time: [2] },
    { time: [1] }
  ])
})

test('sorts events by time as array', t => {
  var store = createMemoryStore()
  store.add({ time: [1, 1, 1] })
  store.add({ time: [2, 1, 1] })
  store.add({ time: [2, 1, 3] })
  store.add({ time: [2, 2, 1] })
  store.add({ time: [2, 1, 2] })
  store.add({ time: [2, 3, 1] })
  store.add({ time: [3, 1, 1] })
  return checkContent(t, store, [
    { time: [3, 1, 1] },
    { time: [2, 3, 1] },
    { time: [2, 2, 1] },
    { time: [2, 1, 3] },
    { time: [2, 1, 2] },
    { time: [2, 1, 1] },
    { time: [1, 1, 1] }
  ])
})
