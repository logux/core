import { Log, Meta, MemoryStore, ClientNode, LocalPair } from '..'

type MyMeta = Meta & {
  extra: number
}

let log = new Log({ nodeId: 'client', store: new MemoryStore() })
let pair = new LocalPair()

let client = new ClientNode<MyMeta>('client', log, pair.left)

// Type 'string' is not assignable to type 'number | undefined'.
client.log.add({ type: 'A' }, { extra: '1' })
