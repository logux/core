var createTestIdGenerator = require('../create-test-id-generator')
var createIdGenerator = require('../create-id-generator')
var isFirstOlder = require('../is-first-older')
var MemoryStore = require('../memory-store')
var cleanEvery = require('../clean-every')
var core = require('../')
var Log = require('../log')

it('has test ID generator', function () {
  expect(core.createTestIdGenerator).toBe(createTestIdGenerator)
})

it('has ID generator', function () {
  expect(core.createIdGenerator).toBe(createIdGenerator)
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
