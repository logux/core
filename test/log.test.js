var createTestTimer = require('../create-test-timer')
var MemoryStore = require('../memory-store')
var Log = require('../log')

function createLog () {
  return new Log({ timer: createTestTimer(), store: new MemoryStore() })
}

function checkEvents (log, expected) {
  var events = log.store.created.map(function (entry) {
    return entry[0]
  })
  expect(events).toEqual(expected)
}

function checkEntries (log, expected) {
  expect(log.store.created).toEqual(expected)
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
  log.subscribe(function (event, meta) {
    expect(typeof meta).toEqual('object')
    events1.push(event)
  })

  var events2 = []
  log.subscribe(function (event) {
    events2.push(event)
  })

  expect(events1).toEqual([])
  expect(events2).toEqual([])

  log.add({ type: 'b' })
  log.add({ type: 'c' })

  expect(events1).toEqual([{ type: 'b' }, { type: 'c' }])
  expect(events2).toEqual(events1)
})

it('unsubscribes listeners', function () {
  var log = createLog()

  var events = []
  var unsubscribe = log.subscribe(function (event) {
    events.push(event)
  })

  log.add({ type: 'a' })
  unsubscribe()
  log.add({ type: 'b' })

  expect(events).toEqual([{ type: 'a' }])
})

it('does not fall on multiple unsubscribe call', function () {
  var log = createLog()
  var unsubscribe = log.subscribe(function () { })
  unsubscribe()
  unsubscribe()
})

it('iterates through added events', function () {
  var log = createLog()

  log.add({ type: 'a' }, { created: [3] })
  log.add({ type: 'b' }, { created: [2] })
  log.add({ type: 'c' }, { created: [1] })

  var entries = []
  return log.each(function (event, meta) {
    entries.push([event, meta])
  }).then(function () {
    expect(entries).toEqual([
      [{ type: 'a' }, { created: [3], added: 1 }],
      [{ type: 'b' }, { created: [2], added: 2 }],
      [{ type: 'c' }, { created: [1], added: 3 }]
    ])
  })
})

it('iterates by added order', function () {
  var log = createLog()

  log.add({ type: 'a' }, { created: [3] })
  log.add({ type: 'b' }, { created: [2] })
  log.add({ type: 'c' }, { created: [1] })

  var events = []
  return log.each({ order: 'added' }, function (event) {
    events.push(event)
  }).then(function () {
    expect(events).toEqual([
      { type: 'c' },
      { type: 'b' },
      { type: 'a' }
    ])
  })
})

it('disables iteration on false', function () {
  var log = createLog()

  log.add({ type: 'a' })
  log.add({ type: 'b' })

  var events = []
  return log.each(function (event) {
    events.push(event)
    return false
  }).then(function () {
    expect(events).toEqual([{ type: 'b' }])
  })
})

it('supports multi-pages stores', function () {
  var store = {
    get: function () {
      return Promise.resolve({
        data: [['a', 'a']],
        next: function () {
          return Promise.resolve({ data: [['b', 'b']] })
        }
      })
    }
  }
  var log = new Log({ timer: createTestTimer(), store: store })

  var events = []
  return log.each(function (event) {
    events.push(event)
  }).then(function () {
    expect(events).toEqual(['a', 'b'])
  })
})

it('keeps existed time', function () {
  var log = createLog()
  log.add({ type: 'timed' }, { created: [100] })
  checkEntries(log, [
    [{ type: 'timed' }, { created: [100], added: 1 }]
  ])
})

it('sets time for timeless events', function () {
  var log = createLog()
  log.add({ type: 'timeless' })
  checkEntries(log, [
    [{ type: 'timeless' }, { created: [1], added: 1 }]
  ])
})

it('cleans events', function () {
  var log = createLog()
  log.add({ type: 'a' })
  return log.clean().then(function () {
    checkEntries(log, [])
  })
})

it('keeps events from cleaning', function () {
  var log = createLog()
  log.add({ type: 'a' })
  log.add({ type: 'b' })
  log.keep(function (event) {
    return event.type === 'b'
  })
  return log.clean().then(function () {
    checkEvents(log, [{ type: 'b' }])
  })
})

it('removes keeper', function () {
  var log = createLog()
  log.add({ type: 'a' })
  log.add({ type: 'b' })

  var unkeep = log.keep(function (event) {
    return event.type === 'b'
  })
  return log.clean().then(function () {
    checkEvents(log, [{ type: 'b' }])
    unkeep()
    log.clean().then(function () {
      checkEvents(log, [])
    })
  })
})

it('does not fall on multiple unkeep call', function () {
  var log = createLog()
  var unkeep = log.keep(function () { })
  unkeep()
  unkeep()
})
