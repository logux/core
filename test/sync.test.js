var TestTime = require('logux-core').TestTime

var ClientSync = require('../client-sync')
var ServerSync = require('../server-sync')
var LocalPair = require('../local-pair')

function actions (log) {
  return log.store.created.map(function (entry) {
    return entry[0]
  })
}

function entries (log) {
  return log.store.created.map(function (entry) {
    return [entry[0], entry[1]]
  })
}

function nextTick () {
  return new Promise(function (resolve) {
    setTimeout(resolve, 1)
  })
}

function clone (obj) {
  if (Array.isArray(obj)) {
    return obj.map(function (i) {
      return clone(i)
    })
  } else if (typeof obj === 'object') {
    var cloned = { }
    for (var i in obj) {
      cloned[i] = clone(obj[i])
    }
    return cloned
  } else {
    return obj
  }
}

function createTest () {
  var time = new TestTime()
  var log1 = time.nextLog()
  var log2 = time.nextLog()
  var pair = new LocalPair()

  var client = new ClientSync('client', log1, pair.left, { fixTime: false })
  var server = new ServerSync('server', log2, pair.right)
  pair.left.connect()

  return nextTick().then(function () {
    return { client: client, server: server }
  })
}

it('sends sync messages', function () {
  var test, serverSent, clientSent
  return createTest().then(function (created) {
    test = created

    serverSent = []
    test.client.connection.on('message', function (msg) {
      serverSent.push(clone(msg))
    })
    clientSent = []
    test.server.connection.on('message', function (msg) {
      clientSent.push(clone(msg))
    })

    return test.client.log.add({ type: 'a' })
  }).then(function () {
    expect(clientSent).toEqual([
      ['sync', 1, { type: 'a' }, { id: [1, 'test1', 0], time: 1 }]
    ])
    return nextTick()
  }).then(function () {
    expect(serverSent).toEqual([
      ['synced', 1]
    ])
    return test.server.log.add({ type: 'b' })
  }).then(nextTick).then(function () {
    expect(clientSent).toEqual([
      ['sync', 1, { type: 'a' }, { id: [1, 'test1', 0], time: 1 }],
      ['synced', 2]
    ])
    expect(serverSent).toEqual([
      ['synced', 1],
      ['sync', 2, { type: 'b' }, { id: [2, 'test2', 0], time: 2 }]
    ])
  })
})

it('check sync param types', function () {
  var test = createTest()
  test.client.catch(function () {})

  test.client.connection.send(['sync'])
  expect(test.server.connection.connected).toBeFalsy()
  expect(test.serverSent).toEqual([['error', 'wrong-format', '["sync"]']])

  test = createTest()
  test.client.catch(function () {})
  test.client.connection.send(['sync'])
  expect(test.server.connection.connected).toBeFalsy()
  expect(test.serverSent).toEqual([
    ['error', 'wrong-format', '["sync"]']
  ])

  test = createTest()
  test.client.catch(function () {})
  test.client.connection.send(['sync', 'abc'])
  expect(test.server.connection.connected).toBeFalsy()
  expect(test.serverSent).toEqual([
    ['error', 'wrong-format', '["sync","abc"]']
  ])

  test = createTest()
  test.client.catch(function () {})
  test.client.connection.send(['sync', 2, {}, 1])
  expect(test.server.connection.connected).toBeFalsy()
  expect(test.serverSent).toEqual([
    ['error', 'wrong-format', '["sync",2,{},1]']
  ])

  test = createTest()
  test.client.catch(function () {})
  test.client.connection.send(['sync', 2, {}, 'abc'])
  expect(test.server.connection.connected).toBeFalsy()
  expect(test.serverSent).toEqual([
    ['error', 'wrong-format', '["sync",2,{},"abc"]']
  ])

  test = createTest()
  test.client.catch(function () {})
  test.client.connection.send(['sync', 2, 1, {}])
  expect(test.server.connection.connected).toBeFalsy()
  expect(test.serverSent).toEqual([
    ['error', 'wrong-format', '["sync",2,1,{}]']
  ])

  test = createTest()
  test.client.catch(function () {})
  test.client.connection.send(['sync', 2, {}, {}, {}])
  expect(test.server.connection.connected).toBeFalsy()
  expect(test.serverSent).toEqual([
    ['error', 'wrong-format', '["sync",2,{},{},{}]']
  ])
})

it('check synced param types', function () {
  var test = createTest()
  test.client.catch(function () {})

  test.client.connection.send(['synced'])
  expect(test.server.connection.connected).toBeFalsy()
  expect(test.serverSent).toEqual(
    [['error', 'wrong-format', '["synced"]']]
  )

  test = createTest()
  test.client.catch(function () {})
  test.client.connection.send(['synced'])
  expect(test.server.connection.connected).toBeFalsy()
  expect(test.serverSent).toEqual(
    [['error', 'wrong-format', '["synced"]']]
  )

  test = createTest()
  test.client.catch(function () {})
  test.client.connection.send(['synced', 'abc'])
  expect(test.server.connection.connected).toBeFalsy()
  expect(test.serverSent).toEqual([
    ['error', 'wrong-format', '["synced","abc"]']
  ])

  test = createTest()
  test.client.catch(function () {})
  test.client.connection.send(['sync', 2, {}, 1])
  expect(test.server.connection.connected).toBeFalsy()
  expect(test.serverSent).toEqual([
    ['error', 'wrong-format', '["sync",2,{},1]']
  ])

  test = createTest()
  test.client.catch(function () {})
  test.client.connection.send(['synced', {}])
  expect(test.server.connection.connected).toBeFalsy()
  expect(test.serverSent).toEqual([
    ['error', 'wrong-format', '["synced",{}]']
  ])

  test = createTest()
  test.client.catch(function () {})
  test.client.connection.send(['synced', []])
  expect(test.server.connection.connected).toBeFalsy()
  expect(test.serverSent).toEqual([
    ['error', 'wrong-format', '["synced",[]]']
  ])
})

it('synchronizes actions', function () {
  var test
  return createTest().then(function (created) {
    test = created
    return test.client.log.add({ type: 'a' })
  }).then(nextTick).then(function () {
    expect(actions(test.server.log)).toEqual([{ type: 'a' }])
    expect(actions(test.client.log)).toEqual(actions(test.server.log))
    return test.server.log.add({ type: 'b' })
  }).then(nextTick).then(function () {
    expect(actions(test.client.log)).toEqual([{ type: 'b' }, { type: 'a' }])
    expect(actions(test.client.log)).toEqual(actions(test.server.log))
  })
})

it('remembers synced added', function () {
  var test
  return createTest().then(function (created) {
    test = created
    expect(test.client.synced).toBe(0)
    expect(test.client.otherSynced).toBe(0)
    return test.client.log.add({ type: 'a' })
  }).then(nextTick).then(function () {
    expect(test.client.synced).toBe(1)
    expect(test.client.otherSynced).toBe(0)
    return test.server.log.add({ type: 'b' })
  }).then(nextTick).then(function () {
    expect(test.client.synced).toBe(1)
    expect(test.client.otherSynced).toBe(2)
    expect(test.client.log.store.lastSent).toBe(1)
    expect(test.client.log.store.lastReceived).toBe(2)
  })
})

it('filters output actions', function () {
  var test
  return createTest().then(function (created) {
    test = created
    test.client.options.outFilter = function (action, meta) {
      expect(meta.id).toBeDefined()
      expect(meta.time).toBeDefined()
      expect(meta.added).toBeDefined()
      return Promise.resolve(action.type === 'b')
    }
    return test.client.log.add({ type: 'a' })
  }).then(nextTick).then(function () {
    expect(actions(test.client.log)).toEqual([{ type: 'a' }])
    expect(actions(test.server.log)).toEqual([])
    return test.client.log.add({ type: 'b' })
  }).then(nextTick).then(function () {
    expect(actions(test.client.log)).toEqual([{ type: 'b' }, { type: 'a' }])
    expect(actions(test.server.log)).toEqual([{ type: 'b' }])
  })
})

it('maps output actions', function () {
  var test
  return createTest().then(function (created) {
    test = created
    test.client.options.outMap = function (action, meta) {
      expect(meta.id).toBeDefined()
      expect(meta.time).toBeDefined()
      expect(meta.added).toBeDefined()
      return Promise.resolve([{ type: action.type + '1' }, meta])
    }
    return test.client.log.add({ type: 'a' })
  }).then(nextTick).then(function () {
    expect(actions(test.client.log)).toEqual([{ type: 'a' }])
    expect(actions(test.server.log)).toEqual([{ type: 'a1' }])
  })
})

it('filters input actions', function () {
  var test
  return createTest().then(function (created) {
    test = created
    test.server.options.inFilter = function (action, meta) {
      expect(meta.id).toBeDefined()
      expect(meta.time).toBeDefined()
      return Promise.resolve(action.type === 'b')
    }
    return test.client.log.add({ type: 'a' })
  }).then(nextTick).then(function () {
    expect(actions(test.client.log)).toEqual([{ type: 'a' }])
    expect(actions(test.server.log)).toEqual([])
    return test.client.log.add({ type: 'b' })
  }).then(nextTick).then(function () {
    expect(actions(test.client.log)).toEqual([{ type: 'b' }, { type: 'a' }])
    expect(actions(test.server.log)).toEqual([{ type: 'b' }])
  })
})

it('maps input actions', function () {
  var test
  return createTest().then(function (created) {
    test = created
    test.server.options.inMap = function (action, meta) {
      expect(meta.id).toBeDefined()
      expect(meta.time).toBeDefined()
      return Promise.resolve([{ type: action.type + '1' }, meta])
    }
    return test.client.log.add({ type: 'a' })
  }).then(nextTick).then(function () {
    expect(actions(test.client.log)).toEqual([{ type: 'a' }])
    expect(actions(test.server.log)).toEqual([{ type: 'a1' }])
  })
})

it('fixes created time', function () {
  var test
  return createTest().then(function (created) {
    test = created
    test.client.timeFix = 100
    return Promise.all([
      test.client.log.add({ type: 'a' }, { id: [101, 'test1', 0], time: 101 }),
      test.server.log.add({ type: 'b' }, { id: [2, 'test2', 0], time: 2 })
    ])
  }).then(nextTick).then(function () {
    expect(entries(test.client.log)).toEqual([
      [{ type: 'b' }, { id: [2, 'test2', 0], time: 102, added: 2 }],
      [{ type: 'a' }, { id: [101, 'test1', 0], time: 101, added: 1 }]
    ])
    expect(entries(test.server.log)).toEqual([
      [{ type: 'b' }, { id: [2, 'test2', 0], time: 2, added: 1 }],
      [{ type: 'a' }, { id: [101, 'test1', 0], time: 1, added: 2 }]
    ])
  })
})

it('supports multiple actions in sync', function () {
  var test
  return createTest().then(function (created) {
    test = created
    test.server.sendSync(
      { type: 'a' }, { id: [1, 'test2', 0], time: 1, added: 1 },
      { type: 'b' }, { id: [2, 'test2', 0], time: 2, added: 2 }
    )
    return nextTick()
  }).then(function () {
    expect(test.client.otherSynced).toBe(2)
    expect(entries(test.client.log)).toEqual([
      [{ type: 'b' }, { id: [2, 'test2', 0], time: 2, added: 2 }],
      [{ type: 'a' }, { id: [1, 'test2', 0], time: 1, added: 1 }]
    ])
  })
})

it('synchronizes actions on connect', function () {
  var test
  return createTest().then(function (created) {
    test = created
    return Promise.all([
      test.client.log.add({ type: 'a' }),
      test.server.log.add({ type: 'b' })
    ])
  }).then(nextTick).then(function () {
    test.client.connection.disconnect()
    return Promise.all([
      test.client.log.add({ type: 'c' }),
      test.client.log.add({ type: 'd' }),
      test.server.log.add({ type: 'e' })
    ])
  }).then(function () {
    expect(test.client.synced).toBe(1)
    expect(test.client.otherSynced).toBe(1)

    new ServerSync('server2', test.server.log, test.client.connection.other())
    test.client.connection.connect()

    return nextTick()
  }).then(function () {
    expect(actions(test.client.log)).toEqual([
      { type: 'e' },
      { type: 'd' },
      { type: 'c' },
      { type: 'b' },
      { type: 'a' }
    ])
    expect(actions(test.client.log)).toEqual(actions(test.server.log))
  })
})
