# Logux Core [![Cult Of Martians][cult-img]][cult]

<img align="right" width="95" height="95" title="Logux logo"
     src="https://cdn.rawgit.com/logux/logux/master/logo.svg">

Log for Logux and test tools for log.

Logux idea is based on shared logs. Log is a list of actions ordered in time.
Every entry in Logux log contains action object and meta object with:

* `id`: unique action ID to have same actions order on every machine.
* `time`: action creation time. Could be different on different machines,
  because could contain calculated time different between client and server.
* `added`: sequence number when action was insert to current log.
  It is used to find actions since last synchronization.

In most use cases, you don’t need to create log, high-level Logux tools
will do it for you. But you will have access to log API from that tools.

```js
import isFirstOlder from 'logux-core/is-first-older'

let lastRename
log.on('add', (action, meta) => {
  switch (action.type) {

    case 'RENAME':
      // Simple last-writer-wins
      if (isFirstOlder(lastRename, meta)) {
        changeName(action.name)
        lastRename = meta
      }
      break

  }
})

rename.addEventListener('click', () => {
  log.add({ type: 'rename', name: name.value })
})
```

Logux is in early beta, however we use it in production
for our [SaaS social media scheduling platform, Amplifr](https://amplifr.com).

[cult-img]: http://cultofmartians.com/assets/badges/badge.svg
[cult]: http://cultofmartians.com/done.html

<a href="https://evilmartians.com/?utm_source=logux-core">
  <img src="https://evilmartians.com/badges/sponsored-by-evil-martians.svg"
       alt="Sponsored by Evil Martians" width="236" height="54">
</a>


## Basic Concepts

### Action

Logux action is a simple JS object, having only one mandatory `type` property.
Logux actions are very similar to Redux actions.

```js
log.add({ type: 'RENAME', name: 'New' })
```

Actions from third-party libraries must prefix `type` with library name
and `/` separator. For example, `example` library should use actions types
like `example/name`.


### Metadata

Action metadata is an open structure. It has only 3 mandatory properties:
`id`, `time`, `added`.

```js
log.add({ type: 'FOO' }).then(meta => {
  meta //=> { id: [1473564435318, 'server', 0], time: 1473564435318, added: 1 }
})
```

You could add own properties. Just add project name project with `/` separator.
For example, `example` library should use meta like `example/name`.

```js
log.add({ type: 'FOO' }, { 'example/foo': 1 }).then(meta => {
  meta['example/foo'] //=> 1
})
```


### Action ID

Log order is strictly required to be the same on every machine.
For this reason, every action metadata contains `meta.id`
to order actions by this ID.

ID is an array of:

1. Number of milliseconds elapsed since 1 January 1970.
2. Unique node ID.
3. An incremented number in case if the previous action
   had the same number of milliseconds.

```js
[1473564435318, 'server', 0]
[1473564435318, 'server', 1]
[1473564435319, 'server', 0]
```

This format is tricky to keep ID unique on every machine.


### Time

Action creation time could be found in `meta.time`
in milliseconds elapsed since 1 January 1970.

```js
const time = new Date(meta.time)
console.log('Last edit was at ' + time.toString())
```

Some machines could have wrong time or time zone. To fix it most
of Logux clients detect time difference between client and server time.

Several actions could be created in same milliseconds, so you should not
use `meta.time` to find older action. Use special
`isFirstOlder(meta1, meta2)` helper.

```js
if (isFirstOlder(lastChange, meta)) {
  update(action)
  lastChange = meta
}
```

`meta.time` uses this time difference between client and server. So it contains
time according local system time. As a result, `meta.time` could be different
on different machines.

`meta.id` uses time in first position, but it doesn’t use time difference
between client as server. So `meta.id` is same on every machine
(as expected from ID).


### Added Number

Action metadata has `added` with sequence number. Every next action added
to current log will get bigger `added` number.

After synchronization actions from other log could have lower `id`,
because they was created before synchronization. But `added` shows only when
action was added to this log, not when they was created.

As result actions in synchronized logs will have the same `id`, but different
`added` metadata.

This time is used to find, which actions should be sent when two
nodes are connected again.

```js
log.add({ type: 'FOO' }).then(meta => {
  console.log(meta.added) //=> 1
})
log.add({ type: 'FOO' }, { id: old, time: past }).then(meta => {
  console.log(meta.added) //=> 2
})
```


### Reasons

There is no way to remove actions from log. If you need to revert change,
you need to add other action on top. But many actions become unnecessary
after some time (for instance, overrode by other actions) and we could
clean them to reduce log size.

This is why every action in log should have “reason of life”,
just string tag added by action creator or by `preadd` listener.

If action doesn’t have a reason, it will be emitted to `add` listeners,
but will not be saved to store.

```js
log.add({ type: 'OPEN_MENU' })
// Event listeners was emitted with OPEN_MENU
logSize(log) //=> 0

log.add({ type: 'FOR_SERVER' }, { reasons: ['sync'] })
// Event listeners was emitted with FOR_SERVER and it will saved to log
logSize(log) //=> 1
```

When actions become unnecessary, you could remove specific reason
from all actions. Logux will remove all actions, which lost all reasons.

```js
logSize(log) //=> 1

log.removeReason('sync')
logSize(log) //=> 0
```

If you need to keep only last value, there is a shortcut for it:

```js
log.add(action, { keepLast: 'app/lastName' })
```

It will be equal to:

```js
log.add(action, { reasons: ['app/lastName'] }).then(meta => {
  log.removeReason('app/lastName', { maxAdded: meta.added - 1 })
})
```


## Methods

### Adding

Method `add` will generate metadata for new event, add event to log store
and execute all `add` event listeners:

```js
log.add({ type: 'FOO' }).then(meta => {
  // Event was saved to store and all listener executed
  meta //=> { id: [1473564435318, 'server', 0], time: 1473564435318, added: 1 }
})
```

Action ID will be generated synchronously, so you can create events
in parallel:

```js
Promise.all([
  log.add({ type: 'FOO' }),
  log.add({ type: 'BAR' })
]).then(([fooMeta, barMeta]) => {
  isFirstOlder(fooMeta, barMeta) // always true
})
```

You can pass action metadata as second argument. Metadata is an open structure.
You can set any values there, just use project name prefix:

```js
log.add({ type: 'FOO' }, { 'example/foo': 1 }).then(meta => {
  meta['example/foo'] //=> 1
})
```

In custom synchronization tool you can set action ID manually.
Log will not generate them.

```js
log.add(syncedAction, { id, time }).then(meta => {
  if (!meta) console.log('Action was already in log')
})
```

If you set ID manually, log could contains action with same ID.
In this case log will ignore new action and pass `false` to Promise.


### Reading

There are two ways to read actions from the log.
First, one can subscribe to new actions:

```js
log.on('add', (action, meta) => {
  console.log(action, meta)
})
log.add({ type: 'TEST' })
// Prints { type: 'TEST' }, { id: […], time: 1473564435318, added: 1 }
```

Log implements [nanoevents] API, so if you want to unbind the listener,
just call the function returned by `on`.

[nanoevents]: https://github.com/ai/nanoevents

The second way is to run asynchronous action iterator:

```js
log.each((action, meta) => {
  // for every action
}).then(() => {
  // when iteration process all everts or iterator stop iteration
})
```

An iterator can return `false` in order to stop the iteration process:

```js
log.each((action, meta) => {
  if (isFirstOlder(meta, lastVisit)) {
    return false;
  } else if (action.type === 'RENAME') {
    console.log('User was renamed since last visit')
    return false;
  }
})
```

By default, `each()` orders actions by their creation time.
You could specify custom ordering, e.g. by the adding time:

```js
log.each({ order: 'added' }, (action, meta) => {
  if (meta.added > lastSync) {
    sendToServer(action, meta)
  } else {
    return false
  }
})
```


### Comparing

`isFirstOlder()` uses `meta.time` and `meta.id` to compare action creation
time even if they was created in same milliseconds.

```js
import isFirstOlder from 'logux-core/is-first-older'

isFirstOlder(meta1, meta2) //=> false
isFirstOlder(meta2, meta1) //=> true
```

If one of metadata will be `undefined`, this method will work with it
as it was created in the beginning of the time.

```js
isFirstOlder(anyMeta, undefined) //=> true
```

So you could use it with defined variable without value:

```js
let lastWrite
log.on('add', (action, meta) => {
  if (isFirstOlder(meta, lastWrite)) {
    write(action)
    lastWrite = meta
  }
})
```


### Cleaning

Logux use “reasons of life” to clean log from unnecessary actions
(for instance, overrode by other actions).

Without a `reasons` in metadata action will not even be saved to store.
But reason-less action still will be emitted in `add` event.
So if you need to save action for a while (for instance, to synchronize
it with server), you need to set reason.

First way, is to set in `add` method:

```js
log.add({ type: 'CHANGE_NAME' }, { reasons: ['sync'] })
```

Or by `preadd` listener. Note, that event is emitted before ID check,
so it is emitted even for actions, that was already in log.

```js
log.on('preadd', (action, meta) => {
  meta.reasons.push('devtools')
})
```

When you don’t need some actions anymore, you can remove your reason:

```js
sync.waitFor('synchronized').then(() => {
  log.removeReason('sync')
})
```

Also you can limit actions by `minAdded` and/or `maxAdded`:

```js
// Keep last 1000 actions
log.removeReason('devtools', { maxAdded: lastAdded - 1000 })
```

Action will be in log when it has at least one reason. When all reasons
will be removed, action will be cleaned from log.

Log will emit `clean` event on cleaning any action.

```js
log.on('clean', (action, meta) => {
  console.log('Action was cleaned: ', action, meta.id)
})
```


### Testing

Real logs use real time in actions ID, so log content will be different
on every test execution.

To fix it Logux has special logs for tests with simple sequence timer.
Also log already has node ID and uses in-memory store.

```js
import TestTime from 'logux-core/test-time'

it('tests log', () => {
  const log = TestTime.getLog()
  log.add({ type: 'TEST' })
  lastId(log) //=> [1, 'test1', 0]
})
```

When you test several logs in one test (for example, synchronization test),
you expect that action added on next code line will have bigger ID:

```js
log1.add({ type: 'FOO' })
log2.add({ type: 'BAR' })
isFirstOlder(lastMeta(log1), lastMeta(log2))
```

To do it, both logs should know about each other. You must create they
by same test time instance for it.

```js
const time = new TestTime()
const log1 = time.nextLog()
const log2 = time.nextLog()
```


## Events

All events doesn’t support asynchronous listeners. If you need asynchronous
calls inside listeners, you should care about calling order by your own.

```js
let prevTask = Promise.resolve()
log.on('add', (action, meta) => {
  prevTask = prevTask.then(() => {
    return processAsync(action, meta)
  })
})
```

### `preadd`

Event is emitted with added action, before it will be placed to store.
It is the best place to automatically set `reasons` (for example, to keep
last 1000 action in log for DevTools).

```js
log.on('preadd', (action, meta) => {
  meta.reasons.push('devtools')
})
```

Instead of `add` event, `preadd` event will be emitted even if action
with same ID already presented in store.


### `add`

Event is emitted on any new action added to log.

It will emitted for reason-less action and for actions without a `reasons`.
If action have reasons to put it to store, event will be emitted
after store saved a event and `meta` will contain `added` property.

It will not be emitted only if action with same `meta.id` is already presented
in store.

It is the best place for action listeners to change application store according
new actions.

```js
let lastChange
log.on('action', (action, meta) => {
  if (action.type === 'CHANGE_NAME' && isFirstOlder(lastChange, meta)) {
    lastChange = meta
    user.name = action.name
  }
})
```

Note, that action could be passed in different order, rather that was created.
Action `B` created after action `A`, could be emitted before `A`.

To prevent problems, always check action created time by `isFirstOlder()`
and look into a log for more younger action.


### `clean`

Event is emitted when action was cleaned from log, or when reason-less
action was added to log, but didn’t saved to store, because of empty `reasons`.

It is the best place to warn developers about cleaning process.

```js
log.on('clean', (action, meta) => {
  console.log('Action was cleaned: ', action, meta.id)
})
```


## Stores

Log should be saved to `localStorage` in browser or a file on server.
The server log can grow very big, exceeding the available memory.
This is why Logux has changeable log stores.


### MemoryStore

This package contains simple in-memory store designed primarily for tests:

```js
import { MemoryStore } from 'logux-core'
const log = new Log({ nodeId: 'server', store: new MemoryStore() })
```

Think about this store as a basic store realization.


### Custom Store

Any object implementing this 5 methods can be considered a Store:

* `add(entry)` puts new log entry in the store. Returns a Promise with new
  action meta or `false` if action with same `id` was already in log.
* `has(id)` does store has action with this ID.
* `remove(id)` removes action.
* `get()` returns a Promise loading the first page of actions in the log.
  Action page is an object containing an entries array in `page.entries`
  and a `page.next` function returning the next page Promise.
  Last page should not contain the `page.next` method.
* `changeMeta(id, diff)` changes keys in action’s metadata.
* `removeReason(reason, criteria, callback)` removes `reason` from action’s
  metadata and remove actions without reasons.
* `getLastAdded()` returns Promise with biggest `added` in store.
* `getLastSynced()` returns Promise with `added` values for latest synchronized
  received/sent actions.
* `setLastSynced(values)` saves `added` values for latest synchronized
  received/sent actions and return Promise when they will be saved to store.
