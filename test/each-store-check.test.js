let eachStoreCheck = require('../each-store-check')
let MemoryStore = require('../memory-store')

eachStoreCheck((desc, creator) => {
  if (desc === 'cleans whole store if implemented') {
    it('works with stores without clean method', creator(() => {
      let store = new MemoryStore()
      store.clean = undefined
      return store
    }))
  }
})
