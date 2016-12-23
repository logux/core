var createTestTimer = require('../create-test-timer')
var isFirstOlder = require('../is-first-older')
var createTimer = require('../create-timer')
var MemoryStore = require('../memory-store')
var cleanEvery = require('../clean-every')
var core = require('../')
var Log = require('../log')

it('has test timer', function () {
  expect(core.createTestTimer).toBe(createTestTimer)
})

it('has timer', function () {
  expect(core.createTimer).toBe(createTimer)
})

it('has autoclean', function () {
  expect(core.cleanEvery).toBe(cleanEvery)
})

it('has compare helper', function () {
  expect(core.isFirstOlder).toBe(isFirstOlder)
})

it('has memory store class', function () {
  expect(core.MemoryStore).toBe(MemoryStore)
})

it('has log class', function () {
  expect(core.Log).toBe(Log)
})
