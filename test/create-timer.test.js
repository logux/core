var createTimer = require('../create-timer')

it('starts events from zero', function () {
  let timer = createTimer('test')
  let time = timer()
  expect(time[2]).toBe(0)
})

it('saves host name', function () {
  let timer = createTimer('host')
  let time = timer()
  expect(time[2]).toBe(0)
})

it('generates unique time marks', function () {
  let timer = createTimer('test')
  var time1 = timer()
  var time2 = timer()
  expect(time1).not.toEqual(time2)
})
