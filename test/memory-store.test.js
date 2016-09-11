var MemoryStore = require('../memory-store')

function checkContent (store, events) {
  return store.get().then(page => {
    expect(page.data).toEqual(events)
    expect(page.next).toBeUndefined()
  })
}

it('is empty in the beginning', function () {
  var store = new MemoryStore()
  return checkContent(store, [])
})

it('adds first event', function () {
  var store = new MemoryStore()
  store.add({ time: [1] })
  return checkContent(store, [
    { time: [1] }
  ])
})

it('stores evewnts with same times', function () {
  var store = new MemoryStore()
  store.add({ id: 1, time: [1] })
  store.add({ id: 2, time: [1] })
  return checkContent(store, [
    { id: 1, time: [1] },
    { id: 2, time: [1] }
  ])
})

it('stores events sorted', function () {
  var store = new MemoryStore()
  store.add({ time: [3] })
  store.add({ time: [2] })
  store.add({ time: [5] })
  store.add({ time: [1] })
  store.add({ time: [4] })
  return checkContent(store, [
    { time: [5] },
    { time: [4] },
    { time: [3] },
    { time: [2] },
    { time: [1] }
  ])
})

it('sorts events by time as array', function () {
  var store = new MemoryStore()
  store.add({ time: [1, 1, 1] })
  store.add({ time: [2, 1, 1] })
  store.add({ time: [2, 1, 3] })
  store.add({ time: [2, 2, 1] })
  store.add({ time: [2, 1, 2] })
  store.add({ time: [2, 3, 1] })
  store.add({ time: [3, 1, 1] })
  return checkContent(store, [
    { time: [3, 1, 1] },
    { time: [2, 3, 1] },
    { time: [2, 2, 1] },
    { time: [2, 1, 3] },
    { time: [2, 1, 2] },
    { time: [2, 1, 1] },
    { time: [1, 1, 1] }
  ])
})
