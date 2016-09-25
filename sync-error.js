/**
 * Unknown error received from other Logux client.
 *
 * @param {BaseSync} sync The sync client object.
 * @param {Message} message The error message.
 *
 * @example
 * if (error.name === 'SyncError') {
 *   console.log('Server throws: ' + error.description)
 * }
 *
 * @extends Error
 * @class
 */
function SyncError (sync, message) {
  Error.call(this, message[1])

  /**
   * Always equal to `SyncError`. The best way to check error type.
   * @type {string}
   *
   * @example
   * if (error.name === 'SyncError') { }
   */
  this.name = 'SyncError'
  /**
   * Origin error description from other client.
   * @type {string}
   *
   * @example
   * console.log('Server throws: ' + error.description)
   */
  this.description = message[1]
  /**
   * Error type.
   * @type {string|undefined}
   *
   * @example
   * if (error.type === 'protocol') {
   *   askToUpdateClient()
   * }
   */
  this.type = message[2]
  /**
   * Sync client received a error message.
   * @type {BaseSync}
   *
   * @example
   * error.sync.connected
   */
  this.sync = sync

  this.message = 'Logux received "' + this.description + '" '
  if (this.type) this.message += this.type + ' '
  this.message += 'error'

  if (Error.captureStackTrace) {
    Error.captureStackTrace(this, SyncError)
  }
}

SyncError.prototype = Error.prototype

module.exports = SyncError
