var createTestTimer = require('../create-test-timer')

it('generates uniq time marks', function () {
  var timer = createTestTimer()
  for (var i = 1; i <= 10; i++) {
    expect(timer()).toEqual([i])
  }
})

it('starts from same value', function () {
  var timer1 = createTestTimer()
  var timer2 = createTestTimer()
  for (var i = 0; i <= 10; i++) {
    expect(timer1()).toEqual(timer2())
  }
})
