import { LoguxError } from '..'

new LoguxError('timeout', 10, true)
new LoguxError('wrong-protocol', { used: '1.0.0', supported: '1.1.0' })
new LoguxError('bruteforce')
