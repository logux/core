import { delay } from 'nanodelay'
import { deepStrictEqual, equal, ok, throws } from 'node:assert'
import { test } from 'node:test'

import { type Connection, LocalPair, type Message } from '../index.js'

type Event =
  | ['connect']
  | ['connecting']
  | ['disconnect', string]
  | ['message', Message]

function track(tracker: Tracker, connection: Connection): Event[] {
  let events: Event[] = []
  connection.on('connecting', () => {
    events.push(['connecting'])
    tracker.waiting?.()
  })
  connection.on('connect', () => {
    events.push(['connect'])
    tracker.waiting?.()
  })
  connection.on('disconnect', reason => {
    events.push(['disconnect', reason])
    tracker.waiting?.()
  })
  connection.on('message', msg => {
    events.push(['message', msg])
    tracker.waiting?.()
  })
  return events
}

class Tracker {
  left: Event[]

  pair: LocalPair

  right: Event[]

  waiting?: () => void

  constructor(delayMs?: number) {
    this.pair = new LocalPair(delayMs)
    this.left = track(this, this.pair.left)
    this.right = track(this, this.pair.right)
  }

  wait(): Promise<void> {
    return new Promise<void>(resolve => {
      this.waiting = () => {
        delete this.waiting
        resolve()
      }
    })
  }
}

test('has right link between connections', () => {
  let pair = new LocalPair()
  equal(pair.left.other(), pair.right)
  equal(pair.right.other(), pair.left)
})

test('throws a error on disconnection in disconnected state', () => {
  let pair = new LocalPair()
  throws(() => {
    pair.left.disconnect()
  }, /already finished/)
})

test('throws a error on message in disconnected state', () => {
  let pair = new LocalPair()
  throws(() => {
    pair.left.send(['ping', 1])
  }, /started before sending/)
})

test('throws a error on connection in connected state', async () => {
  let pair = new LocalPair()
  await pair.left.connect()
  throws(() => {
    pair.left.connect()
  }, /already established/)
})

test('sends a connect event', async () => {
  let tracker = new Tracker()
  deepStrictEqual(tracker.left, [])

  let connecting = tracker.pair.left.connect()
  deepStrictEqual(tracker.left, [['connecting']])
  deepStrictEqual(tracker.right, [])

  await connecting
  deepStrictEqual(tracker.left, [['connecting'], ['connect']])
  deepStrictEqual(tracker.right, [['connect']])
})

test('sends a disconnect event', async () => {
  let tracker = new Tracker()
  await tracker.pair.left.connect()
  tracker.pair.right.disconnect('error')
  deepStrictEqual(tracker.left, [['connecting'], ['connect']])
  deepStrictEqual(tracker.right, [['connect'], ['disconnect', 'error']])
  await tracker.wait()
  deepStrictEqual(tracker.left, [
    ['connecting'],
    ['connect'],
    ['disconnect', undefined]
  ])
  deepStrictEqual(tracker.right, [['connect'], ['disconnect', 'error']])
})

test('sends a message event', async () => {
  let tracker = new Tracker()
  await tracker.pair.left.connect()
  tracker.pair.left.send(['ping', 1])
  deepStrictEqual(tracker.right, [['connect']])
  await tracker.wait()
  deepStrictEqual(tracker.left, [['connecting'], ['connect']])
  deepStrictEqual(tracker.right, [['connect'], ['message', ['ping', 1]]])
})

test('emulates delay', async () => {
  let tracker = new Tracker(50)
  equal(tracker.pair.delay, 50)

  let prevTime = Date.now()
  await tracker.pair.left.connect()
  ok(Date.now() - prevTime >= 48)

  prevTime = Date.now()
  tracker.pair.left.send(['ping', 1])
  await tracker.wait()
  ok(Date.now() - prevTime >= 48)
})

test('allows disconnect during connecting', async () => {
  let tracker = new Tracker(10)
  tracker.pair.left.connect()
  tracker.pair.left.disconnect()
  await delay(50)
  deepStrictEqual(tracker.left, [['connecting'], ['disconnect', undefined]])
  deepStrictEqual(tracker.right, [])
})
