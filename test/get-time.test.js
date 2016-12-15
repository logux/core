var getTime = require('../get-time')

it('returns first part of ID array', function () {
  var meta = { id: [100, 'node'] }
  expect(getTime(meta)).toEqual(100)
})

it('fixes time difference', function () {
  var meta = { id: [100, 'node'], timeFix: 10 }
  expect(getTime(meta)).toEqual(110)
})
