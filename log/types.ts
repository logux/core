import { type Action, Log, MemoryStore } from '../index.js'

let log = new Log({ nodeId: 'test1', store: new MemoryStore() })

log.add({ name: 'Kate', type: 'user/add' })

log.add({ name: 'Kate', type: 'user/add' }, { extra: 1 })

log.add([
  [{ name: 'Kate', type: 'user/add' }],
  [{ name: 'Ann', type: 'user/add' }, { extra: 1 }]
])

log.removeReason('user', { index: 'users/1' })

log.removeReason(['users/1', 'users/2'], { maxAdded: 10 })

log.addReason('user', { id: '1 test' })

log.addReason(['users/1', 'users/2'])

log.on('batch', entries => {
  for (let [action, meta] of entries) {
    console.log(action.type, meta.id)
  }
})

type RenameAction = {
  name: string
  type: 'rename'
} & Action

log.type<RenameAction>('rename', action => {
  document.title = action.name
})

log.type('rename', action => {
  console.log(action)
})
