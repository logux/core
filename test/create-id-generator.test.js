var createIdGenerator = require('../create-id-generator')

it('starts sequence from zero', function () {
  var generator = createIdGenerator('test')
  var id = generator()
  expect(id[2]).toBe(0)
})

it('saves node ID', function () {
  var generator = createIdGenerator('node')
  var id = generator()
  expect(id[1]).toEqual('node')
})

it('generates unique IDs', function () {
  var generator = createIdGenerator('test')
  var id1, id2
  for (var i = 0; i < 100; i++) {
    id1 = generator()
    id2 = generator()
    expect(id1).not.toEqual(id2)
  }
})

it('accepts number as a node ID', function () {
  var generator = createIdGenerator(1)
  var id = generator()
  expect(id[1]).toEqual(1)
})

it('throws on tab in node ID', function () {
  expect(function () {
    createIdGenerator('a\tb')
  }).toThrowError(/Tab symbol/)
})
