/**
 * Logux error in logs synchronization.
 *
 * @param {string} type The error code.
 * @param {any} options The error option.
 * @param {boolean} [received=false] Was error received from remote node.
 *
 * @example
 * if (error.name === 'LoguxError') {
 *   console.log('Server throws: ' + error.description)
 * }
 *
 * @extends Error
 * @class
 */
function LoguxError (type, options, received) {
  Error.call(this, type)

  /**
   * Always equal to `LoguxError`. The best way to check error class.
   * @type {string}
   *
   * @example
   * if (error.name === 'LoguxError') { }
   */
  this.name = 'LoguxError'

  /**
   * The error code.
   * @type {string}
   *
   * @example
   * if (error.type === 'timeout') {
   *   fixNetwork()
   * }
   */
  this.type = type

  /**
   * Error options depends on error type.
   * @type {any}
   *
   * @example
   * if (error.type === 'timeout') {
   *   console.error('A timeout was reached (' + error.options + ' ms)')
   * }
   */
  this.options = options

  /**
   * Human-readable error description.
   * @type {string}
   *
   * @example
   * console.log('Server throws: ' + error.description)
   */
  this.description = LoguxError.describe(type, options)

  /**
   * Was error received from remote client.
   * @type {boolean}
   */
  this.received = !!received

  this.message = ''
  if (received) {
    this.message += 'Logux received ' + this.type + ' error'
    if (this.description !== this.type) {
      this.message += ' (' + this.description + ')'
    }
  } else {
    this.message = this.description
  }

  if (Error.captureStackTrace) {
    Error.captureStackTrace(this, LoguxError)
  }
}

/**
 * Return a error description by it code.
 *
 * @param {string} type The error code.
 * @param {any} options The errors options depends on error code.
 *
 * @return {string} Human-readable error description.
 *
 * @example
 * errorMessage(msg) {
 *   console.log(LoguxError.describe(msg[1], msg[2]))
 * }
 */
LoguxError.describe = function describe (type, options) {
  if (type === 'timeout') {
    return 'A timeout was reached (' + options + 'ms)'
  } else if (type === 'wrong-format') {
    return 'Wrong message format in ' + options
  } else if (type === 'unknown-message') {
    return 'Unknown message `' + options + '` type'
  } else if (type === 'bruteforce') {
    return 'Too many wrong authentication attempts'
  } else if (type === 'wrong-protocol') {
    return 'Logux supports protocols only from version ' + options.supported +
           ', but you use ' + options.used
  } else if (type === 'wrong-subprotocol') {
    return 'Only ' + options.supported + ' application subprotocols are ' +
           'supported, but you use ' + options.used
  } else if (type === 'wrong-credentials') {
    return 'Wrong credentials'
  } else {
    return type
  }
}

LoguxError.prototype = Error.prototype

module.exports = LoguxError
