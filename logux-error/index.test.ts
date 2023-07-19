import { test } from 'uvu'
import { equal, is, ok } from 'uvu/assert'

import { LoguxError, type LoguxErrorOptions } from '../index.js'

function catchError<T extends keyof LoguxErrorOptions>(
  type: T,
  opts?: LoguxErrorOptions[T],
  received?: boolean
): LoguxError {
  let error: LoguxError
  try {
    throw new LoguxError(type, opts, received)
  } catch (e) {
    error = e as LoguxError
  }
  return error
}

test('does not crash if captureStackTrace does not exist', () => {
  let captureStackTrace = global.Error.captureStackTrace
  // @ts-expect-error
  delete global.Error.captureStackTrace
  catchError('wrong-credentials')
  global.Error.captureStackTrace = captureStackTrace
})

test('has stack trace', () => {
  let error = catchError('wrong-credentials')
  ok(error.stack.includes('index.test.ts'))
})

test('has class name', () => {
  let error = catchError('wrong-credentials')
  equal(error.name, 'LoguxError')
})

test('has error description', () => {
  let error = catchError('wrong-credentials')
  equal(error.description, 'Wrong credentials')
})

test('has received', () => {
  let own = catchError('timeout', 10)
  is(own.received, false)
  let received = catchError('timeout', 10, true)
  is(received.received, true)
})

test('stringifies', () => {
  let error = catchError('timeout', 10, true)
  ok(
    String(error).includes(
      'LoguxError: Logux received timeout error (A timeout was reached (10 ms))'
    )
  )
})

test('stringifies local unknown error', () => {
  let error = catchError('timeout', 10)
  ok(error.toString().includes('LoguxError: A timeout was reached (10 ms)'))
})

test('stringifies bruteforce error', () => {
  ok(
    catchError('bruteforce')
      .toString()
      .includes('LoguxError: Too many wrong authentication attempts')
  )
})

test('stringifies subprotocol error', () => {
  let error = catchError(
    'wrong-subprotocol',
    {
      supported: '2.x',
      used: '1.0'
    },
    true
  )
  ok(
    error
      .toString()
      .includes(
        'LoguxError: Logux received wrong-subprotocol error ' +
          '(Only 2.x application subprotocols are supported, but you use 1.0)'
      )
  )
})

test('returns description by error type', () => {
  ok(
    catchError('wrong-format', '{}')
      .toString()
      .includes('LoguxError: Wrong message format in {}')
  )
})

test('returns description by unknown type', () => {
  // @ts-expect-error
  ok(catchError('unknown').toString().includes('LoguxError: unknown'))
})

test.run()
