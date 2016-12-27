var createTestIdGenerator = require('../create-test-id-generator')

it('generates uniq time marks', function () {
  var generator = createTestIdGenerator()
  for (var i = 1; i <= 10; i++) {
    expect(generator()).toEqual([i, 'test', 0])
  }
})

it('starts from same value', function () {
  var generator1 = createTestIdGenerator()
  var generator2 = createTestIdGenerator()
  for (var i = 0; i <= 10; i++) {
    expect(generator1()).toEqual(generator2())
  }
})
