import { test } from 'uvu'

import { eachStoreCheck, MemoryStore } from '../index.js'

eachStoreCheck((desc, creator) => {
  test(
    `${desc}`,
    creator(() => new MemoryStore())
  )
})

test.run()
