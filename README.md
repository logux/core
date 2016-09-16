# Logux Core

Log for Logux with default timer and test tools. It is base classes, end-users
should use high-level Logux tools.

Logux idea is based on shared logs. Log is list of events ordered by time.
Every entry in Logux log contains event object and meta object with created
and added times.

```js
import { Log } from 'logux-core'
const log = new Log({ store, timer })
```

## Event

Logux event is a simple JS object. There is only one mandatory property, `type`.
Logux events is very similar to Redux actions.

```js
log.add({ type: 'beep' })
```

Events from third-party libraries must prefix `type` with library name
and `/` separator. For example, `example` library should use events types
like `example/name`

## Created Time

Log order is key idea of Logux. So Logux log contains event creation time.

Log will set current time for new events automatically. But you could set
creation time manually (for example, if you got event from different machine).

```js
import { createTimer } from 'logux-core'
const log = new Log({ store, timer: createTimer(host) })
```

Log order should be same on every machine. So every creation time
should be unique (you could used it as event ID).

This is why creation time is a little bit tricky.
Default timer return array with:

1. Milliseconds elapsed since 1 January 1970.
2. Unique host name.
3. Incremented number if latest time had same milliseconds.

```js
const timer = createTimer('host')

timer() //=> [1473564435318, 'host', 0]
timer() //=> [1473564435318, 'host', 1]
timer() //=> [1473564435319, 'host', 0]

const timer2 = createTimer('host2')

timer2() //=> [1473564435320, 'host2', 0]
timer()  //=> [1473564435320, 'host', 0]
```

### Custom Timer

You can change log timer to any other implementation. The only rule
is to use same timer on every machine.

Logux time is an array on simple comparable types (like numbers or string).

Timer should a function, that return new time array on every call.

### Helper

`compareTime()` helper from this package could be useful for many cases:

```js
import { compareTime } from 'logux-core'

compareTime(older, younder) //=>  1
compareTime(older, older)   //=>  0
compareTime(younder, older) //=> -1
```

### Test Timer

Logux Core contains easy timer for tests. It just returns array incremented
with number:

```js
import { createTestTimer } from 'logux-core'
const testTimer = createTestTimer()

testTimer() //=> [1]
testTimer() //=> [2]
testTimer() //=> [3]
```

## Added Time

Also log contains time, when event was added to this log. So added time could
be different on different machines. And this time is much easier,
just a incremented number.

This time is used to find, what events should be sent when
two nodes connected again.

```js
log.add({ type: 'beep' })                    //=> added: 1
log.add({ type: 'beep' }, { created: past }) //=> added: 2
```

## Reading

There is a two way to read events from log. First you can subscribe
for new events:

```js
log.listen((event, meta) => {
  console.log(event, meta)
})
log.add({ type: 'test' })
// outputs { type: 'test' }, { created: time, added: 1 }
```

To unbind listener call function returned from `listen`.

Second way is to run asynchronous event iterator:

```js
log.each((event, meta) => {
  // for every event
}).then(() => {
  // when iteration process all everts or iterator stop iteration
})
```

Iterator could return `false` to stop iteration:

```js
log.each(event => {
  if ( compareTime(event.time, lastBeep) <= 0 ) {
    return false;
  } else if ( event.type === 'beep' ) {
    beep()
    lastBeep = event.time
    return false;
  }
})
```

By default, `each()` iterates by event creation time. You could set order
by adding time:

```js
log.each({ order: 'added' }, (event, meta) => {
  if (meta.added > lastSync) {
    send(event, meta)
  } else {
    return false
  }
})
```

## Cleaning

To keep log fast, Logux clean it from outdated events.
Note, that by default, Logux cleans every event in log.

If third-party library needs some events in future, it should set keeper,
function that will return `true` on every important event.

For example, development tools could keep latest 1000 events to show log:

```js
let lastCreated = 0
let count = 0
log.keep((event, meta) => {
  if (compareTime(meta.created, lastCreated) > 0) {
    count = 0
  }
  count += 1
  return count > 1000
})
```

Or CRDT module could keep events with latest value for every property.

Cleaning should be started manually by `clean()` method:

```js
let events = 0
log.listen(event => {
  events += 1
  if (events > 100) {
    events = 0
    setImmediate(() => log.clean())
  }
})
```

## Stores

Log should be saved to `localStorage` in browser or file on server.
Also server log could be very big (bigger than memory). This is why Logux
has changeable log stores.

### MemoryStore

This package contains simple in-memory store to use it in tests:

```js
import { MemoryStore } from 'logux-core'
const log = new Log({ timer, store: new MemoryStore() })
```

### Custom Store

Store could be a any object with 3 methods:

* `add(entry)` puts new log entry to store.
* `remove(created)` removes event by event creation time.
* `get()` returns Promise to load first events page. Events page is a object
  with entries array in `page.date` and `page.next` function with next page
  Promise. Last page should not contain `page.next`.
