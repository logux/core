# Logux Core [![Cult Of Martians][cult-img]][cult]

<img align="right" width="95" height="148" title="Logux logotype"
     src="https://logux.org/branding/logotype.svg">

Logux is a new way to connect client and server. Instead of sending
HTTP requests (e.g., AJAX and GraphQL) it synchronizes log of operations
between client, server, and other clients.

- **[Guide, recipes, and API](https://logux.org/)**
- **[Issues](https://github.com/logux/logux/issues)**
  and **[roadmap](https://github.com/orgs/logux/projects/1)**
- **[Projects](https://logux.org/guide/architecture/parts/)**
  inside Logux ecosystem

This repository contains Logux core components for JavaScript:

- `Log` to store node’s actions.
- `MemoryStore` to store log in the memory.
- `BaseNode`, `ClientNode`, and `ServerNode` to synchronize actions
  from Log with other node.
- `isFirstOlder` to compare creation time of different actions.
- `WsConnection`, `Reconnect`, and `ServerConnection` to connect nodes
  via WebSocket.
- `TestLog`, `TestPair`, `TestTime`, and `eachStoreCheck`
  to test Logux application.

---

<img src="https://cdn.evilmartians.com/badges/logo-no-label.svg" alt="" width="22" height="16" />  Logux Core is built by <b><a href="https://evilmartians.com/">Evil Martians</a></b>, an American design and engineering consultancy for <b>developer tools, AI, and cybersecurity startups</b>.

---

[cult-img]: http://cultofmartians.com/assets/badges/badge.svg
[cult]: http://cultofmartians.com/done.html

## Install

```sh
npm install @logux/core
```

## Usage

See [documentation] for Logux API.

```js
import { ClientNode, TestTime, TestLog, TestPair } from '@logux/core'

let time = new TestTime()
let pair = new TestPair()
let node = new ClientNode('client:test', time.nextLog(), pair.left)
```

```js
import { isFirstOlder } from '@logux/core'

let lastRename
log.type('RENAME', (action, meta) => {
  if (isFirstOlder(lastRename, meta)) {
    changeName(action.name)
    lastRename = meta
  }
})
```

[documentation]: https://logux.org/web-api/
