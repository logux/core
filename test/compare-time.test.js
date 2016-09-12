var compareTime = require('../compare-time')

it('sorts events by time', function () {
  var array = [
    [2, 1, 0],
    [1, 0, 0],
    [1, 0, 1],
    [2, 1, 0],
    [1, 5, 0]
  ]
  expect(array.sort(compareTime)).toEqual([
    [1, 0, 0],
    [1, 0, 1],
    [1, 5, 0],
    [2, 1, 0],
    [2, 1, 0]
  ])
})
