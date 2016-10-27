var createTestTimer = require('../create-test-timer')
var MemoryStore = require('../memory-store')
var cleanEvery = require('../clean-every')
var Log = require('../log')

function createLog () {
  return new Log({ timer: createTestTimer(), store: new MemoryStore() })
}

function eventsCount (log) {
  return log.store.created.length
}

function nextTick () {
  return new Promise(function (resolve) {
    setTimeout(resolve, 1)
  })
}

it('cleans log', function () {
  var log = createLog()
  cleanEvery(log, 2)

  return log.add({ type: 'a' }).then(function () {
    expect(eventsCount(log)).toBe(1)
    return log.add({ type: 'a' })
  }).then(nextTick).then(function () {
    expect(eventsCount(log)).toBe(0)
    return log.add({ type: 'a' })
  }).then(function () {
    expect(eventsCount(log)).toBe(1)
    return log.add({ type: 'a' })
  }).then(nextTick).then(function () {
    expect(eventsCount(log)).toBe(0)
  })
})

it('cleans log on next tick', function () {
  var log = createLog()
  cleanEvery(log, 2)

  log.on('event', function () {
    expect(eventsCount(log)).toBeGreaterThan(0)
  })

  return log.add({ type: 'a' }).then(function () {
    return log.add({ type: 'a' })
  })
})

it('uses 100 events by default', function () {
  var log = createLog()
  cleanEvery(log)

  var promises = []
  for (var i = 0; i < 99; i++) {
    promises.push(log.add({ type: 'a' }))
  }

  return Promise.all(promises).then(function () {
    expect(eventsCount(log)).toBe(99)
    return log.add({ type: 'a' })
  }).then(nextTick).then(function () {
    expect(eventsCount(log)).toBe(0)
  })
})
