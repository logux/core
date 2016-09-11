var core = require('../')

it('has test timer', function () {
  expect(typeof core.createTestTimer).toEqual('function')
})

it('has timer', function () {
  expect(typeof core.createTimer).toEqual('function')
})

it('has memory store class', function () {
  expect(typeof core.MemoryStore.prototype).toEqual('object')
})

it('has log class', function () {
  expect(typeof core.Log.prototype).toEqual('object')
})
