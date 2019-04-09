# Logux Core [![Cult Of Martians][cult-img]][cult]

<img align="right" width="95" height="95" title="Logux logo"
     src="https://cdn.rawgit.com/logux/logux/master/logo.svg">

Logux is a new way to connect client and server. It synchronizes log
of operations between client, server, and other clients.

**Documentation: [logux/logux]**

This repository contains Logux core components:

* **Log** to store node’s actions.
* **MemoryStore** to store log in the memory.
* **BaseNode**, **ClientNode**, and **ServerNode** to synchronize actions
  from Log with other node.
* **isFirstOlder** to compare creation time of different actions.
* **WsConnection**, **Reconnect**, and **ServerConnection** to connect nodes
  via WebSocket.
* **TestLog**, **TestPair**, **TestTime**, and **eachStoreCheck**
  to test Logux application.

<a href="https://evilmartians.com/?utm_source=logux-core">
  <img src="https://evilmartians.com/badges/sponsored-by-evil-martians.svg"
       alt="Sponsored by Evil Martians" width="236" height="54">
</a>

[logux/logux]: https://github.com/logux/logux
[cult-img]: http://cultofmartians.com/assets/badges/badge.svg
[cult]: http://cultofmartians.com/done.html


## Install

```sh
npm install @logux/core
```


## Usage

```js
import { TestTime, TestLog, TestPair } from '@logux/core'
import ClientNode from '@logux/core'

let time = new TestTime()
let pair = new TestPair()
let node = new ClientNode('client:test', time.nextLog(), pair.left)
```

```js
import isFirstOlder from '@logux/core/is-first-older'

let lastRename
log.on('add', (action, meta) => {
  if (action.type === 'RENAME') {
    if (isFirstOlder(lastRename, meta)) {
      changeName(action.name)
      lastRename = meta
    }
  }
})
```
