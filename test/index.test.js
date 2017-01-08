var isFirstOlder = require('../is-first-older')
var MemoryStore = require('../memory-store')
var cleanEvery = require('../clean-every')
var TestTime = require('../test-time')
var core = require('../')
var Log = require('../log')

it('has autoclean', function () {
  expect(core.cleanEvery).toBe(cleanEvery)
})

it('has compare helper', function () {
  expect(core.isFirstOlder).toBe(isFirstOlder)
})

it('has test time class', function () {
  expect(core.TestTime).toBe(TestTime)
})

it('has memory store class', function () {
  expect(core.MemoryStore).toBe(MemoryStore)
})

it('has log class', function () {
  expect(core.Log).toBe(Log)
})
