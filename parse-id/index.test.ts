import { deepStrictEqual } from 'node:assert'
import { test } from 'node:test'

import { parseId } from '../index.js'

test('parses node ID', () => {
  deepStrictEqual(parseId('10:client:uuid'), {
    clientId: '10:client',
    nodeId: '10:client:uuid',
    userId: '10'
  })
})

test('parses action ID', () => {
  deepStrictEqual(parseId('1 10:client:uuid 0'), {
    clientId: '10:client',
    nodeId: '10:client:uuid',
    userId: '10'
  })
})

test('parses node ID without client', () => {
  deepStrictEqual(parseId('10:uuid'), {
    clientId: '10:uuid',
    nodeId: '10:uuid',
    userId: '10'
  })
})

test('parses node ID without client and user', () => {
  deepStrictEqual(parseId('uuid'), {
    clientId: 'uuid',
    nodeId: 'uuid',
    userId: undefined
  })
})

test('parses node ID with false user', () => {
  deepStrictEqual(parseId('false:client:uuid'), {
    clientId: 'false:client',
    nodeId: 'false:client:uuid',
    userId: 'false'
  })
})

test('parses node ID with multiple colon', () => {
  deepStrictEqual(parseId('10:client:uuid:more'), {
    clientId: '10:client',
    nodeId: '10:client:uuid:more',
    userId: '10'
  })
})
