var eachTest = require('logux-store-tests')

var MemoryStore = require('../memory-store')

eachTest(function (desc, creator) {
  it(desc, creator(function () {
    return new MemoryStore()
  }))
})
