import { MemoryStore, eachStoreCheck } from '..'

eachStoreCheck((desc, creator) => {
  it(
    `${desc}`,
    creator(() => new MemoryStore())
  )
})
