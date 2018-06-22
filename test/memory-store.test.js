var eachStoreCheck = require('../each-store-check')

var MemoryStore = require('../memory-store')

eachStoreCheck(function (desc, creator) {
  it(desc, creator(function () {
    return new MemoryStore()
  }))
})
