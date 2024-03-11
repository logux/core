import { Log, MemoryStore, Action } from '../index.js'

let log = new Log({ nodeId: 'test1', store: new MemoryStore() })

// THROWS 'name' does not exist in type 'Action'
log.add({ name: 'Kate' })

// THROWS 'number' is not assignable to type 'string'
log.add({ type: 'user/add', name: 'Kate' }, { id: 1 })

type RenameAction = Action & {
  type: 'rename'
  name: string
}

// THROWS '"rename2"' is not assignable to parameter of type '"rename"'
log.type<RenameAction>('rename2', action => {
  document.title = action.name
})

log.type<RenameAction>('rename', action => {
  // THROWS 'fullName' does not exist on type 'RenameAction'
  document.title = action.fullName
})
