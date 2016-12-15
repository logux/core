var isFirstOlder = require('../is-first-older')

it('compares events by time', function () {
  var a = { id: [2] }
  var b = { id: [1] }
  expect(isFirstOlder(a, b)).toBeFalsy()
  expect(isFirstOlder(b, a)).toBeTruthy()
})

it('compares events by real time', function () {
  var a = { id: [1], timeFix: 2 }
  var b = { id: [1], timeFix: 1 }
  expect(isFirstOlder(a, b)).toBeFalsy()
  expect(isFirstOlder(b, a)).toBeTruthy()
})

it('compares events by other ID parts', function () {
  var a = { id: [1, 'a', 1] }
  var b = { id: [1, 'a', 2] }
  expect(isFirstOlder(a, b)).toBeTruthy()
  expect(isFirstOlder(b, a)).toBeFalsy()
})

it('compares events by other ID parts with priority', function () {
  var a = { id: [1, 'b', 1] }
  var b = { id: [1, 'a', 2] }
  expect(isFirstOlder(a, b)).toBeFalsy()
  expect(isFirstOlder(b, a)).toBeTruthy()
})

it('returns false for same event', function () {
  var a = { id: [1, 'b', 1] }
  expect(isFirstOlder(a, a)).toBeFalsy()
})

it('orders events with different node ID length', function () {
  var a = { id: [1, '11', 1] }
  var b = { id: [1, '1', 2] }
  expect(isFirstOlder(a, b)).toBeFalsy()
  expect(isFirstOlder(b, a)).toBeTruthy()
})
