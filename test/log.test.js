var createTestTimer = require('../create-test-timer')
var MemoryStore = require('../memory-store')
var Log = require('../log')

function createLog () {
  return new Log({ timer: createTestTimer(), store: new MemoryStore() })
}

function nextTick () {
  return new Promise(function (resolve) {
    setTimeout(function () {
      resolve()
    }, 1)
  })
}

function checkEvents (log, expected) {
  var events = []
  log.each(function (event) {
    events.push(event)
  })
  return nextTick().then(function () {
    expect(events).toEqual(expected)
  })
}

it('requires timer', function () {
  expect(function () {
    new Log()
  }).toThrowError(/log timer/)
})

it('requires store', function () {
  expect(function () {
    new Log({ timer: createTestTimer() })
  }).toThrowError(/log store/)
})

it('requires type for events', function () {
  var log = createLog()
  expect(function () {
    log.add({ a: 1 })
  }).toThrowError(/type/)
})

it('requires function listeners', function () {
  var log = createLog()
  expect(function () {
    log.subscribe({ a: 1 })
  }).toThrowError(/listener/)
})

it('requires function keeper', function () {
  var log = createLog()
  expect(function () {
    log.keep({ a: 1 })
  }).toThrowError(/keeper/)
})

it('sends new events to listeners', function () {
  var log = createLog()
  log.add({ type: 'a' })

  var events1 = []
  log.subscribe(function (event) {
    events1.push(event)
  })

  var events2 = []
  log.subscribe(function (event) {
    events2.push(event)
  })

  expect(events1).toEqual([])
  expect(events2).toEqual([])

  var event1 = { type: 'b' }
  var event2 = { type: 'c' }
  log.add(event1)
  log.add(event2)

  expect(events1).toEqual([event1, event2])
  expect(events2).toEqual([event1, event2])
})

it('unsubscribes listeners', function () {
  var log = createLog()

  var events = []
  var unsubscribe = log.subscribe(function (event) {
    events.push(event)
  })

  var event1 = { type: 'a' }
  log.add(event1)

  unsubscribe()
  log.add({ type: 'b' })

  expect(events).toEqual([event1])
})

it('does not fall on multiple unsubscribe call', function () {
  var log = createLog()
  var unsubscribe = log.subscribe(function () { })
  unsubscribe()
  unsubscribe()
})

it('iterates through added events', function () {
  var log = createLog()
  var event1 = { type: 'a' }
  var event2 = { type: 'b' }
  var event3 = { type: 'c' }

  log.add(event1)
  log.add(event2)
  log.add(event3)

  return checkEvents(log, [event3, event2, event1])
})

it('disables iteration on false', function () {
  var log = createLog()
  var event1 = { type: 'a' }
  var event2 = { type: 'b' }

  log.add(event1)
  log.add(event2)

  var events = []
  log.each(function (event) {
    events.push(event)
    return false
  })
  return nextTick().then(function () {
    expect(events).toEqual([event2])
  })
})

it('supports multi-pages stores', function () {
  var store = {
    get: function () {
      return Promise.resolve({
        data: ['a'],
        next: function () {
          return Promise.resolve({ data: ['b'] })
        }
      })
    }
  }
  var log = new Log({ timer: createTestTimer(), store: store })
  return checkEvents(log, ['a', 'b'])
})

it('keeps existed time', function () {
  var log = createLog()
  log.add({ type: 'timed', time: [100] })
  return checkEvents(log, [{ type: 'timed', time: [100] }])
})

it('sets time for timeless events', function () {
  var log = createLog()
  log.add({ type: 'timeless' })
  return checkEvents(log, [{ type: 'timeless', time: [1] }])
})

it('cleans events', function () {
  var log = createLog()
  log.add({ type: 'a' })
  log.clean()
  return checkEvents(log, [])
})

it('keeps events from cleaning', function () {
  var log = createLog()
  var eventB = { type: 'b' }
  log.add({ type: 'a' })
  log.add(eventB)
  log.keep(function (event) {
    return event.type === 'b'
  })
  log.clean()
  return checkEvents(log, [eventB])
})

it('removes keeper', function () {
  var log = createLog()
  log.add({ type: 'a' })
  log.add({ type: 'b' })

  var unkeep = log.keep(function (event) {
    return event.type === 'b'
  })
  log.clean()

  unkeep()
  log.clean()

  return checkEvents(log, [])
})

it('does not fall on multiple unkeep call', function () {
  var log = createLog()
  var unkeep = log.keep(function () { })
  unkeep()
  unkeep()
})
