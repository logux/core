let LoguxError = require('../logux-error')

function catchError (desc, type, received) {
  let error
  try {
    throw new LoguxError(desc, type, received)
  } catch (e) {
    error = e
  }
  return error
}

it('has stack trace', () => {
  let error = catchError('test')
  expect(error.stack).toContain('logux-error.test.js')
})

it('has class name', () => {
  let error = catchError('test')
  expect(error.name).toEqual('LoguxError')
})

it('has error description', () => {
  let error = catchError('test')
  expect(error.description).toEqual('test')
})

it('has received', () => {
  let own = catchError('test', 'custom')
  expect(own.received).toBeFalsy()
  let received = catchError('test', 'custom', true)
  expect(received.received).toBeTruthy()
})

it('stringifies', () => {
  let error = catchError('test', 'custom', true)
  expect('' + error).toContain('LoguxError: Logux received test error')
})

it('stringifies local error', () => {
  let error = catchError('test')
  expect(error.toString()).toContain('LoguxError: test')
})

it('stringifies bruteforce error', () => {
  expect(catchError('bruteforce').toString()).toContain(
    'LoguxError: Too many wrong authentication attempts')
})

it('stringifies subprotocol error', () => {
  let error = catchError('wrong-subprotocol', {
    supported: '2.x || 3.x',
    used: '1.0'
  }, true)
  expect(error.toString()).toContain(
    'LoguxError: Logux received wrong-subprotocol error ' +
    '(Only 2.x || 3.x application subprotocols are supported, but you use 1.0)'
  )
})

it('returns description by error type', () => {
  expect(catchError('wrong-format', '{}').toString()).toContain(
    'LoguxError: Wrong message format in {}'
  )
})
