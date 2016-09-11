var createTimer = require('../create-timer')

it('starts events from zero', function () {
  var timer = createTimer('test')
  var time = timer()
  expect(time[2]).toBe(0)
})

it('saves host name', function () {
  var timer = createTimer('host')
  var time = timer()
  expect(time[2]).toBe(0)
})

it('generates unique time marks', function () {
  var timer = createTimer('test')
  var time1 = timer()
  var time2 = timer()
  expect(time1).not.toEqual(time2)
})
