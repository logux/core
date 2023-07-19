import { LoguxError } from '../index.js'

new LoguxError('timeout', 10, true)
new LoguxError('wrong-protocol', { supported: '1.1.0', used: '1.0.0' })
new LoguxError('bruteforce')
