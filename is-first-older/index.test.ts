import { equal } from 'node:assert'
import { test } from 'node:test'

import { isFirstOlder, type Meta, type MetaTime } from '../index.js'

function createMeta(id: string, time: number): Meta {
  return { added: 1, id, reasons: [], time }
}

test('compares entries by time', () => {
  let a = createMeta('10 a', 2)
  let b = createMeta('1 a', 1)
  equal(isFirstOlder(a, b), false)
  equal(isFirstOlder(b, a), true)
  equal(isFirstOlder('10 a', '1 a'), false)
  equal(isFirstOlder('1 a', '10 a'), true)
})

test('compares entries by real time', () => {
  let a = createMeta('1 a', 2)
  let b = createMeta('1 a', 1)
  equal(isFirstOlder(a, b), false)
  equal(isFirstOlder(b, a), true)
})

test('compares entries by node ID', () => {
  let a = createMeta('1 b', 1)
  let b = createMeta('1 a', 1)
  equal(isFirstOlder(a, b), false)
  equal(isFirstOlder(b, a), true)
  equal(isFirstOlder('1 b', '1 a'), false)
  equal(isFirstOlder('1 a', '1 b'), true)
})

test('compares entries with same time by time in ID', () => {
  let a = createMeta('2 a', 1)
  let b = createMeta('1 a', 1)
  equal(isFirstOlder(a, b), false)
  equal(isFirstOlder(b, a), true)
})

test('returns false for same entry', () => {
  let a = createMeta('1 b', 1)
  equal(isFirstOlder(a, a), false)
})

test('orders entries with different node ID length', () => {
  let a = createMeta('1 11', 1)
  let b = createMeta('1 1', 1)
  equal(isFirstOlder(a, b), false)
  equal(isFirstOlder(b, a), true)
})

test('works with undefined in one meta', () => {
  let a = createMeta('1 a', 1)
  equal(isFirstOlder(a, undefined), false)
  equal(isFirstOlder(undefined, a), true)
})

test('works with MetaTime', () => {
  let a: MetaTime = { id: '2 a', time: 2 }
  let b: MetaTime = { id: '1 a', time: 1 }
  equal(isFirstOlder(a, b), false)
  equal(isFirstOlder(b, a), true)
  equal(isFirstOlder(a, createMeta('1 a', 1)), false)
  equal(isFirstOlder(b, '10 a'), true)
})
