let LocalPair = require('../local-pair')

function listen (tracker, connection) {
  let actions = []
  connection.on('connecting', () => {
    actions.push(['connecting'])
    if (tracker.waiting) tracker.waiting()
  })
  connection.on('connect', () => {
    actions.push(['connect'])
    if (tracker.waiting) tracker.waiting()
  })
  connection.on('disconnect', reason => {
    actions.push(['disconnect', reason])
    if (tracker.waiting) tracker.waiting()
  })
  connection.on('message', msg => {
    actions.push(msg)
    if (tracker.waiting) tracker.waiting()
  })
  return actions
}

function createTracker (delay) {
  let result = {
    pair: new LocalPair(delay),
    wait () {
      return new Promise(resolve => {
        result.waiting = () => {
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

it('has right link between connections', () => {
  let pair = new LocalPair()
  expect(pair.left.other()).toBe(pair.right)
  expect(pair.right.other()).toBe(pair.left)
})

it('throws a error on disconnection in disconnected state', () => {
  let pair = new LocalPair()
  expect(() => {
    pair.left.disconnect()
  }).toThrow(/already finished/)
})

it('throws a error on message in disconnected state', () => {
  let pair = new LocalPair()
  expect(() => {
    pair.left.send(['test'])
  }).toThrow(/started before sending/)
})

it('throws a error on connection in connected state', async () => {
  let pair = new LocalPair()
  await pair.left.connect()
  expect(() => {
    pair.left.connect()
  }).toThrow(/already established/)
})

it('sends a connect event', async () => {
  let tracker = createTracker()
  expect(tracker.left).toEqual([])

  let connecting = tracker.pair.left.connect()
  expect(tracker.left).toEqual([['connecting']])
  expect(tracker.right).toEqual([])

  await connecting
  expect(tracker.left).toEqual([['connecting'], ['connect']])
  expect(tracker.right).toEqual([['connect']])
})

it('sends a disconnect event', async () => {
  let tracker = createTracker()
  await tracker.pair.left.connect()
  tracker.pair.right.disconnect('error')
  expect(tracker.left).toEqual([['connecting'], ['connect']])
  expect(tracker.right).toEqual([['connect'], ['disconnect', 'error']])
  await tracker.wait()
  expect(tracker.left).toEqual([
    ['connecting'],
    ['connect'],
    ['disconnect', undefined]
  ])
  expect(tracker.right).toEqual([['connect'], ['disconnect', 'error']])
})

it('sends a message event', async () => {
  let tracker = createTracker()
  await tracker.pair.left.connect()
  tracker.pair.left.send(['test'])
  expect(tracker.right).toEqual([['connect']])
  await tracker.wait()
  expect(tracker.left).toEqual([['connecting'], ['connect']])
  expect(tracker.right).toEqual([['connect'], ['test']])
})

it('emulates delay', async () => {
  let tracker = createTracker(50)
  expect(tracker.pair.delay).toEqual(50)

  let prevTime = Date.now()
  await tracker.pair.left.connect()
  expect(Date.now() - prevTime).toBeGreaterThanOrEqual(48)

  prevTime = Date.now()
  tracker.pair.left.send(['test'])
  await tracker.wait()
  expect(Date.now() - prevTime).toBeGreaterThanOrEqual(48)
})
