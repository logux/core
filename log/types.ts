import { type Action, Log, MemoryStore } from '../index.js'

let log = new Log({ nodeId: 'test1', store: new MemoryStore() })

log.add({ name: 'Kate', type: 'user/add' })

log.add({ name: 'Kate', type: 'user/add' }, { extra: 1 })

type RenameAction = Action & {
  name: string
  type: 'rename'
}

log.type<RenameAction>('rename', action => {
  document.title = action.name
})

log.type('rename', action => {
  console.log(action)
})
