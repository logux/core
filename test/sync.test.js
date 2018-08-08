var delay = require('nanodelay')

var ClientNode = require('../client-node')
var ServerNode = require('../server-node')
var TestTime = require('../test-time')
var TestPair = require('../test-pair')

var destroyable

function createPair () {
  var time = new TestTime()
  var log1 = time.nextLog()
  var log2 = time.nextLog()
  var test = new TestPair()

  destroyable = test

  log1.on('preadd', function (action, meta) {
    meta.reasons = ['t']
  })
  log2.on('preadd', function (action, meta) {
    meta.reasons = ['t']
  })

  test.leftNode = new ClientNode('client', log1, test.left, { fixTime: false })
  test.rightNode = new ServerNode('server', log2, test.right)

  return test
}

function createTest (before) {
  var test = createPair()
  if (before) before(test)
  test.left.connect()
  return test.leftNode.waitFor('synchronized').then(function () {
    test.clear()
    test.leftNode.baseTime = 0
    test.rightNode.baseTime = 0
    return test
  })
}

afterEach(function () {
  destroyable.leftNode.destroy()
  destroyable.rightNode.destroy()
})

it('sends sync messages', function () {
  var actionA = { type: 'a' }
  var actionB = { type: 'b' }
  return createTest().then(function (test) {
    test.leftNode.log.add(actionA)
    return test.wait('left')
  }).then(function (test) {
    expect(test.leftSent).toEqual([
      ['sync', 1, actionA, { id: [1, 'test1', 0], time: 1, reasons: ['t'] }]
    ])
    expect(test.rightSent).toEqual([
      ['synced', 1]
    ])

    test.rightNode.log.add(actionB)
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

it('uses last added on non-added action', function () {
  return createTest().then(function (test) {
    test.leftNode.log.on('preadd', function (action, meta) {
      meta.reasons = []
    })
    test.leftNode.log.add({ type: 'a' })
    return test.wait('left')
  }).then(function (test) {
    expect(test.leftSent).toEqual([
      [
        'sync',
        0,
        { type: 'a' },
        { id: [1, 'test1', 0], time: 1, reasons: [] }
      ]
    ])
  })
})

it('checks sync types', function () {
  var wrongs = [
    ['sync'],
    ['sync', 0, { type: 'a' }],
    ['sync', 0, { type: 'a' }, []],
    ['sync', 0, { type: 'a' }, { }],
    ['sync', 0, { type: 'a' }, { id: 0 }],
    ['sync', 0, { type: 'a' }, { time: 0 }],
    ['sync', 0, { type: 'a' }, { id: 0, time: '0' }],
    ['sync', 0, { type: 'a' }, { id: [0], time: 0 }],
    ['sync', 0, { type: 'a' }, { id: [0, 'node'], time: 0 }],
    ['sync', 0, { type: 'a' }, { id: '1 node 0', time: 0 }],
    ['sync', 0, { type: 'a' }, { id: [1, 'node', 1, '0'], time: 0 }],
    ['sync', 0, { }, { id: 0, time: 0 }],
    ['synced'],
    ['synced', 'abc']
  ]
  return Promise.all(wrongs.map(function (msg) {
    return createTest().then(function (test) {
      test.leftNode.catch(function () { })
      test.leftNode.send(msg)
      return test.wait('left')
    }).then(function (test) {
      expect(test.rightNode.connected).toBeFalsy()
      expect(test.rightSent).toEqual([
        ['error', 'wrong-format', JSON.stringify(msg)]
      ])
    })
  }))
})

it('synchronizes actions', function () {
  return createTest().then(function (test) {
    test.leftNode.log.add({ type: 'a' })
    return test.wait('left')
  }).then(function (test) {
    expect(test.leftNode.log.actions()).toEqual([{ type: 'a' }])
    expect(test.leftNode.log.actions()).toEqual(test.rightNode.log.actions())
    test.rightNode.log.add({ type: 'b' })
    return test.wait('right')
  }).then(function (test) {
    expect(test.leftNode.log.actions()).toEqual([{ type: 'a' }, { type: 'b' }])
    expect(test.leftNode.log.actions()).toEqual(test.rightNode.log.actions())
  })
})

it('remembers synced added', function () {
  return createTest().then(function (test) {
    expect(test.leftNode.lastSent).toBe(0)
    expect(test.leftNode.lastReceived).toBe(0)
    test.leftNode.log.add({ type: 'a' })
    return test.wait('left')
  }).then(function (test) {
    expect(test.leftNode.lastSent).toBe(1)
    expect(test.leftNode.lastReceived).toBe(0)
    test.rightNode.log.add({ type: 'b' })
    return test.wait('right')
  }).then(function (test) {
    expect(test.leftNode.lastSent).toBe(1)
    expect(test.leftNode.lastReceived).toBe(2)
    expect(test.leftNode.log.store.lastSent).toBe(1)
    expect(test.leftNode.log.store.lastReceived).toBe(2)
  })
})

it('filters output actions', function () {
  var test
  return createTest(function (created) {
    test = created
    test.leftNode.options.outFilter = function (action, meta) {
      expect(meta.id).toBeDefined()
      expect(meta.time).toBeDefined()
      expect(meta.added).toBeDefined()
      return Promise.resolve(action.type === 'b')
    }
    return Promise.all([
      test.leftNode.log.add({ type: 'a' }),
      test.leftNode.log.add({ type: 'b' })
    ])
  }).then(function () {
    expect(test.rightNode.log.actions()).toEqual([{ type: 'b' }])
  }).then(function () {
    return Promise.all([
      test.leftNode.log.add({ type: 'a' }),
      test.leftNode.log.add({ type: 'b' })
    ])
  }).then(function () {
    return test.leftNode.waitFor('synchronized')
  }).then(function () {
    expect(test.rightNode.log.actions()).toEqual([{ type: 'b' }, { type: 'b' }])
  })
})

it('maps output actions', function () {
  return createTest().then(function (test) {
    test.leftNode.options.outMap = function (action, meta) {
      expect(meta.id).toBeDefined()
      expect(meta.time).toBeDefined()
      expect(meta.added).toBeDefined()
      return Promise.resolve([{ type: action.type + '1' }, meta])
    }
    test.leftNode.log.add({ type: 'a' })
    return test.wait('left')
  }).then(function (test) {
    expect(test.leftNode.log.actions()).toEqual([{ type: 'a' }])
    expect(test.rightNode.log.actions()).toEqual([{ type: 'a1' }])
  })
})

it('uses output filter before map', function () {
  var calls = []
  return createTest().then(function (test) {
    test.leftNode.options.outMap = function (action, meta) {
      calls.push('map')
      return Promise.resolve([action, meta])
    }
    test.leftNode.options.outFilter = function () {
      calls.push('filter')
      return Promise.resolve(true)
    }
    test.leftNode.log.add({ type: 'a' })
    return test.wait('left')
  }).then(function () {
    expect(calls).toEqual(['filter', 'map'])
  })
})

it('filters input actions', function () {
  return createTest(function (test) {
    test.rightNode.options.inFilter = function (action, meta) {
      expect(meta.id).toBeDefined()
      expect(meta.time).toBeDefined()
      return Promise.resolve(action.type !== 'c')
    }
    test.leftNode.log.add({ type: 'a' })
    test.leftNode.log.add({ type: 'b' })
    test.leftNode.log.add({ type: 'c' })
  }).then(function (test) {
    expect(test.leftNode.log.actions()).toEqual([
      { type: 'a' }, { type: 'b' }, { type: 'c' }
    ])
    expect(test.rightNode.log.actions()).toEqual([
      { type: 'a' }, { type: 'b' }
    ])
  })
})

it('maps input actions', function () {
  return createTest().then(function (test) {
    test.rightNode.options.inMap = function (action, meta) {
      expect(meta.id).toBeDefined()
      expect(meta.time).toBeDefined()
      return Promise.resolve([{ type: action.type + '1' }, meta])
    }
    test.leftNode.log.add({ type: 'a' })
    return test.wait('left')
  }).then(function (test) {
    expect(test.leftNode.log.actions()).toEqual([{ type: 'a' }])
    expect(test.rightNode.log.actions()).toEqual([{ type: 'a1' }])
  })
})

it('uses input map before filter', function () {
  var calls = []
  return createTest().then(function (test) {
    test.rightNode.options.inMap = function (action, meta) {
      calls.push('map')
      return Promise.resolve([action, meta])
    }
    test.rightNode.options.inFilter = function () {
      calls.push('filter')
      return Promise.resolve(true)
    }
    test.leftNode.log.add({ type: 'a' })
    return test.wait('left')
  }).then(function () {
    expect(calls).toEqual(['map', 'filter'])
  })
})

it('reports errors during initial output filter', function () {
  var error = new Error('test')
  var catched = []
  var test = createPair()
  test.rightNode.log.add({ type: 'a' })
  test.rightNode.catch(function (e) {
    catched.push(e)
  })
  test.rightNode.options.outFilter = function () {
    return Promise.reject(error)
  }
  test.left.connect()
  return delay(50).then(function () {
    expect(catched).toEqual([error])
  })
})

it('reports errors during output filter', function () {
  var error = new Error('test')
  var catched = []
  return createTest(function (test) {
    test.rightNode.catch(function (e) {
      catched.push(e)
    })
    test.rightNode.options.outFilter = function () {
      return Promise.reject(error)
    }
  }).then(function (test) {
    test.rightNode.log.add({ type: 'a' })
    return delay(50)
  }).then(function () {
    expect(catched).toEqual([error])
  })
})

it('reports errors during initial output map', function () {
  var error = new Error('test')
  var catched = []
  var test = createPair()
  test.rightNode.log.add({ type: 'a' })
  test.rightNode.catch(function (e) {
    catched.push(e)
  })
  test.rightNode.options.outMap = function () {
    return Promise.reject(error)
  }
  test.left.connect()
  return delay(50).then(function () {
    expect(catched).toEqual([error])
  })
})

it('reports errors during output map', function () {
  var error = new Error('test')
  var catched = []
  return createTest(function (test) {
    test.rightNode.catch(function (e) {
      catched.push(e)
    })
    test.rightNode.options.outMap = function () {
      return Promise.reject(error)
    }
  }).then(function (test) {
    test.rightNode.log.add({ type: 'a' })
    return delay(50)
  }).then(function () {
    expect(catched).toEqual([error])
  })
})

it('reports errors during input filter', function () {
  var error = new Error('test')
  var catched = []
  return createTest().then(function (test) {
    test.rightNode.catch(function (e) {
      catched.push(e)
    })
    test.rightNode.options.inFilter = function () {
      return Promise.reject(error)
    }
    test.leftNode.log.add({ type: 'a' })
    return delay(50)
  }).then(function () {
    expect(catched).toEqual([error])
  })
})

it('reports errors during input map', function () {
  var error = new Error('test')
  var catched = []
  return createTest().then(function (test) {
    test.rightNode.catch(function (e) {
      catched.push(e)
    })
    test.rightNode.options.inMap = function () {
      return Promise.reject(error)
    }
    test.leftNode.log.add({ type: 'a' })
    return delay(50)
  }).then(function () {
    expect(catched).toEqual([error])
  })
})

it('compresses time', function () {
  var test
  return createTest().then(function (created) {
    test = created
    test.leftNode.baseTime = 100
    test.rightNode.baseTime = 100
    return Promise.all([
      test.leftNode.log.add({ type: 'a' }, { id: '1 test1 0', time: 1 })
    ])
  }).then(function () {
    return test.leftNode.waitFor('synchronized')
  }).then(function () {
    expect(test.leftSent).toEqual([
      [
        'sync',
        1,
        { type: 'a' },
        { id: [-99, 'test1', 0], time: -99, reasons: ['t'] }
      ]
    ])
    expect(test.rightNode.log.entries()).toEqual([
      [
        { type: 'a' },
        { id: '1 test1 0', time: 1, added: 1, reasons: ['t'] }
      ]
    ])
  })
})

it('compresses IDs', function () {
  var test
  return createTest().then(function (created) {
    test = created
    return Promise.all([
      test.leftNode.log.add({ type: 'a' }, { id: '1 client 0', time: 1 }),
      test.leftNode.log.add({ type: 'a' }, { id: '1 client 1', time: 1 }),
      test.leftNode.log.add({ type: 'a' }, { id: '1 o 0', time: 1 })
    ])
  }).then(function () {
    return test.leftNode.waitFor('synchronized')
  }).then(function () {
    expect(test.leftSent).toEqual([
      ['sync', 1, { type: 'a' }, { id: 1, time: 1, reasons: ['t'] }],
      ['sync', 2, { type: 'a' }, { id: [1, 1], time: 1, reasons: ['t'] }],
      ['sync', 3, { type: 'a' }, { id: [1, 'o', 0], time: 1, reasons: ['t'] }]
    ])
    expect(test.rightNode.log.entries()).toEqual([
      [
        { type: 'a' },
        { id: '1 client 0', time: 1, added: 1, reasons: ['t'] }
      ],
      [
        { type: 'a' },
        { id: '1 client 1', time: 1, added: 2, reasons: ['t'] }
      ],
      [
        { type: 'a' },
        { id: '1 o 0', time: 1, added: 3, reasons: ['t'] }
      ]
    ])
  })
})

it('synchronizes any meta fields', function () {
  var a = { type: 'a' }
  var test
  return createTest().then(function (created) {
    test = created
    return test.leftNode.log.add(a, { id: '1 test1 0', time: 1, one: 1 })
  }).then(function () {
    return test.leftNode.waitFor('synchronized')
  }).then(function () {
    expect(test.leftSent).toEqual([
      ['sync', 1, a, { id: [1, 'test1', 0], time: 1, one: 1, reasons: ['t'] }]
    ])
    expect(test.rightNode.log.entries()).toEqual([
      [a, { id: '1 test1 0', time: 1, added: 1, one: 1, reasons: ['t'] }]
    ])
  })
})

it('fixes created time', function () {
  var test
  return createTest().then(function (created) {
    test = created
    test.leftNode.timeFix = 10
    return Promise.all([
      test.leftNode.log.add({ type: 'a' }, { id: '11 test1 0', time: 11 }),
      test.rightNode.log.add({ type: 'b' }, { id: '2 test2 0', time: 2 })
    ])
  }).then(function () {
    return test.leftNode.waitFor('synchronized')
  }).then(function () {
    expect(test.leftNode.log.entries()).toEqual([
      [
        { type: 'a' },
        { id: '11 test1 0', time: 11, added: 1, reasons: ['t'] }
      ],
      [
        { type: 'b' },
        { id: '2 test2 0', time: 12, added: 2, reasons: ['t'] }
      ]
    ])
    expect(test.rightNode.log.entries()).toEqual([
      [
        { type: 'a' },
        { id: '11 test1 0', time: 1, added: 2, reasons: ['t'] }
      ],
      [
        { type: 'b' },
        { id: '2 test2 0', time: 2, added: 1, reasons: ['t'] }
      ]
    ])
  })
})

it('supports multiple actions in sync', function () {
  return createTest().then(function (test) {
    test.rightNode.sendSync(2, [
      [{ type: 'b' }, { id: '2 test2 0', time: 2, added: 2 }],
      [{ type: 'a' }, { id: '1 test2 0', time: 1, added: 1 }]
    ])
    return test.wait('right')
  }).then(function (test) {
    expect(test.leftNode.lastReceived).toBe(2)
    expect(test.leftNode.log.entries()).toEqual([
      [
        { type: 'a' },
        { id: '1 test2 0', time: 1, added: 1, reasons: ['t'] }
      ],
      [
        { type: 'b' },
        { id: '2 test2 0', time: 2, added: 2, reasons: ['t'] }
      ]
    ])
  })
})

it('starts and ends timeout', function () {
  return createTest().then(function (test) {
    test.leftNode.sendSync(1, [
      [{ type: 'a' }, { id: '1 test2 0', time: 1, added: 1 }]
    ])
    test.leftNode.sendSync(2, [
      [{ type: 'a' }, { id: '2 test2 0', time: 2, added: 1 }]
    ])
    expect(test.leftNode.timeouts).toHaveLength(2)

    test.leftNode.syncedMessage(1)
    expect(test.leftNode.timeouts).toHaveLength(1)

    test.leftNode.syncedMessage(2)
    expect(test.leftNode.timeouts).toHaveLength(0)
  })
})

it('changes multiple actions in map', function () {
  var test
  return createTest(function (created) {
    test = created
    test.leftNode.options.outMap = function (action, meta) {
      return Promise.resolve([{ type: action.type.toUpperCase() }, meta])
    }
    test.leftNode.log.add({ type: 'a' })
    test.leftNode.log.add({ type: 'b' })
  }).then(function () {
    return test.leftNode.waitFor('synchronized')
  }).then(function () {
    expect(test.rightNode.lastReceived).toBe(2)
    expect(test.rightNode.log.actions()).toEqual([{ type: 'A' }, { type: 'B' }])
  })
})

it('synchronizes actions on connect', function () {
  var test
  var added = []
  return createTest().then(function (created) {
    test = created
    test.leftNode.log.on('add', function (action) {
      added.push(action.type)
    })
    return Promise.all([
      test.leftNode.log.add({ type: 'a' }),
      test.rightNode.log.add({ type: 'b' })
    ])
  }).then(function () {
    return test.leftNode.waitFor('synchronized')
  }).then(function () {
    test.left.disconnect()
    return test.wait('right')
  }).then(function () {
    expect(test.leftNode.lastSent).toBe(1)
    expect(test.leftNode.lastReceived).toBe(1)
    return Promise.all([
      test.leftNode.log.add({ type: 'c' }),
      test.leftNode.log.add({ type: 'd' }),
      test.rightNode.log.add({ type: 'e' }),
      test.rightNode.log.add({ type: 'f' })
    ])
  }).then(function () {
    return test.left.connect()
  }).then(function () {
    test.rightNode = new ServerNode('server2', test.rightNode.log, test.right)
    return test.leftNode.waitFor('synchronized')
  }).then(function () {
    expect(test.leftNode.log.actions()).toEqual([
      { type: 'a' },
      { type: 'b' },
      { type: 'c' },
      { type: 'd' },
      { type: 'e' },
      { type: 'f' }
    ])
    expect(test.leftNode.log.actions()).toEqual(test.rightNode.log.actions())
    expect(added).toEqual(['a', 'b', 'c', 'd', 'e', 'f'])
  })
})
