import { test } from 'node:test'

import { eachStoreCheck, MemoryStore } from '../index.js'

eachStoreCheck((desc, creator) => {
  test(
    `${desc}`,
    creator(() => new MemoryStore())
  )
})
