var SyncError = require('./sync-error')

function isNumber (value) {
  return typeof value === 'number'
}

function isString (value) {
  return typeof value === 'string'
}

function isObject (value) {
  return typeof value === 'object' && typeof value.length !== 'number'
}

function isArray (value) {
  return typeof value === 'object' && typeof value.length === 'number'
}

function isTwoNumbers (value) {
  return isArray(value) && value.length === 2 &&
    isNumber(value[0]) && isNumber(value[0])
}

function isNodeId (value) {
  return isString(value) || isNumber(value)
}

var validators = {

  connect: function connect (msg) {
    return isTwoNumbers(msg[1]) && isNodeId(msg[2]) && isNumber(msg[3]) &&
      (msg.length === 4 || msg.length === 5 && isObject(msg[4]))
  },

  connected: function connected (msg) {
    return isTwoNumbers(msg[1]) && isNodeId(msg[2]) && isTwoNumbers(msg[3]) &&
      (msg.length === 4 || msg.length === 5 && isObject(msg[4]))
  },

  ping: function ping (msg) {
    return msg.length === 2 && isNumber(msg[1])
  },

  pong: function pong (msg) {
    return msg.length === 2 && isNumber(msg[1])
  },

  sync: function sync (msg) {
    if (!isNumber(msg[1])) return false
    if (msg.length % 2 !== 0) return false

    for (var i = 2; i < msg.length; i++) {
      if (!isObject(msg[i])) return false
      if (i % 2 === 0 && !isString(msg[i].type)) return false
    }

    return true
  },

  synced: function synced (msg) {
    return msg.length === 2 && isNumber(msg[1])
  },

  error: function error (msg) {
    return (msg.length === 2 || msg.length === 3) && isString(msg[1])
  },

  test: function test () {
    return true
  }
}

function wrongFormat (sync, msg) {
  sync.sendError(new SyncError(sync, 'wrong-format', JSON.stringify(msg)))
  sync.connection.disconnect('error')
  return false
}

function validate (sync, msg) {
  if (!isArray(msg)) return wrongFormat(sync, msg)

  var name = msg[0]
  if (!isString(name)) return wrongFormat(sync, msg)

  var validator = validators[name]
  if (!validator || !sync[name + 'Message']) {
    sync.sendError(new SyncError(sync, 'unknown-message', name))
    sync.connection.disconnect('error')
    return false
  }

  if (!validator(msg)) {
    return wrongFormat(sync, msg)
  } else {
    return true
  }
}

module.exports = validate
