import { Log, MemoryStore } from '..'

let log = new Log({ nodeId: 'test1', store: new MemoryStore() })

log.add({ type: 'user/add', name: 'Kate' })

log.add({ type: 'user/add', name: 'Kate' }, { extra: 1 })
