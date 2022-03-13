import { test } from 'uvu'
import { is } from 'uvu/assert'

import { isFirstOlder, Meta } from '../index.js'

function createMeta(id: string, time: number): Meta {
  return { id, time, reasons: [], added: 1 }
}

test('compares entries by time', () => {
  let a = createMeta('10 a 0', 2)
  let b = createMeta('1 a 0', 1)
  is(isFirstOlder(a, b), false)
  is(isFirstOlder(b, a), true)
  is(isFirstOlder('10 a 0', '1 a 0'), false)
  is(isFirstOlder('1 a 0', '10 a 0'), true)
})

test('compares entries by real time', () => {
  let a = createMeta('1 a 0', 2)
  let b = createMeta('1 a 0', 1)
  is(isFirstOlder(a, b), false)
  is(isFirstOlder(b, a), true)
})

test('compares entries by other ID parts', () => {
  let a = createMeta('1 a 9', 1)
  let b = createMeta('1 a 10', 1)
  is(isFirstOlder(a, b), true)
  is(isFirstOlder(b, a), false)
  is(isFirstOlder('1 a 9', '1 a 10'), true)
  is(isFirstOlder('1 a 10', '1 a 9'), false)
})

test('compares entries by other ID parts with priority', () => {
  let a = createMeta('1 b 1', 1)
  let b = createMeta('1 a 2', 1)
  is(isFirstOlder(a, b), false)
  is(isFirstOlder(b, a), true)
  is(isFirstOlder('1 b 1', '1 a 1'), false)
  is(isFirstOlder('1 a 1', '1 b 1'), true)
})

test('compares entries with same time', () => {
  let a = createMeta('2 a 0', 1)
  let b = createMeta('1 a 0', 1)
  is(isFirstOlder(a, b), false)
  is(isFirstOlder(b, a), true)
})

test('returns false for same entry', () => {
  let a = createMeta('1 b 1', 1)
  is(isFirstOlder(a, a), false)
})

test('orders entries with different node ID length', () => {
  let a = createMeta('1 11 1', 1)
  let b = createMeta('1 1 2', 1)
  is(isFirstOlder(a, b), false)
  is(isFirstOlder(b, a), true)
})

test('works with undefined in one meta', () => {
  let a = createMeta('1 a 0', 1)
  is(isFirstOlder(a, undefined), false)
  is(isFirstOlder(undefined, a), true)
})

test.run()
