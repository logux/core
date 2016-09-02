var test = require('ava')

var createTestTimer = require('../create-test-timer')

test('generates uniq time marks', t => {
  var timer = createTestTimer()
  for (var i = 1; i <= 10; i++) {
    t.is(timer(), i)
  }
})

test('starts from same value', t => {
  var timer1 = createTestTimer()
  var timer2 = createTestTimer()
  for (var i = 0; i <= 10; i++) {
    t.is(timer1(), timer2())
  }
})
