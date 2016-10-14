/**
 * Unknown error received from other Logux client.
 *
 * @param {BaseSync} sync The sync client object.
 * @param {string} desc The error message.
 * @param {string} type The error type.
 * @param {boolean} received Was error received from other node.
 *
 * @example
 * if (error.name === 'SyncError') {
 *   console.log('Server throws: ' + error.description)
 * }
 *
 * @extends Error
 * @class
 */
function SyncError (sync, desc, type, received) {
  Error.call(this, desc)

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
  this.description = desc
  /**
   * Error type.
   * @type {string|undefined}
   *
   * @example
   * if (error.type === 'protocol') {
   *   askToUpdateClient()
   * }
   */
  this.type = type
  /**
   * Sync client received a error message.
   * @type {BaseSync}
   *
   * @example
   * error.sync.connection.connected
   */
  this.sync = sync

  this.message = ''
  if (received) {
    if (this.sync.otherHost) {
      this.message += this.sync.otherHost + ' sent '
    } else {
      this.message += 'Logux received '
    }
    this.message += '"' + this.description + '" '
    if (this.type) {
      this.message += this.type + ' '
    }
    this.message += 'error'
  } else {
    this.message = desc
  }

  if (Error.captureStackTrace) {
    Error.captureStackTrace(this, SyncError)
  }
}

SyncError.prototype = Error.prototype

module.exports = SyncError
