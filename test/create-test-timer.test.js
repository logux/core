var test = require('ava')

var createTestTimer = require('../create-test-timer')

test('generates uniq time marks', function (t) {
  var timer = createTestTimer()
  for (var i = 1; i <= 10; i++) {
    t.deepEqual(timer(), [i])
  }
})

test('starts from same value', function (t) {
  var timer1 = createTestTimer()
  var timer2 = createTestTimer()
  for (var i = 0; i <= 10; i++) {
    t.deepEqual(timer1(), timer2())
  }
})
