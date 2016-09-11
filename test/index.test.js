var core = require('../')

it('has test timer', function () {
  expect(typeof core.createTestTimer).toEqual('function')
})

it('has timer', function () {
  expect(typeof core.createTimer).toEqual('function')
})

it('has memory store', function () {
  expect(typeof core.MemoryStore.prototype).toEqual('object')
})
