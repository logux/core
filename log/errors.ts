import { Log, MemoryStore } from '../index.js'

let log = new Log({ nodeId: 'test1', store: new MemoryStore() })

// THROWS '{ name: string; }' is not assignable to parameter of type 'Action
log.add({ name: 'Kate' })

// THROWS Type 'number' is not assignable to type 'string | undefined
log.add({ type: 'user/add', name: 'Kate' }, { id: 1 })

log.type('user/add', action => {
  // THROWS 'false' since the types '"user/add"' and '"user/remove"'
  if (action.type === 'user/remove') {
    console.log(action)
  }
})
