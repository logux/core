var SyncError = require('./sync-error')

var TypeChecker = {

  check: function check (value, type, required) {
    if (value === undefined) {
      return !required
    }

    return this['is' + this.capitalizeFirstLetter(type)](value)
  },

  capitalizeFirstLetter: function capitalizeFirstLetter (string) {
    return string.charAt(0).toUpperCase() + string.slice(1)
  },

  isNumber: function isNumber (value) {
    return typeof value === 'number'
  },
  isString: function isString (value) {
    return typeof value === 'string'
  },
  isObject: function isObject (value) {
    return typeof value === 'object' && typeof value.length !== 'number'
  },
  isArray: function isArray (value) {
    return typeof value === 'object' && typeof value.length === 'number'
  },
  isFunction: function isFunction (value) {
    return typeof value === 'function'
  }
}

function checkType (value, type, required) {
  return TypeChecker.check(value, type, required)
}

module.exports = {

  validateMessage: function validateMessage (msg) {
    var name = msg[0]
    var isValid = checkType(msg, 'array', true) &&
      checkType(name, 'string', true)

    if (isValid) {
      var msgMethod = name + 'Message'
      if (!checkType(this[msgMethod], 'function', true)) {
        this.sendError(new SyncError(this, 'unknown-message', name))
        this.connection.disconnect()
        return false
      }
    } else {
      this.wrongFormatError(msg)
      return false
    }

    var validator = this[name + 'Validator']
    if (!checkType(validator, 'function', true)) {
      return true
    }

    var args = new Array(msg.length - 1)
    for (var i = 1; i < msg.length; i++) {
      args[i - 1] = msg[i]
    }

    if (!validator.apply(this, args)) {
      this.wrongFormatError(msg)
      return false
    }

    return true
  },

  connectValidator: function connectValidator (ver, nodeId, synced, options) {
    return checkType(nodeId, 'string', true) &&
      checkType(synced, 'number', true) &&
      checkType(options, 'object', false)
  },

  connectedValidator: function connectedValidator (ver, nodeId, time, options) {
    return checkType(nodeId, 'string', true) &&
      checkType(time, 'array', true) && time.length === 2 &&
      checkType(time[0], 'number', true) &&
      checkType(time[1], 'number', true) &&
      checkType(options, 'object', false)
  },

  pingValidator: function pingValidator (synced) {
    return checkType(synced, 'number', true)
  },

  pongValidator: function pongValidator (synced) {
    return checkType(synced, 'number', true)
  },

  syncValidator: function syncValidator (added) {
    if (!checkType(added, 'number', true)) {
      return false
    }

    if (arguments.length % 2 !== 1) {
      return false
    }

    for (var i = 1; i < arguments.length; i++) {
      var type = (i % 2 === 0 ? 'array' : 'object')
      if (!checkType(arguments[i], type, true)) {
        return false
      }
    }

    return true
  },

  syncedValidator: function syncedValidator (synced) {
    return checkType(synced, 'number', true)
  },

  errorValidator: function errorValidator (type) {
    return checkType(type, 'string', true)
  },

  wrongFormatError: function wrongFormatError (msg) {
    this.sendError(
      new SyncError(this, 'wrong-format', JSON.stringify(msg))
    )
    this.connection.disconnect()
  }
}
