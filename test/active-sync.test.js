var ActiveSync = require('../active-sync')
var LocalPair = require('../local-pair')

it('connects first', function () {
  var log = { on: function () { } }
  var pair = new LocalPair()
  var sync = new ActiveSync('host', log, pair.left)

  sync.sendConnect = jest.fn()
  pair.left.connect()
  expect(sync.sendConnect).toBeCalled()
})
