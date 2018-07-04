var isFirstOlder = require('../is-first-older')

it('compares entries by time', function () {
  var a = { id: '2 a 0', time: 2 }
  var b = { id: '1 a 0', time: 1 }
  expect(isFirstOlder(a, b)).toBeFalsy()
  expect(isFirstOlder(b, a)).toBeTruthy()
})

it('compares entries by real time', function () {
  var a = { id: '1 a 0', time: 2 }
  var b = { id: '1 a 0', time: 1 }
  expect(isFirstOlder(a, b)).toBeFalsy()
  expect(isFirstOlder(b, a)).toBeTruthy()
})

it('compares entries by other ID parts', function () {
  var a = { id: '1 a 1', time: 1 }
  var b = { id: '1 a 2', time: 1 }
  expect(isFirstOlder(a, b)).toBeTruthy()
  expect(isFirstOlder(b, a)).toBeFalsy()
})

it('compares entries by other ID parts with priority', function () {
  var a = { id: '1 b 1', time: 1 }
  var b = { id: '1 a 2', time: 1 }
  expect(isFirstOlder(a, b)).toBeFalsy()
  expect(isFirstOlder(b, a)).toBeTruthy()
})

it('compares entries with same time', function () {
  var a = { id: '2 a 0', time: 1 }
  var b = { id: '1 a 0', time: 1 }
  expect(isFirstOlder(a, b)).toBeFalsy()
  expect(isFirstOlder(b, a)).toBeTruthy()
})

it('returns false for same entry', function () {
  var a = { id: '1 b 1', time: 1 }
  expect(isFirstOlder(a, a)).toBeFalsy()
})

it('orders entries with different node ID length', function () {
  var a = { id: '1 11 1', time: 1 }
  var b = { id: '1 1 2', time: 1 }
  expect(isFirstOlder(a, b)).toBeFalsy()
  expect(isFirstOlder(b, a)).toBeTruthy()
})

it('works with undefined in one meta', function () {
  var a = { id: '1 a 0', time: 1 }
  expect(isFirstOlder(a, undefined)).toBeFalsy()
  expect(isFirstOlder(undefined, a)).toBeTruthy()
})
