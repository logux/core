let { MemoryStore, eachStoreCheck } = require('..')

eachStoreCheck((desc, creator) => {
  it(
    `${desc}`,
    creator(() => new MemoryStore())
  )
})
