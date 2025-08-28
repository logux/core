import { LoguxError } from '../index.js'

new LoguxError('timeout', 10, true)
new LoguxError('wrong-protocol', { supported: 2, used: 1 })
new LoguxError('bruteforce')
