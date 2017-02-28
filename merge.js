module.exports = function merge (opts, defaults) {
  if (!opts) opts = { }
  for (var i in defaults) {
    if (typeof opts[i] === 'undefined') opts[i] = defaults[i]
  }
  return opts
}
