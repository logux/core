var createTimer = require('../create-timer')

it('starts sequence from zero', function () {
  var timer = createTimer('test')
  var time = timer()
  expect(time[2]).toBe(0)
})

it('saves node ID', function () {
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

it('accepts number as a node ID', function () {
  var timer = createTimer(1)
  var time = timer()
  expect(time[1]).toEqual(1)
})

it('throws on tab in node ID', function () {
  expect(function () {
    createTimer('a\tb')
  }).toThrowError(/Tab symbol/)
})
