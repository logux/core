import { MemoryStore, eachStoreCheck } from '../index.js'

eachStoreCheck((desc, creator) => {
  it(
    `${desc}`,
    creator(() => new MemoryStore())
  )
})
