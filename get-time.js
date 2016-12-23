/**
 * Return milliseconds from UNIX epoch, when action was created.
 *
 * If action was synchronized from different machine with different time,
 * this function will use `meta.timeFix` to fix time difference
 * between machines.
 *
 * @param {Meta} meta The action’s metadata.
 *
 * @return {number} Milliseconds from UNIX epoch, when action was created.
 *
 * @example
 * import { getTime } from 'logux-core'
 * if (action.type === 'user:add') {
 *   const time = getTime(meta)
 *   console.log('User was created at ', new Date(time))
 * }
 */
function getTime (meta) {
  if (meta.timeFix) {
    return meta.id[0] + meta.timeFix
  } else {
    return meta.id[0]
  }
}

module.exports = getTime
