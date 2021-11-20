import { test } from 'uvu'

import { MemoryStore, eachStoreCheck } from '../index.js'

eachStoreCheck((desc, creator) => {
  test(
    `${desc}`,
    creator(() => new MemoryStore())
  )
})

test.run()
