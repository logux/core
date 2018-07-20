var eachStoreCheck = require('../each-store-check')

var MemoryStore = require('../memory-store')

eachStoreCheck(function (desc, creator) {
  if (desc === 'cleans whole store if implemented') {
    it('works with stores without clean method', creator(function () {
      var store = new MemoryStore()
      store.clean = undefined
      return store
    }))
  }
})
