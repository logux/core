let { isFirstOlder } = require('..')

it('compares entries by time', () => {
  let a = { id: '2 a 0', time: 2 }
  let b = { id: '1 a 0', time: 1 }
  expect(isFirstOlder(a, b)).toBe(false)
  expect(isFirstOlder(b, a)).toBe(true)
})

it('compares entries by real time', () => {
  let a = { id: '1 a 0', time: 2 }
  let b = { id: '1 a 0', time: 1 }
  expect(isFirstOlder(a, b)).toBe(false)
  expect(isFirstOlder(b, a)).toBe(true)
})

it('compares entries by other ID parts', () => {
  let a = { id: '1 a 1', time: 1 }
  let b = { id: '1 a 2', time: 1 }
  expect(isFirstOlder(a, b)).toBe(true)
  expect(isFirstOlder(b, a)).toBe(false)
})

it('compares entries by other ID parts with priority', () => {
  let a = { id: '1 b 1', time: 1 }
  let b = { id: '1 a 2', time: 1 }
  expect(isFirstOlder(a, b)).toBe(false)
  expect(isFirstOlder(b, a)).toBe(true)
})

it('compares entries with same time', () => {
  let a = { id: '2 a 0', time: 1 }
  let b = { id: '1 a 0', time: 1 }
  expect(isFirstOlder(a, b)).toBe(false)
  expect(isFirstOlder(b, a)).toBe(true)
})

it('returns false for same entry', () => {
  let a = { id: '1 b 1', time: 1 }
  expect(isFirstOlder(a, a)).toBe(false)
})

it('orders entries with different node ID length', () => {
  let a = { id: '1 11 1', time: 1 }
  let b = { id: '1 1 2', time: 1 }
  expect(isFirstOlder(a, b)).toBe(false)
  expect(isFirstOlder(b, a)).toBe(true)
})

it('works with undefined in one meta', () => {
  let a = { id: '1 a 0', time: 1 }
  expect(isFirstOlder(a, undefined)).toBe(false)
  expect(isFirstOlder(undefined, a)).toBe(true)
})
