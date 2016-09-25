var SyncError = require('../sync-error')

function catchError (sync, message) {
  var error
  try {
    throw new SyncError(sync, message)
  } catch (e) {
    error = e
  }
  return error
}

it('has stack trace', function () {
  var error = catchError({ }, ['error', 'test'])
  expect(error.stack).toContain('sync-error.test.js')
})

it('has class name', function () {
  var error = catchError({ }, ['error', 'test'])
  expect(error.name).toEqual('SyncError')
})

it('has error description', function () {
  var error = catchError({ }, ['error', 'test'])
  expect(error.description).toEqual('test')
})

it('has error type', function () {
  var error = catchError({ }, ['error', 'test', 'custom'])
  expect(error.type).toEqual('custom')
})

it('has sync', function () {
  var sync = { a: 1 }
  var error = catchError(sync, ['error', 'test', 'custom'])
  expect(error.sync).toBe(sync)
})

it('stringifies', function () {
  var error = catchError({ }, ['error', 'test', 'custom'])
  expect('' + error).toContain('SyncError: Logux received "test" custom error')
})

it('stringifies without type', function () {
  var error = catchError({ }, ['error', 'test'])
  expect(error.toString()).toContain('SyncError: Logux received "test" error')
})
