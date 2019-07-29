let eachStoreCheck = require('../each-store-check')
let MemoryStore = require('../memory-store')

eachStoreCheck((desc, creator) => {
  it(desc, creator(() => new MemoryStore()))
})
