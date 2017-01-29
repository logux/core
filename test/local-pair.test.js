var LocalPair = require('../local-pair')

function listen (tracker, connection) {
  var actions = []
  connection.on('connect', function () {
    actions.push('connect')
    if (tracker.waiting) tracker.waiting()
  })
  connection.on('disconnect', function () {
    actions.push('disconnect')
    if (tracker.waiting) tracker.waiting()
  })
  connection.on('message', function (msg) {
    actions.push(msg)
    if (tracker.waiting) tracker.waiting()
  })
  return actions
}

function createTracker () {
  var result = {
    pair: new LocalPair(),
    wait: function () {
      return new Promise(function (resolve) {
        result.waiting = function () {
          result.waiting = false
          resolve()
        }
      })
    }
  }
  result.left = listen(result, result.pair.left)
  result.right = listen(result, result.pair.right)
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
  return pair.left.connect().then(function () {
    expect(function () {
      pair.left.connect()
    }).toThrowError(/already established/)
  })
})

it('sends a connect event', function () {
  var tracker = createTracker()

  var connecting = tracker.pair.left.connect()
  expect(tracker.left).toEqual([])
  expect(tracker.right).toEqual([])

  return connecting.then(function () {
    expect(tracker.left).toEqual(['connect'])
    expect(tracker.right).toEqual(['connect'])
  })
})

it('sends a disconnect event', function () {
  var tracker = createTracker()
  return tracker.pair.left.connect().then(function () {
    tracker.pair.right.disconnect()
    expect(tracker.left).toEqual(['connect'])
    expect(tracker.right).toEqual(['connect', 'disconnect'])
    return tracker.wait()
  }).then(function () {
    expect(tracker.left).toEqual(['connect', 'disconnect'])
    expect(tracker.right).toEqual(['connect', 'disconnect'])
  })
})

it('sends a message event', function () {
  var tracker = createTracker()
  return tracker.pair.left.connect().then(function () {
    tracker.pair.left.send(['test'])
    expect(tracker.right).toEqual(['connect'])
    return tracker.wait()
  }).then(function () {
    expect(tracker.left).toEqual(['connect'])
    expect(tracker.right).toEqual(['connect', ['test']])
  })
})
