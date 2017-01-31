var SyncError = require('../sync-error')

function catchError (sync, desc, type, received) {
  var error
  try {
    throw new SyncError(sync, desc, type, received)
  } catch (e) {
    error = e
  }
  return error
}

it('has stack trace', function () {
  var error = catchError({ }, 'test')
  expect(error.stack).toContain('sync-error.test.js')
})

it('has class name', function () {
  var error = catchError({ }, 'test')
  expect(error.name).toEqual('SyncError')
})

it('has error description', function () {
  var error = catchError({ }, 'test')
  expect(error.description).toEqual('test')
})

it('has sync', function () {
  var sync = { a: 1 }
  var error = catchError(sync, 'test')
  expect(error.sync).toBe(sync)
})

it('has received', function () {
  var sync = { a: 1 }
  var own = catchError(sync, 'test', 'custom')
  expect(own.received).toBeFalsy()
  var received = catchError(sync, 'test', 'custom', true)
  expect(received.received).toBeTruthy()
})

it('stringifies', function () {
  var error = catchError({ }, 'test', 'custom', true)
  expect('' + error).toContain('SyncError: Logux received test error')
})

it('stringifies with other node name', function () {
  var error = catchError({ remoteNodeId: 'server' }, 'test', undefined, true)
  expect(error.toString()).toContain('SyncError: server sent test error')
})

it('stringifies local error', function () {
  var error = catchError({ remoteNodeId: 'server' }, 'test')
  expect(error.toString()).toContain('SyncError: test')
})

it('stringifies subprotocol error', function () {
  var error = catchError({ remoteNodeId: 'server' }, 'wrong-subprotocol', {
    supported: '2.x || 3.x',
    used: '1.0'
  }, true)
  expect(error.toString()).toContain(
    'SyncError: server sent wrong-subprotocol error ' +
    '(Only 2.x || 3.x application subprotocols are supported, but you use 1.0)')
})

it('returns description by error type', function () {
  expect(SyncError.describe('wrong-format', '{}')).toEqual(
    'Wrong message format in {}')
})
