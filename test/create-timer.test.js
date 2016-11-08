var createTimer = require('../create-timer')

it('starts events from zero', function () {
  var timer = createTimer('test')
  var time = timer()
  expect(time[2]).toBe(0)
})

it('saves node name', function () {
  var timer = createTimer('node')
  var time = timer()
  expect(time[1]).toEqual('node')
})

it('generates unique time marks', function () {
  var timer = createTimer('test')
  var time1 = timer()
  var time2 = timer()
  expect(time1).not.toEqual(time2)
})
