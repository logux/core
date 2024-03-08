import { equal } from 'node:assert'
import { test } from 'node:test'

import { isFirstOlder, type Meta } from '../index.js'

function createMeta(id: string, time: number): Meta {
  return { added: 1, id, reasons: [], time }
}

test('compares entries by time', () => {
  let a = createMeta('10 a 0', 2)
  let b = createMeta('1 a 0', 1)
  equal(isFirstOlder(a, b), false)
  equal(isFirstOlder(b, a), true)
  equal(isFirstOlder('10 a 0', '1 a 0'), false)
  equal(isFirstOlder('1 a 0', '10 a 0'), true)
})

test('compares entries by real time', () => {
  let a = createMeta('1 a 0', 2)
  let b = createMeta('1 a 0', 1)
  equal(isFirstOlder(a, b), false)
  equal(isFirstOlder(b, a), true)
})

test('compares entries by other ID parts', () => {
  let a = createMeta('1 a 9', 1)
  let b = createMeta('1 a 10', 1)
  equal(isFirstOlder(a, b), true)
  equal(isFirstOlder(b, a), false)
  equal(isFirstOlder('1 a 9', '1 a 10'), true)
  equal(isFirstOlder('1 a 10', '1 a 9'), false)
})

test('compares entries by other ID parts with priority', () => {
  let a = createMeta('1 b 1', 1)
  let b = createMeta('1 a 2', 1)
  equal(isFirstOlder(a, b), false)
  equal(isFirstOlder(b, a), true)
  equal(isFirstOlder('1 b 1', '1 a 1'), false)
  equal(isFirstOlder('1 a 1', '1 b 1'), true)
})

test('compares entries with same time', () => {
  let a = createMeta('2 a 0', 1)
  let b = createMeta('1 a 0', 1)
  equal(isFirstOlder(a, b), false)
  equal(isFirstOlder(b, a), true)
})

test('returns false for same entry', () => {
  let a = createMeta('1 b 1', 1)
  equal(isFirstOlder(a, a), false)
})

test('orders entries with different node ID length', () => {
  let a = createMeta('1 11 1', 1)
  let b = createMeta('1 1 2', 1)
  equal(isFirstOlder(a, b), false)
  equal(isFirstOlder(b, a), true)
})

test('works with undefined in one meta', () => {
  let a = createMeta('1 a 0', 1)
  equal(isFirstOlder(a, undefined), false)
  equal(isFirstOlder(undefined, a), true)
})
