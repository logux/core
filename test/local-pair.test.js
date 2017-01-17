var LocalPair = require('../local-pair')

function listen (connection) {
  var actions = []
  connection.on('connect', function () {
    actions.push('connect')
  })
  connection.on('disconnect', function () {
    actions.push('disconnect')
  })
  connection.on('message', function (msg) {
    actions.push(msg)
  })
  return actions
}

function createTracker () {
  var result = { pair: new LocalPair() }
  result.left = listen(result.pair.left)
  result.right = listen(result.pair.right)
  return result
}

it('has right link between connections', function () {
  var pair = new LocalPair()
  expect(pair.left.other()).toBe(pair.right)
  expect(pair.right.other()).toBe(pair.left)
})

it('throws a error on disconnection in disconnected state', function () {
  var pair = new LocalPair()
  expect(function () {
    pair.left.disconnect()
  }).toThrowError(/already finished/)
})

it('throws a error on message in disconnected state', function () {
  var pair = new LocalPair()
  expect(function () {
    pair.left.send(['test'])
  }).toThrowError(/started before sending/)
})

it('throws a error on connection in connected state', function () {
  var pair = new LocalPair()
  pair.left.connect()
  expect(function () {
    pair.left.connect()
  }).toThrowError(/already established/)
})

it('sends a connect event', function () {
  var tracker = createTracker()

  expect(tracker.left).toEqual([])
  expect(tracker.right).toEqual([])

  tracker.pair.left.connect()
  expect(tracker.left).toEqual(['connect'])
  expect(tracker.right).toEqual(['connect'])
})

it('sends a disconnect event', function () {
  var tracker = createTracker()
  tracker.pair.left.connect()

  expect(tracker.left).toEqual(['connect'])
  expect(tracker.right).toEqual(['connect'])

  tracker.pair.right.disconnect()
  expect(tracker.left).toEqual(['connect', 'disconnect'])
  expect(tracker.right).toEqual(['connect', 'disconnect'])
})

it('sends a message event', function () {
  var tracker = createTracker()
  tracker.pair.left.connect()
  tracker.pair.left.send(['test'])
  expect(tracker.left).toEqual(['connect'])
  expect(tracker.right).toEqual(['connect', ['test']])
})
