var createTestTimer = require('../create-test-timer')
var createTimer = require('../create-timer')
var MemoryStore = require('../memory-store')
var core = require('../')
var Log = require('../log')

it('has test timer', function () {
  expect(core.createTestTimer).toBe(createTestTimer)
})

it('has timer', function () {
  expect(core.createTimer).toBe(createTimer)
})

it('has memory store class', function () {
  expect(core.MemoryStore).toBe(MemoryStore)
})

it('has log class', function () {
  expect(core.Log).toBe(Log)
})
