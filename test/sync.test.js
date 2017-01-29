var TestTime = require('logux-core').TestTime

var TestPair = require('../test-pair')
var ClientSync = require('../client-sync')
var ServerSync = require('../server-sync')

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

function createTest () {
  var time = new TestTime()
  var log1 = time.nextLog()
  var log2 = time.nextLog()
  var test = new TestPair()

  test.leftSync = new ClientSync('client', log1, test.left, { fixTime: false })
  test.rightSync = new ServerSync('server', log2, test.right)

  return test.left.connect().then(function () {
    return test.wait('left')
  }).then(function () {
    test.clear()
    return test
  })
}

it('sends sync messages', function () {
  return createTest().then(function (test) {
    test.leftSync.log.add({ type: 'a' })
    return test.wait('left')
  }).then(function (test) {
    expect(test.leftSent).toEqual([
      ['sync', 1, { type: 'a' }, { id: [1, 'test1', 0], time: 1 }]
    ])
    expect(test.rightSent).toEqual([
      ['synced', 1]
    ])

    test.rightSync.log.add({ type: 'b' })
    return test.wait('right')
  }).then(function (test) {
    expect(test.leftSent).toEqual([
      ['sync', 1, { type: 'a' }, { id: [1, 'test1', 0], time: 1 }],
      ['synced', 2]
    ])
    expect(test.rightSent).toEqual([
      ['synced', 1],
      ['sync', 2, { type: 'b' }, { id: [2, 'test2', 0], time: 2 }]
    ])
  })
})

it('check sync types', function () {
  var wrongs = [
    ['sync'],
    ['sync', 0, { type: 'a' }],
    ['sync', 0, { type: 'a' }, []],
    ['sync', 0, { }, { }],
    ['synced'],
    ['synced', 'abc']
  ]
  return Promise.all(wrongs.map(function (msg) {
    return createTest().then(function (test) {
      test.leftSync.send(msg)
      return test.wait('left')
    }).then(function (test) {
      expect(test.rightSync.connected).toBeFalsy()
      expect(test.rightSent).toEqual([
        ['error', 'wrong-format', JSON.stringify(msg)]
      ])
    })
  }))
})

it('synchronizes actions', function () {
  return createTest().then(function (test) {
    test.leftSync.log.add({ type: 'a' })
    return test.wait('left')
  }).then(function (test) {
    expect(actions(test.leftSync.log)).toEqual([{ type: 'a' }])
    expect(actions(test.leftSync.log)).toEqual(actions(test.rightSync.log))
    test.rightSync.log.add({ type: 'b' })
    return test.wait('right')
  }).then(function (test) {
    expect(actions(test.leftSync.log)).toEqual([{ type: 'b' }, { type: 'a' }])
    expect(actions(test.leftSync.log)).toEqual(actions(test.rightSync.log))
  })
})

it('remembers synced added', function () {
  return createTest().then(function (test) {
    expect(test.leftSync.synced).toBe(0)
    expect(test.leftSync.otherSynced).toBe(0)
    test.leftSync.log.add({ type: 'a' })
    return test.wait('left')
  }).then(function (test) {
    expect(test.leftSync.synced).toBe(1)
    expect(test.leftSync.otherSynced).toBe(0)
    test.rightSync.log.add({ type: 'b' })
    return test.wait('right')
  }).then(function (test) {
    expect(test.leftSync.synced).toBe(1)
    expect(test.leftSync.otherSynced).toBe(2)
    expect(test.leftSync.log.store.lastSent).toBe(1)
    expect(test.leftSync.log.store.lastReceived).toBe(2)
  })
})

it('filters output actions', function () {
  return createTest().then(function (test) {
    test.leftSync.options.outFilter = function (action, meta) {
      expect(meta.id).toBeDefined()
      expect(meta.time).toBeDefined()
      expect(meta.added).toBeDefined()
      return Promise.resolve(action.type === 'b')
    }
    test.leftSync.log.add({ type: 'a' })
    test.leftSync.log.add({ type: 'b' })
    return test.wait('left')
  }).then(function (test) {
    expect(actions(test.leftSync.log)).toEqual([{ type: 'b' }, { type: 'a' }])
    expect(actions(test.rightSync.log)).toEqual([{ type: 'b' }])
  })
})

it('maps output actions', function () {
  return createTest().then(function (test) {
    test.leftSync.options.outMap = function (action, meta) {
      expect(meta.id).toBeDefined()
      expect(meta.time).toBeDefined()
      expect(meta.added).toBeDefined()
      return Promise.resolve([{ type: action.type + '1' }, meta])
    }
    test.leftSync.log.add({ type: 'a' })
    return test.wait('left')
  }).then(function (test) {
    expect(actions(test.leftSync.log)).toEqual([{ type: 'a' }])
    expect(actions(test.rightSync.log)).toEqual([{ type: 'a1' }])
  })
})

it('filters input actions', function () {
  return createTest().then(function (test) {
    test.rightSync.options.inFilter = function (action, meta) {
      expect(meta.id).toBeDefined()
      expect(meta.time).toBeDefined()
      return Promise.resolve(action.type === 'b')
    }
    test.leftSync.log.add({ type: 'a' })
    return test.wait('left')
  }).then(function (test) {
    expect(actions(test.leftSync.log)).toEqual([{ type: 'a' }])
    expect(actions(test.rightSync.log)).toEqual([])
    test.leftSync.log.add({ type: 'b' })
    return test.wait('left')
  }).then(function (test) {
    expect(actions(test.leftSync.log)).toEqual([{ type: 'b' }, { type: 'a' }])
    expect(actions(test.rightSync.log)).toEqual([{ type: 'b' }])
  })
})

it('maps input actions', function () {
  return createTest().then(function (test) {
    test.rightSync.options.inMap = function (action, meta) {
      expect(meta.id).toBeDefined()
      expect(meta.time).toBeDefined()
      return Promise.resolve([{ type: action.type + '1' }, meta])
    }
    test.leftSync.log.add({ type: 'a' })
    return test.wait('left')
  }).then(function (test) {
    expect(actions(test.leftSync.log)).toEqual([{ type: 'a' }])
    expect(actions(test.rightSync.log)).toEqual([{ type: 'a1' }])
  })
})

it('fixes created time', function () {
  return createTest().then(function (test) {
    test.leftSync.timeFix = 100
    test.leftSync.log.add({ type: 'a' }, { id: [101, 'test1', 0], time: 101 })
    test.rightSync.log.add({ type: 'b' }, { id: [2, 'test2', 0], time: 2 })
    return test.leftSync.waitFor('synchronized').then(function () {
      return test
    })
  }).then(function (test) {
    expect(entries(test.leftSync.log)).toEqual([
      [{ type: 'b' }, { id: [2, 'test2', 0], time: 102, added: 2 }],
      [{ type: 'a' }, { id: [101, 'test1', 0], time: 101, added: 1 }]
    ])
    expect(entries(test.rightSync.log)).toEqual([
      [{ type: 'b' }, { id: [2, 'test2', 0], time: 2, added: 1 }],
      [{ type: 'a' }, { id: [101, 'test1', 0], time: 1, added: 2 }]
    ])
  })
})

it('supports multiple actions in sync', function () {
  return createTest().then(function (test) {
    test.rightSync.sendSync(
      { type: 'a' }, { id: [1, 'test2', 0], time: 1, added: 1 },
      { type: 'b' }, { id: [2, 'test2', 0], time: 2, added: 2 }
    )
    return test.wait('right')
  }).then(function (test) {
    expect(test.leftSync.otherSynced).toBe(2)
    expect(entries(test.leftSync.log)).toEqual([
      [{ type: 'b' }, { id: [2, 'test2', 0], time: 2, added: 2 }],
      [{ type: 'a' }, { id: [1, 'test2', 0], time: 1, added: 1 }]
    ])
  })
})

it('synchronizes actions on connect', function () {
  var test
  return createTest().then(function (created) {
    test = created
    test.leftSync.log.add({ type: 'a' })
    test.rightSync.log.add({ type: 'b' })
    return test.leftSync.waitFor('synchronized')
  }).then(function () {
    test.left.disconnect()
    return test.wait('right')
  }).then(function () {
    expect(test.leftSync.synced).toBe(1)
    expect(test.leftSync.otherSynced).toBe(1)
    return Promise.all([
      test.leftSync.log.add({ type: 'c' }),
      test.leftSync.log.add({ type: 'd' }),
      test.rightSync.log.add({ type: 'e' })
    ])
  }).then(function () {
    return test.left.connect()
  }).then(function () {
    test.rightSync = new ServerSync('server2', test.rightSync.log, test.right)
    return test.leftSync.waitFor('synchronized')
  }).then(function () {
    expect(actions(test.leftSync.log)).toEqual([
      { type: 'e' },
      { type: 'd' },
      { type: 'c' },
      { type: 'b' },
      { type: 'a' }
    ])
    expect(actions(test.leftSync.log)).toEqual(actions(test.rightSync.log))
  })
})
