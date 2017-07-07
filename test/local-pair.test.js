var LocalPair = require('../local-pair')

function listen (tracker, connection) {
  var actions = []
  connection.on('connecting', function () {
    actions.push(['connecting'])
    if (tracker.waiting) tracker.waiting()
  })
  connection.on('connect', function () {
    actions.push(['connect'])
    if (tracker.waiting) tracker.waiting()
  })
  connection.on('disconnect', function (reason) {
    actions.push(['disconnect', reason])
    if (tracker.waiting) tracker.waiting()
  })
  connection.on('message', function (msg) {
    actions.push(msg)
    if (tracker.waiting) tracker.waiting()
  })
  return actions
}

function createTracker (delay) {
  var result = {
    pair: new LocalPair(delay),
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
  expect(tracker.left).toEqual([])

  var connecting = tracker.pair.left.connect()
  expect(tracker.left).toEqual([['connecting']])
  expect(tracker.right).toEqual([])

  return connecting.then(function () {
    expect(tracker.left).toEqual([['connecting'], ['connect']])
    expect(tracker.right).toEqual([['connect']])
  })
})

it('sends a disconnect event', function () {
  var tracker = createTracker()
  return tracker.pair.left.connect().then(function () {
    tracker.pair.right.disconnect('error')
    expect(tracker.left).toEqual([['connecting'], ['connect']])
    expect(tracker.right).toEqual([['connect'], ['disconnect', 'error']])
    return tracker.wait()
  }).then(function () {
    expect(tracker.left).toEqual([
      ['connecting'],
      ['connect'],
      ['disconnect', undefined]
    ])
    expect(tracker.right).toEqual([['connect'], ['disconnect', 'error']])
  })
})

it('sends a message event', function () {
  var tracker = createTracker()
  return tracker.pair.left.connect().then(function () {
    tracker.pair.left.send(['test'])
    expect(tracker.right).toEqual([['connect']])
    return tracker.wait()
  }).then(function () {
    expect(tracker.left).toEqual([['connecting'], ['connect']])
    expect(tracker.right).toEqual([['connect'], ['test']])
  })
})

it('emulates delay', function () {
  var tracker = createTracker(50)
  expect(tracker.pair.delay).toEqual(50)

  var prevTime = Date.now()
  return tracker.pair.left.connect().then(function () {
    expect(Date.now() - prevTime).toBeGreaterThanOrEqual(50)

    prevTime = Date.now()
    tracker.pair.left.send(['test'])
    return tracker.wait()
  }).then(function () {
    expect(Date.now() - prevTime).toBeGreaterThanOrEqual(48)
  })
})
