import { Log, MemoryStore } from '..'

let log = new Log({ nodeId: 'test1', store: new MemoryStore() })

// THROWS '{ name: string; }' is not assignable to parameter of type 'Action'.
log.add({ name: 'Kate' })
