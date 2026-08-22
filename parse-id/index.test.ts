import { deepStrictEqual, equal } from 'node:assert'
import { test } from 'node:test'

import { isSameClient, parseId } from '../index.js'

test('parses node ID', () => {
  deepStrictEqual(parseId('10:client:uuid'), {
    clientId: '10:client',
    nodeId: '10:client:uuid',
    userId: '10'
  })
})

test('parses action ID', () => {
  deepStrictEqual(parseId('1 10:client:uuid'), {
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

test('compares client ID', () => {
  equal(isSameClient('1 10:client:uuid 0', '10:client'), true)
  equal(isSameClient('10:client:uuid', '10:client'), true)
  equal(isSameClient('1 10:client 0', '10:client'), true)
  equal(isSameClient('1 10:client2:uuid 0', '10:client'), false)
  equal(isSameClient('1 10:client:uuid 0', '10'), false)
  equal(isSameClient('1 10:client:uuid 0', '10:client:uuid'), false)
  equal(isSameClient('1 20:client:uuid 0', '10:client'), false)
  equal(isSameClient('1 uuid 0', 'uuid'), true)
  equal(isSameClient('uuid', 'uuid'), true)
  equal(isSameClient('1 uuid2 0', 'uuid'), false)
})

test('has the same result as parseId()', () => {
  let ids = [
    'uuid',
    '10:uuid',
    '10:client:uuid',
    '10:client:uuid:more',
    '1 uuid 0',
    '1 10:uuid 0',
    '1 10:client:uuid 0'
  ]
  let clientIds = ['uuid', '10', '10:uuid', '10:client', '10:client:uuid']
  for (let id of ids) {
    for (let clientId of clientIds) {
      let expected = parseId(id).clientId === clientId
      equal(isSameClient(id, clientId), expected, `${id} / ${clientId}`)
    }
  }
})
