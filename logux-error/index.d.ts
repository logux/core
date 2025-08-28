interface Versions {
  supported: number
  used: number
}

export interface LoguxErrorOptions {
  'bruteforce': void
  'timeout': number
  'unknown-message': string
  'wrong-credentials': void
  'wrong-format': string
  'wrong-protocol': Versions
  'wrong-subprotocol': Versions
}

/**
 * Logux error in logs synchronization.
 *
 * ```js
 * if (error.name === 'LoguxError') {
 *   console.log('Server throws: ' + error.description)
 * }
 * ```
 */
export class LoguxError<
  ErrorType extends keyof LoguxErrorOptions = keyof LoguxErrorOptions
> extends Error {
  /**
   * Human-readable error description.
   *
   * ```js
   * console.log('Server throws: ' + error.description)
   * ```
   */
  description: string

  /**
   * Full text of error to print in debug message.
   */
  message: string

  /**
   * Always equal to `LoguxError`. The best way to check error class.
   *
   * ```js
   * if (error.name === 'LoguxError') {
   * ```
   */
  name: 'LoguxError'

  /**
   * Error options depends on error type.
   *
   * ```js
   * if (error.type === 'timeout') {
   *   console.error('A timeout was reached (' + error.options + ' ms)')
   * }
   * ```
   */
  options: LoguxErrorOptions[ErrorType]

  /**
   * Was error received from remote client.
   */
  received: boolean

  /**
   * Calls which cause the error.
   */
  stack: string

  /**
   * The error code.
   *
   * ```js
   * if (error.type === 'timeout') {
   *   fixNetwork()
   * }
   * ```
   */
  type: ErrorType

  /**
   * @param type The error code.
   * @param options The error option.
   * @param received Was error received from remote node.
   */
  constructor(
    type: ErrorType,
    options?: LoguxErrorOptions[ErrorType],
    received?: boolean
  )

  /**
   * Return a error description by it code.
   *
   * @param type The error code.
   * @param options The errors options depends on error code.
   *
   * ```js
   * errorMessage(msg) {
   *   console.log(LoguxError.describe(msg[1], msg[2]))
   * }
   * ```
   */
  static description<Type extends keyof LoguxErrorOptions>(
    type: Type,
    options?: LoguxErrorOptions[Type]
  ): string
}
