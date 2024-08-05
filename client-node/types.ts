import { ClientNode, LocalPair, Log, MemoryStore, type Meta } from '../index.js'

type MyMeta = {
  extra: number
} & Meta

type Headers = {
  lang: string
}

let log = new Log<MyMeta>({ nodeId: 'client', store: new MemoryStore() })
let pair = new LocalPair()

let client = new ClientNode<Headers, Log<MyMeta>>('client', log, pair.left)

client.setLocalHeaders({ lang: 'ru' })

client.log.add({ type: 'A' }, { extra: 1 })

function sayHi(lang: string): void {
  console.log('Hi, ' + lang)
}

sayHi(client.remoteHeaders.lang ?? 'en')
client.on('headers', ({ lang }) => {
  sayHi(lang)
})
