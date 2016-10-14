var createTestTimer = require('logux-core').createTestTimer
var MemoryStore = require('logux-core').MemoryStore
var Log = require('logux-core').Log

var ClientSync = require('../client-sync')
var ServerSync = require('../server-sync')
var LocalPair = require('../local-pair')

function events (log) {
  return log.store.created.map(function (entry) {
    return entry[0]
  })
}

function createTest () {
  var timer = createTestTimer()
  var log1 = new Log({ store: new MemoryStore(), timer: timer })
  var log2 = new Log({ store: new MemoryStore(), timer: timer })
  var pair = new LocalPair()

  var client = new ClientSync('client', log1, pair.left)
  var server = new ServerSync('server', log2, pair.right)
  pair.left.connect()

  return { client: client, server: server }
}

function nextTick () {
  return new Promise(function (resolve) {
    setTimeout(resolve, 1)
  })
}

it('sends sync messages', function () {
  var test = createTest()
  var serverSent = []
  test.client.connection.on('message', function (msg) {
    serverSent.push(msg)
  })
  var clientSent = []
  test.server.connection.on('message', function (msg) {
    clientSent.push(msg)
  })

  return test.client.log.add({ type: 'a' }).then(function () {
    expect(clientSent).toEqual([
      ['sync', 1, { type: 'a' }, [3]]
    ])
    return nextTick()
  }).then(function () {
    expect(serverSent).toEqual([
      ['synced', 1]
    ])
    return test.server.log.add({ type: 'b' })
  }).then(function () {
    return nextTick()
  }).then(function () {
    expect(clientSent).toEqual([
      ['sync', 1, { type: 'a' }, [3]],
      ['synced', 2]
    ])
    expect(serverSent).toEqual([
      ['synced', 1],
      ['sync', 2, { type: 'b' }, [4]]
    ])
  })
})

it('synchronizes events', function () {
  var test = createTest()

  return test.client.log.add({ type: 'a' }).then(function () {
    return nextTick()
  }).then(function () {
    expect(events(test.server.log)).toEqual([{ type: 'a' }])
    expect(events(test.client.log)).toEqual(events(test.server.log))
    return test.server.log.add({ type: 'b' })
  }).then(function () {
    return nextTick()
  }).then(function () {
    expect(events(test.client.log)).toEqual([{ type: 'b' }, { type: 'a' }])
    expect(events(test.client.log)).toEqual(events(test.server.log))
  })
})

it('remembers synced added', function () {
  var test = createTest()
  expect(test.client.synced).toBe(0)
  expect(test.client.otherSynced).toBe(0)

  return test.client.log.add({ type: 'a' }).then(function () {
    return nextTick()
  }).then(function () {
    expect(test.client.synced).toBe(1)
    expect(test.client.otherSynced).toBe(0)
    return test.server.log.add({ type: 'b' })
  }).then(function () {
    return nextTick()
  }).then(function () {
    expect(test.client.synced).toBe(1)
    expect(test.client.otherSynced).toBe(2)
  })
})

it('filters output events', function () {
  var test = createTest()
  test.client.options.outFilter = function (event, meta) {
    expect(meta.created).toBeDefined()
    expect(meta.added).toBeDefined()
    return Promise.resolve(event.type === 'b')
  }

  return test.client.log.add({ type: 'a' }).then(function () {
    return nextTick()
  }).then(function () {
    expect(events(test.client.log)).toEqual([{ type: 'a' }])
    expect(events(test.server.log)).toEqual([])
    return test.client.log.add({ type: 'b' })
  }).then(function () {
    return nextTick()
  }).then(function () {
    expect(events(test.client.log)).toEqual([{ type: 'b' }, { type: 'a' }])
    expect(events(test.server.log)).toEqual([{ type: 'b' }])
  })
})

it('maps output events', function () {
  var test = createTest()
  test.client.options.outMap = function (event, meta) {
    expect(meta.created).toBeDefined()
    expect(meta.added).toBeDefined()
    return Promise.resolve([{ type: event.type + '1' }, meta])
  }

  return test.client.log.add({ type: 'a' }).then(function () {
    return nextTick()
  }).then(function () {
    expect(events(test.client.log)).toEqual([{ type: 'a' }])
    expect(events(test.server.log)).toEqual([{ type: 'a1' }])
  })
})

it('filters input events', function () {
  var test = createTest()
  test.server.options.inFilter = function (event, meta) {
    expect(meta.created).toBeDefined()
    return Promise.resolve(event.type === 'b')
  }

  return test.client.log.add({ type: 'a' }).then(function () {
    return nextTick()
  }).then(function () {
    expect(events(test.client.log)).toEqual([{ type: 'a' }])
    expect(events(test.server.log)).toEqual([])
    return test.client.log.add({ type: 'b' })
  }).then(function () {
    return nextTick()
  }).then(function () {
    expect(events(test.client.log)).toEqual([{ type: 'b' }, { type: 'a' }])
    expect(events(test.server.log)).toEqual([{ type: 'b' }])
  })
})

it('maps input events', function () {
  var test = createTest()
  test.server.options.inMap = function (event, meta) {
    expect(meta.created).toBeDefined()
    return Promise.resolve([{ type: event.type + '1' }, meta])
  }

  return test.client.log.add({ type: 'a' }).then(function () {
    return nextTick()
  }).then(function () {
    expect(events(test.client.log)).toEqual([{ type: 'a' }])
    expect(events(test.server.log)).toEqual([{ type: 'a1' }])
  })
})

it('fixes created time', function () {
  var test = createTest()
  test.client.timeFix = 100

  return Promise.all([
    test.client.log.add({ type: 'a' }, { created: [101] }),
    test.server.log.add({ type: 'b' }, { created: [2] })
  ]).then(function () {
    return nextTick()
  }).then(function () {
    expect(test.client.log.store.created).toEqual([
      [{ type: 'b' }, { created: [102], added: 2 }],
      [{ type: 'a' }, { created: [101], added: 1 }]
    ])
    expect(test.server.log.store.created).toEqual([
      [{ type: 'b' }, { created: [2], added: 1 }],
      [{ type: 'a' }, { created: [1], added: 2 }]
    ])
  })
})

it('supports multiple events in sync', function () {
  var test = createTest()
  test.server.sendSync({ type: 'a' }, { created: [1], added: 1 },
                       { type: 'b' }, { created: [2], added: 2 })

  return nextTick().then(function () {
    expect(test.client.otherSynced).toBe(2)
    expect(test.client.log.store.created).toEqual([
      [{ type: 'b' }, { created: [2], added: 2 }],
      [{ type: 'a' }, { created: [1], added: 1 }]
    ])
  })
})

it('synchronizes events on connect', function () {
  var test = createTest()
  return Promise.all([
    test.client.log.add({ type: 'a' }),
    test.server.log.add({ type: 'b' })
  ]).then(function () {
    return nextTick()
  }).then(function () {
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
    expect(events(test.client.log)).toEqual([
      { type: 'e' },
      { type: 'd' },
      { type: 'c' },
      { type: 'b' },
      { type: 'a' }
    ])
    expect(events(test.client.log)).toEqual(events(test.server.log))
  })
})
