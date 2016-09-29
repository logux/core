var createTestTimer = require('logux-core').createTestTimer
var MemoryStore = require('logux-core').MemoryStore
var Log = require('logux-core').Log

var PassiveSync = require('../passive-sync')
var ActiveSync = require('../active-sync')
var LocalPair = require('../local-pair')

function events (log) {
  return log.store.created.map(function (entry) {
    return entry[0]
  })
}

function createTest () {
  var log1 = new Log({ store: new MemoryStore(), timer: createTestTimer() })
  var log2 = new Log({ store: new MemoryStore(), timer: createTestTimer() })
  var pair = new LocalPair()

  var active = new ActiveSync('client', log1, pair.left)
  var passive = new PassiveSync('server', log2, pair.right)
  pair.left.connect()

  return { active: active, passive: passive }
}

it('sends sync messages', function () {
  var test = createTest()
  var passiveMessages = []
  test.active.connection.on('message', function (msg) {
    passiveMessages.push(msg)
  })
  var activeMessages = []
  test.passive.connection.on('message', function (msg) {
    activeMessages.push(msg)
  })

  test.active.log.add({ type: 'a' })
  expect(activeMessages).toEqual([
    ['sync', { type: 'a' }, [1], 1]
  ])
  expect(passiveMessages).toEqual([
    ['synced', 1]
  ])

  test.passive.log.add({ type: 'b' })
  expect(activeMessages).toEqual([
    ['sync', { type: 'a' }, [1], 1],
    ['synced', 2]
  ])
  expect(passiveMessages).toEqual([
    ['synced', 1],
    ['sync', { type: 'b' }, [3], 2]
  ])
})

it('synchronizes events', function () {
  var test = createTest()

  test.active.log.add({ type: 'a' })
  expect(events(test.passive.log)).toEqual([{ type: 'a' }])
  expect(events(test.active.log)).toEqual(events(test.passive.log))

  test.passive.log.add({ type: 'b' })
  expect(events(test.active.log)).toEqual([{ type: 'b' }, { type: 'a' }])
  expect(events(test.active.log)).toEqual(events(test.passive.log))
})

it('remembers synced added', function () {
  var test = createTest()
  expect(test.active.synced).toBe(0)
  expect(test.active.otherSynced).toBe(0)

  test.active.log.add({ type: 'a' })
  expect(test.active.synced).toBe(1)
  expect(test.active.otherSynced).toBe(0)

  test.passive.log.add({ type: 'b' })
  expect(test.active.synced).toBe(1)
  expect(test.active.otherSynced).toBe(2)
})

it('filters output events', function () {
  var test = createTest()
  test.active.options.outFilter = function (event, meta) {
    expect(meta.created).toBeDefined()
    expect(meta.added).toBeDefined()
    return event.type === 'b'
  }

  test.active.log.add({ type: 'a' })
  expect(events(test.active.log)).toEqual([{ type: 'a' }])
  expect(events(test.passive.log)).toEqual([])

  test.active.log.add({ type: 'b' })
  expect(events(test.active.log)).toEqual([{ type: 'b' }, { type: 'a' }])
  expect(events(test.passive.log)).toEqual([{ type: 'b' }])
})

it('maps output events', function () {
  var test = createTest()
  test.active.options.outMap = function (event, meta) {
    expect(meta.created).toBeDefined()
    expect(meta.added).toBeDefined()
    return [{ type: event.type + '1' }, meta]
  }

  test.active.log.add({ type: 'a' })
  expect(events(test.active.log)).toEqual([{ type: 'a' }])
  expect(events(test.passive.log)).toEqual([{ type: 'a1' }])
})

it('filters input events', function () {
  var test = createTest()
  test.passive.options.inFilter = function (event, meta) {
    expect(meta.created).toBeDefined()
    return event.type === 'b'
  }

  test.active.log.add({ type: 'a' })
  expect(events(test.active.log)).toEqual([{ type: 'a' }])
  expect(events(test.passive.log)).toEqual([])

  test.active.log.add({ type: 'b' })
  expect(events(test.active.log)).toEqual([{ type: 'b' }, { type: 'a' }])
  expect(events(test.passive.log)).toEqual([{ type: 'b' }])
})

it('maps input events', function () {
  var test = createTest()
  test.passive.options.inMap = function (event, meta) {
    expect(meta.created).toBeDefined()
    return [{ type: event.type + '1' }, meta]
  }

  test.active.log.add({ type: 'a' })
  expect(events(test.active.log)).toEqual([{ type: 'a' }])
  expect(events(test.passive.log)).toEqual([{ type: 'a1' }])
})
