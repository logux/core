import { Log, MemoryStore, Action } from '../index.js'

let log = new Log({ nodeId: 'test1', store: new MemoryStore() })

log.add({ type: 'user/add', name: 'Kate' })

log.add({ type: 'user/add', name: 'Kate' }, { extra: 1 })

type RenameAction = Action & {
  type: 'rename'
  name: string
}

log.type<RenameAction>('rename', action => {
  document.title = action.name
})

log.type('rename', action => {
  console.log(action)
})
