# Logux Core

Log for Logux, default timer and test tools. These are low-level base classes,
and Logux end-users are supposed use high-level Logux tools.

Logux idea is based on shared logs. Log is a list of events ordered in time.
Every entry in Logux log contains event object and meta object.

Instead of event object, only few properties from meta could be synchronized
between log. Meta is open structure and could contains any data. But at least
it should contain two properties: `id` and `added`.

```js
import { Log } from 'logux-core'
const log = new Log({ store, timer })
```

<a href="https://evilmartians.com/?utm_source=logux-core">
  <img src="https://evilmartians.com/badges/sponsored-by-evil-martians.svg"
       alt="Sponsored by Evil Martians" width="236" height="54">
</a>


## Event

Logux event is a simple JS object, having only one mandatory property — `type`.
Logux events are very similar to Redux actions.

```js
log.add({ type: 'beep' })
```

Events from third-party libraries must prefix `type` with library name
and `/` separator. For example, `example` library should use events types
like `example/name`.


## Event ID

Log order is strictly required to be the same on every machine.
For this reason, every event metadata contains ID to order events by this ID.

ID is a array of `number` or `string`. Logux will compare array items
to find what event is older. So every new event ID should be bigger
than previous one.

Default ID format:

1. Number of milliseconds elapsed since 1 January 1970.
2. Unique node name.
3. An incremented number in case if the previous event
   had the same number of milliseconds.

This format is tricky to keep ID unique on every machine. Also this format
allows you to get real time , when event was occured.

```js
[1473564435318, 'server', 0]
[1473564435318, 'server', 1]
[1473564435319, 'server', 0]
```

But you can use any event ID format. Just use same format for all clients.


### Timer

Timer is a function to create unique event ID. Logux use it to set ID
for new events automatically.

```js
log.add({ type: 'beep' })
log.each((event, meta) => {
  meta.id //=> [1473564435318, 'server', 0]
})
```

But you can set it manually as well
(for example, if you got event from a different machine).

```js
log.add({ type: 'beep' }, { id: [1473564435318, 'user:1', 0] })
```

Timer with default ID format could be created by `createTimer`:

```js
import { createTimer } from 'logux-core'
const log = new Log({ store, timer: createTimer('user:2') })
log.timer() //=> [1473564435318, 'user:2', 0]
```


### Test Timer

Because default timer use current time, it could not be very useful in test.
For tests you can create simpler timer with `createTestTimer`.

```js
import { createTestTimer } from 'logux-core'
const testTimer = createTestTimer()

testTimer() //=> [1]
testTimer() //=> [2]
testTimer() //=> [3]
```

If you test two logs, don’t forget to use same test timer instance for them:

```js
const testTimer = createTestTimer()
const log1 = new Log({ store1, timer: testTimer })
const log2 = new Log({ store2, timer: testTimer })
```


### Helper

`compareTime()` helper from this package could be useful for many cases:

```js
import { compareTime } from 'logux-core'

compareTime(older, younger) //=>  1
compareTime(older, older)   //=>  0
compareTime(younger, older) //=> -1
```


## Added Number

Event metadata has also `added` with sequence number. Every next event added
to current log will get bigger `added` number.

After synchronization events from other log could have lower `id`,
because they was created before synchronization. But `added` shows only when
event was added to this log, now when thay was created.

As result events in synchronized logs will have same `id`, but different
`added` metadata.

This time is used to find, which events should be sent when two
nodes are connected again.

```js
log.add({ type: 'beep' })               //=> added: 1
log.add({ type: 'beep' }, { id: past }) //=> added: 2
```


## Reading

There are two ways to read events from the log.
First, one can subscribe to new events:

```js
log.on('event', (event, meta) => {
  console.log(event, meta)
})
log.add({ type: 'test' })
// Prints { type: 'test' }, { id: id, added: 1 }
```

Log implements [nanoevents] API, so if you want to unbind the listener,
just call the function returned by `on`.

[nanoevents]: https://github.com/ai/nanoevents

The second way is to run asynchronous event iterator:

```js
log.each((event, meta) => {
  // for every event
}).then(() => {
  // when iteration process all everts or iterator stop iteration
})
```

An iterator can return `false` in order to stop the iteration process:

```js
log.each((event, meta) => {
  if ( compareTime(meta.id, lastBeep) <= 0 ) {
    return false;
  } else if ( event.type === 'beep' ) {
    beep()
    lastBeep = event.time
    return false;
  }
})
```

By default, `each()` orders events by their creation time.
You could specify custom ordering, e.g. by the adding time:

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

To keep the log fast, Logux cleans it from outdated events.
Note, that by default, Logux removes every event from the log.

If third-party library will need some events in the future,
it should setup a keeper. A keeper is just a function returning `true`
for important events supposed to be kept in the log.

Log emits `clean` event before the keepers execution and cleaning.

For example, DevTools may need to keep latest 1000 events in the log:

```js
let count = 0
log.on('clean', () => {
  count = 0
})
log.keep((event, meta) => {
  count += 1
  return count > 1000
})
```

Another example may be CRDT module keeping events with the latest property value.

Cleaning should be started manually by calling `clean()` method:

```js
let events = 0
log.on('event', event => {
  events += 1
  if (events > 100) {
    events = 0
    setImmediate(() => log.clean())
  }
})
```


### Automatic Cleaning

Logux Core contains a function named `cleanEvery()`. It installs a listener
for the log which will repeatedly call `clean()` after the specified
number of events was logged.

By default, it will clean log after each 100 events:

```js
import { cleanEvery } from 'logux-core'
cleanEvery(log)
```

It returns a `stopCleaning` function. Call if you want to remove the listener
from the log.


## Stores

Log should be saved to `localStorage` in browser or a file on server.
The server log can grow very big, exceeding the available memory.
This is why Logux has changeable log stores.


### MemoryStore

This package contains simple in-memory store designed primarily for tests:

```js
import { MemoryStore } from 'logux-core'
const log = new Log({ timer, store: new MemoryStore() })
```


### Custom Store

Any object implementing this 3 methods can be considered a Store:

* `add(entry)` puts new log entry in the store. Returns a Promise `false`
  if event with same `id` was already in log.
* `remove(id)` removes an event from the store.
* `get()` returns a Promise loading the first page of events in the log.
  Events page is an object containing an entries array in `page.entries`
  and a `page.next` function returning the next page Promise.
  Last page should not contain the `page.next` method.
