import { equal } from 'uvu/assert'
import { test } from 'uvu'

import { parseId } from '../index.js'

test('parses node ID', () => {
  equal(parseId('10:client:uuid'), {
    nodeId: '10:client:uuid',
    clientId: '10:client',
    userId: '10'
  })
})

test('parses action ID', () => {
  equal(parseId('1 10:client:uuid 0'), {
    nodeId: '10:client:uuid',
    clientId: '10:client',
    userId: '10'
  })
})

test('parses node ID without client', () => {
  equal(parseId('10:uuid'), {
    nodeId: '10:uuid',
    clientId: '10:uuid',
    userId: '10'
  })
})

test('parses node ID without client and user', () => {
  equal(parseId('uuid'), {
    nodeId: 'uuid',
    clientId: 'uuid',
    userId: undefined
  })
})

test('parses node ID with false user', () => {
  equal(parseId('false:client:uuid'), {
    nodeId: 'false:client:uuid',
    clientId: 'false:client',
    userId: 'false'
  })
})

test('parses node ID with multiple colon', () => {
  equal(parseId('10:client:uuid:more'), {
    nodeId: '10:client:uuid:more',
    clientId: '10:client',
    userId: '10'
  })
})

test.run()
