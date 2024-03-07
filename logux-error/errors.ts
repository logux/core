import { LoguxError } from '../index.js'

// THROWS 'number' is not assignable to parameter of type 'void'
new LoguxError('bruteforce', 10)
// THROWS 'a' does not exist in type 'Versions'
new LoguxError('wrong-protocol', { a: 1 })
