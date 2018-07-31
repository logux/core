var SyncError = require('../sync-error')

function catchError (desc, type, received) {
  var error
  try {
    throw new SyncError(desc, type, received)
  } catch (e) {
    error = e
  }
  return error
}

it('has stack trace', function () {
  var error = catchError('test')
  expect(error.stack).toContain('sync-error.test.js')
})

it('has class name', function () {
  var error = catchError('test')
  expect(error.name).toEqual('SyncError')
})

it('has error description', function () {
  var error = catchError('test')
  expect(error.description).toEqual('test')
})

it('has received', function () {
  var own = catchError('test', 'custom')
  expect(own.received).toBeFalsy()
  var received = catchError('test', 'custom', true)
  expect(received.received).toBeTruthy()
})

it('stringifies', function () {
  var error = catchError('test', 'custom', true)
  expect('' + error).toContain('SyncError: Logux received test error')
})

it('stringifies local error', function () {
  var error = catchError('test')
  expect(error.toString()).toContain('SyncError: test')
})

it('stringifies bruteforce error', function () {
  expect(catchError('bruteforce').toString()).toContain(
    'SyncError: Too many wrong authentication attempts')
})

it('stringifies subprotocol error', function () {
  var error = catchError('wrong-subprotocol', {
    supported: '2.x || 3.x',
    used: '1.0'
  }, true)
  expect(error.toString()).toContain(
    'SyncError: Logux received wrong-subprotocol error ' +
    '(Only 2.x || 3.x application subprotocols are supported, but you use 1.0)')
})

it('returns description by error type', function () {
  expect(catchError('wrong-format', '{}').toString()).toContain(
    'SyncError: Wrong message format in {}')
})
