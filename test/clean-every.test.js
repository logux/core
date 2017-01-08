var cleanEvery = require('../clean-every')
var TestTime = require('../test-time')

function entriesCount (log) {
  return log.store.created.length
}

function nextTick () {
  return new Promise(function (resolve) {
    setTimeout(resolve, 1)
  })
}

it('cleans log', function () {
  var log = TestTime.getLog()
  cleanEvery(log, 2)

  return log.add({ type: 'a' }).then(function () {
    expect(entriesCount(log)).toBe(1)
    return log.add({ type: 'a' })
  }).then(nextTick).then(function () {
    expect(entriesCount(log)).toBe(0)
    return log.add({ type: 'a' })
  }).then(function () {
    expect(entriesCount(log)).toBe(1)
    return log.add({ type: 'a' })
  }).then(nextTick).then(function () {
    expect(entriesCount(log)).toBe(0)
  })
})

it('cleans log on next tick', function () {
  var log = TestTime.getLog()
  cleanEvery(log, 2)

  log.on('add', function () {
    expect(entriesCount(log)).toBeGreaterThan(0)
  })

  return log.add({ type: 'a' }).then(function () {
    return log.add({ type: 'a' })
  })
})

it('uses 100 entries by default', function () {
  var log = TestTime.getLog()
  cleanEvery(log)

  var promises = []
  for (var i = 0; i < 99; i++) {
    promises.push(log.add({ type: 'a' }))
  }

  return Promise.all(promises).then(function () {
    expect(entriesCount(log)).toBe(99)
    return log.add({ type: 'a' })
  }).then(nextTick).then(function () {
    expect(entriesCount(log)).toBe(0)
  })
})
