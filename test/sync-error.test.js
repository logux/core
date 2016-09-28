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

it('has error type', function () {
  var error = catchError({ }, 'test', 'custom')
  expect(error.type).toEqual('custom')
})

it('has sync', function () {
  var sync = { a: 1 }
  var error = catchError(sync, 'test', 'custom')
  expect(error.sync).toBe(sync)
})

it('stringifies', function () {
  var error = catchError({ }, 'test', 'custom', true)
  expect('' + error).toContain('SyncError: Logux received "test" custom error')
})

it('stringifies without type', function () {
  var error = catchError({ }, 'test', undefined, true)
  expect(error.toString()).toContain('SyncError: Logux received "test" error')
})

it('stringifies with other host', function () {
  var error = catchError({ otherHost: 'server' }, 'test', undefined, true)
  expect(error.toString()).toContain('SyncError: server sent "test" error')
})

it('stringifies local error', function () {
  var error = catchError({ otherHost: 'server' }, 'test')
  expect(error.toString()).toContain('SyncError: test')
})
