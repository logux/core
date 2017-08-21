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

function createTest (before) {
  var time = new TestTime()
  var log1 = time.nextLog()
  var log2 = time.nextLog()
  var test = new TestPair()

  log1.on('preadd', function (action, meta) {
    meta.reasons = ['t']
  })
  log2.on('preadd', function (action, meta) {
    meta.reasons = ['t']
  })

  test.leftSync = new ClientSync('client', log1, test.left, { fixTime: false })
  test.rightSync = new ServerSync('server', log2, test.right)

  if (before) before(test)

  return test.left.connect().then(function () {
    return test.leftSync.waitFor('synchronized')
  }).then(function () {
    test.clear()
    test.leftSync.baseTime = 0
    test.rightSync.baseTime = 0
    return test
  })
}

it('sends sync messages', function () {
  var actionA = { type: 'a' }
  var actionB = { type: 'b' }
  return createTest().then(function (test) {
    test.leftSync.log.add(actionA)
    return test.wait('left')
  }).then(function (test) {
    expect(test.leftSent).toEqual([
      ['sync', 1, actionA, { id: [1, 'test1', 0], time: 1, reasons: ['t'] }]
    ])
    expect(test.rightSent).toEqual([
      ['synced', 1]
    ])

    test.rightSync.log.add(actionB)
    return test.wait('right')
  }).then(function (test) {
    expect(test.leftSent).toEqual([
      ['sync', 1, actionA, { id: [1, 'test1', 0], time: 1, reasons: ['t'] }],
      ['synced', 2]
    ])
    expect(test.rightSent).toEqual([
      ['synced', 1],
      ['sync', 2, actionB, { id: [2, 'test2', 0], time: 2, reasons: ['t'] }]
    ])
  })
})

it('check sync types', function () {
  var wrongs = [
    ['sync'],
    ['sync', 0, { type: 'a' }],
    ['sync', 0, { type: 'a' }, []],
    ['sync', 0, { }, { }],
    ['sync', 0, { }, { id: 0 }],
    ['sync', 0, { }, { time: 0 }],
    ['sync', 0, { }, { id: 0, time: '0' }],
    ['sync', 0, { }, { id: [1, 'node'], time: 0 }],
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
    expect(test.leftSync.lastSent).toBe(0)
    expect(test.leftSync.lastReceived).toBe(0)
    test.leftSync.log.add({ type: 'a' })
    return test.wait('left')
  }).then(function (test) {
    expect(test.leftSync.lastSent).toBe(1)
    expect(test.leftSync.lastReceived).toBe(0)
    test.rightSync.log.add({ type: 'b' })
    return test.wait('right')
  }).then(function (test) {
    expect(test.leftSync.lastSent).toBe(1)
    expect(test.leftSync.lastReceived).toBe(2)
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

it('compress time', function () {
  var test
  return createTest().then(function (created) {
    test = created
    test.leftSync.baseTime = 100
    test.rightSync.baseTime = 100
    return Promise.all([
      test.leftSync.log.add({ type: 'a' }, { id: [1, 'test1', 0], time: 1 })
    ])
  }).then(function () {
    return test.leftSync.waitFor('synchronized')
  }).then(function () {
    expect(test.leftSent).toEqual([
      [
        'sync',
        1,
        { type: 'a' },
        { id: [-99, 'test1', 0], time: -99, reasons: ['t'] }
      ]
    ])
    expect(entries(test.rightSync.log)).toEqual([
      [
        { type: 'a' },
        { id: [1, 'test1', 0], time: 1, added: 1, reasons: ['t'] }
      ]
    ])
  })
})

it('compress IDs', function () {
  var test
  return createTest().then(function (created) {
    test = created
    return Promise.all([
      test.leftSync.log.add({ type: 'a' }, { id: [1, 'client', 0], time: 1 }),
      test.leftSync.log.add({ type: 'a' }, { id: [1, 'client', 1], time: 1 }),
      test.leftSync.log.add({ type: 'a' }, { id: [1, 'o', 0], time: 1 })
    ])
  }).then(function () {
    return test.leftSync.waitFor('synchronized')
  }).then(function () {
    expect(test.leftSent).toEqual([
      ['sync', 1, { type: 'a' }, { id: 1, time: 1, reasons: ['t'] }],
      ['sync', 2, { type: 'a' }, { id: [1, 1], time: 1, reasons: ['t'] }],
      ['sync', 3, { type: 'a' }, { id: [1, 'o', 0], time: 1, reasons: ['t'] }]
    ])
    expect(entries(test.rightSync.log)).toEqual([
      [
        { type: 'a' },
        { id: [1, 'o', 0], time: 1, added: 3, reasons: ['t'] }
      ],
      [
        { type: 'a' },
        { id: [1, 'client', 1], time: 1, added: 2, reasons: ['t'] }
      ],
      [
        { type: 'a' },
        { id: [1, 'client', 0], time: 1, added: 1, reasons: ['t'] }
      ]
    ])
  })
})

it('synchronizes any meta fields', function () {
  var a = { type: 'a' }
  var test
  return createTest().then(function (created) {
    test = created
    return test.leftSync.log.add(a, { id: [1, 'test1', 0], time: 1, one: 1 })
  }).then(function () {
    return test.leftSync.waitFor('synchronized')
  }).then(function () {
    expect(test.leftSent).toEqual([
      ['sync', 1, a, { id: [1, 'test1', 0], time: 1, one: 1, reasons: ['t'] }]
    ])
    expect(entries(test.rightSync.log)).toEqual([
      [a, { id: [1, 'test1', 0], time: 1, added: 1, one: 1, reasons: ['t'] }]
    ])
  })
})

it('fixes created time', function () {
  var test
  return createTest().then(function (created) {
    test = created
    test.leftSync.timeFix = 10
    return Promise.all([
      test.leftSync.log.add({ type: 'a' }, { id: [11, 'test1', 0], time: 11 }),
      test.rightSync.log.add({ type: 'b' }, { id: [2, 'test2', 0], time: 2 })
    ])
  }).then(function () {
    return test.leftSync.waitFor('synchronized')
  }).then(function () {
    expect(entries(test.leftSync.log)).toEqual([
      [
        { type: 'b' },
        { id: [2, 'test2', 0], time: 12, added: 2, reasons: ['t'] }
      ],
      [
        { type: 'a' },
        { id: [11, 'test1', 0], time: 11, added: 1, reasons: ['t'] }
      ]
    ])
    expect(entries(test.rightSync.log)).toEqual([
      [
        { type: 'b' },
        { id: [2, 'test2', 0], time: 2, added: 1, reasons: ['t'] }
      ],
      [
        { type: 'a' },
        { id: [11, 'test1', 0], time: 1, added: 2, reasons: ['t'] }
      ]
    ])
  })
})

it('supports multiple actions in sync', function () {
  return createTest().then(function (test) {
    test.rightSync.sendSync(2, [
      [{ type: 'a' }, { id: [1, 'test2', 0], time: 1, added: 1 }],
      [{ type: 'b' }, { id: [2, 'test2', 0], time: 2, added: 2 }]
    ])
    return test.wait('right')
  }).then(function (test) {
    expect(test.leftSync.lastReceived).toBe(2)
    expect(entries(test.leftSync.log)).toEqual([
      [
        { type: 'b' },
        { id: [2, 'test2', 0], time: 2, added: 2, reasons: ['t'] }
      ],
      [
        { type: 'a' },
        { id: [1, 'test2', 0], time: 1, added: 1, reasons: ['t'] }
      ]
    ])
  })
})

it('changes multiple actions in map', function () {
  var test
  return createTest(function (created) {
    test = created
    test.leftSync.options.outMap = function (action, meta) {
      return Promise.resolve([{ type: action.type.toUpperCase() }, meta])
    }
    test.leftSync.log.add({ type: 'a' })
    test.leftSync.log.add({ type: 'b' })
  }).then(function () {
    return test.leftSync.waitFor('synchronized')
  }).then(function () {
    expect(test.rightSync.lastReceived).toBe(2)
    expect(actions(test.rightSync.log)).toEqual([{ type: 'B' }, { type: 'A' }])
  })
})

it('synchronizes actions on connect', function () {
  var test
  return createTest().then(function (created) {
    test = created
    return Promise.all([
      test.leftSync.log.add({ type: 'a' }),
      test.rightSync.log.add({ type: 'b' })
    ])
  }).then(function () {
    return test.leftSync.waitFor('synchronized')
  }).then(function () {
    test.left.disconnect()
    return test.wait('right')
  }).then(function () {
    expect(test.leftSync.lastSent).toBe(1)
    expect(test.leftSync.lastReceived).toBe(1)
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
