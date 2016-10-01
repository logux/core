# Logux Protocol

Logux protocol is used to synchronize events between [Logux logs].

This protocol is based on simple JS types: boolean, number, string, array
and key-value object.

You can use any encoding and any low-level protocol: binary [MessagePack]
encoding over WebSockets, JSON over AJAX and HTTP “keep-alive”, XML over TCP.
Low-level protocol must guarantee messages order and content.
Main way is MessagePack over WebSockets.

[MessagePack]: http://msgpack.org/
[Logux logs]:  https://github.com/logux/logux-core

## Versions

Protocol uses two major and minor numbers for version.

```ts
[number major, number minor]
```

If other client uses bigger `major`, you should send `protocol` error
and close connection.

## Messages

Communication is based on messages. Every message is a array with string
in the beginning and any types next:

```ts
[
  string type,
  …
]
```

First string in message array is a message type. Possible types:

* [`error`]
* [`connect`]
* [`connected`]
* [`ping`]
* [`pong`]
* [`sync`]
* [`synced`]

If client received unknown type, it should send `protocol` error
and continue communication.

[`connected`]: #connected
[`connect`]:   #connect
[`synced`]:    #synced
[`error`]:     #error
[`ping`]:      #ping
[`pong`]:      #pong
[`sync`]:      #sync

## `error`

Error message contains error description and error type.

```ts
[
  "error",
  string message,
  string errorType
]
```

Right now there are 2 possible error types: `protocol` and `auth`.

## `connect`

After connection was started some client should send `connect` message to other.

```ts
[
  "connect",
  number[] protocol,
  string host,
  number synced,
  (any credentials)?
]
```

Receiver should check [protocol version] in second position in message array.
If major version is different from receiver protocol, it should send protocol
error and close connection.

Third position contains unique host name. Same host name is used in default
log timer, so sender must be sure that host name is unique.
Client should UUID if it can’t guarantee host name uniqueness with other way.

Fourth position contains last `added` time used by receiver
in previous connection (`0` on first connection).
message with all new events since `synced` (all events on first connection).

Fifth position is optional and contains credentials data.
It could be in any type. Receiver may check credentials data.
On wrong credentials data receiver may send `auth` error and close connection.

[protocol version]: #versions

## `connected`

This message is answer to received [`connect`] message.

```ts
[
  "connected",
  number[] protocol,
  string host,
  [number start, number end],
  (any credentials)?
]
```

`protocol` and `host` positions are same with [`connect`] message.

Fourth position contains [`connect`] receiving time and `connected` sending time.
Time should be a milliseconds elapsed since 1 January 1970 00:00:00 UTC.
Receiver may use this information to calculate difference between sender
and receiver time. It could prevents problems if somebody has wrong time
or wrong time zone. Calculated time fix may be used to correct
events `created` time in [`sync`] messages.

Fifth position is optional and contains credentials data. It could has any type.
Receiver may check credentials data. On wrong credentials data receiver may
send `auth` error and close connection.

Right after this message receiver should send [`sync`] message with all new events
since last connection (all events on first connection).

## `ping`

Client could send `ping` message to check connection.

```ts
[
  "ping",
  number synced
]
```

Message array contains also sender last `added`. So receiver could update it
to use in next [`connect`] message.

Receiver should send [`pong`] message as soon as possible.

## `pong`

`pong` message is a answer to [`ping`] message.

```ts
[
  "pong",
  number synced
]
```

Message array contains sender last `added` too.

## `sync`

This message contains new events for synchronization.

```ts
[
  "sync",
  number synced
  (object event, array created)+
]
```

Second position contain biggest `added` time from events in message.
Receiver should send it back in [`synced`] message.

This message array length is dynamic. For each event sender should add
2 position: for event object and event’s `created` time.

Event object could contains any key and values, but it must contains at least
`type` key with string value.

`created` time is a array with numbers and strings. It actual format depends
on used timer. For more details read [Logux Core docs].
For example, standard timer generated:

```ts
[number milliseconds, string host, number orderInMs]
```

Sender and receiver should use same timer type to have same time format.

Every event should have unique `created` time. If receiver’s log already
contains event with same `created` time, receiver must silently ignore
new event from `sync`.

Received event’s `created` time may be different with sender’s log,
because sender could correct event’s time based on data from [`connected`]
message. This correction could fix problems when some client have wrong
time or time zone.

[Logux Core docs]: https://github.com/logux/logux-core#created-time

## `synced`

`synced` message is a answer to [`sync`] message.

```ts
[
  "synced",
  number synced
]
```

Receiver should mark all events with lower `added` time as synchronized.

## Examples

Wrong authentication:

```ts
CONNECTED
CLIENT > ["connect", [0, 0], "client1", { token: "wrong" }]
SERVER < ["error", "Wrong credentials", "auth"]
DISCONNECTED
```

Correct synchronization:

```ts
CONNECTED
CLIENT > ["connect", [0, 0], "client1", 0, { token: "correct" }]
SERVER < ["connected", [0, 0], "server", [1475316481050, 1475316482879]]
CLIENT > ["ping", 0]
SERVER < ["pong", 0]
SERVER < ["sync", 1, { type: 'a' }, [1475316540687, "client2", 0]]
CLIENT > ["synced", 1]
CLIENT > ["ping", 1]
SERVER < ["pong", 1]
DISCONNECTED
CONNECTED
CLIENT > ["connect", [0, 0], "client1", 1, { token: "correct" }]
SERVER < ["connected", [0, 0], "server", [1475316659892, 1475316660687]]
SERVER < ["sync", 2, { type: 'b' }, [1475316641759, "client2", 0]]
CLIENT > ["synced", 2]
```

Clients may hide some events from each other,
so `added` time could be different:

```ts
CONNECTED
CLIENT > ["connect", [0, 0], "client1", 130, { token: "correct" }]
SERVER < ["connected", [0, 0], "server", [1475316168379, 1475316169987]]
SERVER < ["sync", 132, { type: 'a' }, [1475316158300, "client2", 0],
                       { type: 'b' }, [1475316158300, "client2", 1]]
CLIENT > ["sync", 1, { type: 'c' }, [1475316168370, "client1", 0]]
CLIENT > ["synced", 132]
SERVER < ["synced", 1]
CLINET > ["ping", 3]
SERVER < ["pong", 150]
CLIENT > ["sync", 4, { type: 'd' }, [1475316404244, "client1", 0]]
SERVER < ["synced", 4]
DISCONNECTED
```
