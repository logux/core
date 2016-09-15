var compareTime = require('../compare-time')

it('returns 1 if a older', function () {
  expect(compareTime([1], [0])).toBe(1)
})

it('returns -1 if a younger', function () {
  expect(compareTime([1], [2])).toBe(-1)
})

it('returns 0 if times are equal', function () {
  expect(compareTime([1], [1])).toBe(0)
})

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
