var MemoryStore = require('../memory-store')
var Log = require('../log')

function createLog () {
  return new Log({
    nodeId: 'test',
    store: new MemoryStore()
  })
}

function checkActions (log, expected) {
  var actions = log.store.created.map(function (entry) {
    return entry[0]
  })
  expect(actions).toEqual(expected)
}

function checkEntries (log, expected) {
  var entries = log.store.created.map(function (entry) {
    return [entry[0], entry[1]]
  })
  expect(entries).toEqual(expected)
}

function logWith (entries) {
  var log = createLog()
  return Promise.all(entries.map(function (entry) {
    return log.add(entry[0], entry[1])
  })).then(function () {
    return log
  })
}

var originNow = Date.now
afterEach(function () {
  Date.now = originNow
})

it('requires node ID', function () {
  expect(function () {
    new Log()
  }).toThrowError(/node ID/)
})

it('requires store', function () {
  expect(function () {
    new Log({ nodeId: 'test' })
  }).toThrowError(/store/)
})

it('checks node ID', function () {
  expect(function () {
    new Log({ nodeId: 'a b', store: new MemoryStore() })
  }).toThrowError(/Space/)
})

it('requires type for action', function () {
  var log = createLog()
  expect(function () {
    log.add({ a: 1 })
  }).toThrowError(/type/)
})

it('sends new entries to listeners', function () {
  var log = createLog()
  var actions1 = []
  var actions2 = []

  return log.add({ type: 'A' }).then(function () {
    log.on('add', function (action, meta) {
      expect(typeof meta).toEqual('object')
      actions1.push(action)
    })

    log.on('add', function (action) {
      actions2.push(action)
    })

    expect(actions1).toEqual([])
    expect(actions2).toEqual([])

    return log.add({ type: 'B' })
  }).then(function () {
    return log.add({ type: 'C' })
  }).then(function () {
    expect(actions1).toEqual([{ type: 'B' }, { type: 'C' }])
    expect(actions2).toEqual(actions1)
  })
})

it('unsubscribes listeners', function () {
  var log = createLog()

  var actions = []
  var unsubscribe = log.on('add', function (action) {
    actions.push(action)
  })

  return log.add({ type: 'A' }).then(function () {
    unsubscribe()
    return log.add({ type: 'B' })
  }).then(function () {
    expect(actions).toEqual([{ type: 'A' }])
  })
})

it('ignore entry with existed ID', function () {
  var log = createLog()

  var added = []
  log.on('add', function (action) {
    added.push(action)
  })

  var meta = { id: '0 n 0', reasons: ['test'] }
  return log.add({ type: 'A' }, meta).then(function (result1) {
    expect(typeof result1).toEqual('object')
    return log.add({ type: 'B' }, meta)
  }).then(function (result2) {
    expect(result2).toBeFalsy()
    checkActions(log, [{ type: 'A' }])
    expect(added).toEqual([{ type: 'A' }])
  })
})

it('iterates through added entries', function () {
  return logWith([
    [{ type: 'A' }, { id: '3 n 0', reasons: ['test'] }],
    [{ type: 'B' }, { id: '2 n 0', reasons: ['test'] }],
    [{ type: 'C' }, { id: '1 n 0', reasons: ['test'] }]
  ]).then(function (log) {
    var entries = []
    return log.each(function (action, meta) {
      entries.push([action, meta])
    }).then(function () {
      expect(entries).toEqual([
        [{ type: 'A' }, { id: '3 n 0', time: 3, added: 1, reasons: ['test'] }],
        [{ type: 'B' }, { id: '2 n 0', time: 2, added: 2, reasons: ['test'] }],
        [{ type: 'C' }, { id: '1 n 0', time: 1, added: 3, reasons: ['test'] }]
      ])
    })
  })
})

it('iterates by added order', function () {
  return logWith([
    [{ type: 'A' }, { id: '3 n 0', reasons: ['test'] }],
    [{ type: 'B' }, { id: '2 n 0', reasons: ['test'] }],
    [{ type: 'C' }, { id: '1 n 0', reasons: ['test'] }]
  ]).then(function (log) {
    var actions = []
    return log.each({ order: 'added' }, function (action) {
      actions.push(action)
    }).then(function () {
      expect(actions).toEqual([
        { type: 'C' },
        { type: 'B' },
        { type: 'A' }
      ])
    })
  })
})

it('disables iteration on false', function () {
  return logWith([
    [{ type: 'A' }, { reasons: ['test'] }],
    [{ type: 'B' }, { reasons: ['test'] }]
  ]).then(function (log) {
    var actions = []
    return log.each(function (action) {
      actions.push(action)
      return false
    }).then(function () {
      expect(actions).toEqual([{ type: 'B' }])
    })
  })
})

it('supports multi-pages stores', function () {
  var store = {
    get: function () {
      return Promise.resolve({
        entries: [['a', 'a']],
        next: function () {
          return Promise.resolve({ entries: [['b', 'b']] })
        }
      })
    }
  }
  var log = new Log({ nodeId: 'test', store: store })

  var actions = []
  return log.each(function (action) {
    actions.push(action)
  }).then(function () {
    expect(actions).toEqual(['a', 'b'])
  })
})

it('copies time from ID', function () {
  return logWith([
    [{ type: 'TIMED' }, { id: '100 n 0', reasons: ['test'] }]
  ]).then(function (log) {
    checkEntries(log, [
      [
        { type: 'TIMED' },
        { id: '100 n 0', time: 100, added: 1, reasons: ['test'] }
      ]
    ])
  })
})

it('keeps existed ID, time and reasons', function () {
  return logWith([
    [{ type: 'TIMED' }, { id: '100 n 0', time: 1, reasons: ['a'] }]
  ]).then(function (log) {
    checkEntries(log, [
      [{ type: 'TIMED' }, { id: '100 n 0', time: 1, added: 1, reasons: ['a'] }]
    ])
  })
})

it('sets default ID and time and empty reasons for new entries', function () {
  var log = createLog()
  log.on('add', function (action, meta) {
    expect(meta.added).toEqual(1)
    expect(meta.reasons).toEqual([])
    expect(typeof meta.time).toEqual('number')
    expect(meta.id).toEqual(meta.time + ' test 0')
  })
})

it('generates unique ID', function () {
  var log = createLog()
  var used = []
  for (var i = 0; i < 100; i++) {
    var id = log.generateId()
    expect(used).not.toContainEqual(id)
    used.push(id)
  }
})

it('always generates biggest ID', function () {
  var log = createLog()
  var times = [10, 9]

  Date.now = function () {
    return times.shift()
  }

  expect(log.generateId()).toEqual('10 test 0')
  expect(log.generateId()).toEqual('10 test 1')
})

it('changes meta', function () {
  return logWith([
    [{ type: 'A' }, { reasons: ['t'], id: '1 node 0' }],
    [{ type: 'B' }, { reasons: ['t'], id: '2 node 0', a: 1 }]
  ]).then(function (log) {
    return log.changeMeta('2 node 0', { a: 2, b: 2 }).then(function (r) {
      expect(r).toBeTruthy()
      checkEntries(log, [
        [
          { type: 'A' },
          { id: '1 node 0', time: 1, added: 1, reasons: ['t'] }
        ],
        [
          { type: 'B' },
          { id: '2 node 0', time: 2, added: 2, reasons: ['t'], a: 2, b: 2 }
        ]
      ])
    })
  })
})

it('does not allow to change ID or added', function () {
  var log = createLog()
  expect(function () {
    log.changeMeta('1 n 0', { id: '2 n 0' })
  }).toThrowError(/"id" is read-only/)
  expect(function () {
    log.changeMeta('1 n 0', { added: 2 })
  }).toThrowError(/"added" is read-only/)
  expect(function () {
    log.changeMeta('1 n 0', { time: 2 })
  }).toThrowError(/"time" is read-only/)
})

it('removes action on setting entry reasons', function () {
  return logWith([
    [{ type: 'A' }, { reasons: ['test'], id: '1 n 0' }],
    [{ type: 'B' }, { reasons: ['test'], id: '2 n 0' }]
  ]).then(function (log) {
    var cleaned = []
    log.on('clean', function (action, meta) {
      cleaned.push([action, meta])
    })

    return log.changeMeta('2 n 0', { reasons: [], a: 1 }).then(function (r) {
      expect(r).toBeTruthy()
      expect(cleaned).toEqual([
        [{ type: 'B' }, { id: '2 n 0', time: 2, added: 2, reasons: [], a: 1 }]
      ])
      checkEntries(log, [
        [{ type: 'A' }, { id: '1 n 0', time: 1, added: 1, reasons: ['test'] }]
      ])
      return log.changeMeta('3 n 0', { reasons: [] })
    }).then(function (r) {
      expect(r).toBeFalsy()
    })
  })
})

it('returns action by ID', function () {
  return logWith([
    [{ type: 'A' }, { reasons: ['test'], id: '1 n 0' }]
  ]).then(function (log) {
    return log.byId('1 n 0').then(function (result) {
      expect(result[0]).toEqual({ type: 'A' })
      expect(result[1].reasons).toEqual(['test'])
      return log.byId('2 n 0')
    }).then(function (result) {
      expect(result[0]).toBeNull()
      expect(result[1]).toBeNull()
    })
  })
})

it('cleans log by reason', function () {
  return logWith([
    [{ type: 'A' }, { reasons: ['a'] }],
    [{ type: 'AB' }, { reasons: ['a', 'b'] }],
    [{ type: 'B' }, { reasons: ['b'] }]
  ]).then(function (log) {
    var cleaned = []
    log.on('clean', function (action, meta) {
      cleaned.push([action, meta.added, meta.reasons])
    })
    return log.removeReason('a').then(function () {
      checkActions(log, [{ type: 'AB' }, { type: 'B' }])
      expect(log.store.created[1][1].reasons).toEqual(['b'])
      expect(cleaned).toEqual([
        [{ type: 'A' }, 1, []]
      ])
    })
  })
})

it('removes reason with minimum and maximum added', function () {
  return logWith([
    [{ type: '1' }, { reasons: ['a'] }],
    [{ type: '2' }, { reasons: ['a'] }],
    [{ type: '3' }, { reasons: ['a'] }]
  ]).then(function (log) {
    return log.removeReason('a', { maxAdded: 2, minAdded: 2 })
      .then(function () {
        checkActions(log, [{ type: '1' }, { type: '3' }])
      })
  })
})

it('does not put actions without reasons to log', function () {
  var log = createLog()

  var added = []
  log.on('add', function (action, meta) {
    expect(meta.id).not.toBeUndefined()
    added.push([action, meta.added])
  })
  var cleaned = []
  log.on('clean', function (action, meta) {
    cleaned.push([action, meta.added])
  })

  return log.add({ type: 'A' }).then(function (meta) {
    expect(meta.reasons).toEqual([])
    expect(added).toEqual([
      [{ type: 'A' }, undefined]
    ])
    expect(cleaned).toEqual([
      [{ type: 'A' }, undefined]
    ])
    checkActions(log, [])
    return log.add({ type: 'B' }, { reasons: ['test'] })
  }).then(function () {
    expect(added).toEqual([
      [{ type: 'A' }, undefined],
      [{ type: 'B' }, 1]
    ])
    expect(cleaned).toEqual([
      [{ type: 'A' }, undefined]
    ])
    checkActions(log, [{ type: 'B' }])
  })
})

it('checks ID for actions without reasons', function () {
  var log = createLog()

  var added = []
  log.on('add', function (action, meta) {
    added.push([action, meta.added])
  })
  var cleaned = []
  log.on('clean', function (action, meta) {
    cleaned.push([action, meta.added])
  })

  return log.add(
    { type: 'A' }, { id: '1 n 0', reasons: ['t'] }
  ).then(function () {
    return log.add({ type: 'B' }, { id: '1 n 0' })
  }).then(function (meta) {
    expect(meta).toBeFalsy()
    expect(added).toEqual([
      [{ type: 'A' }, 1]
    ])
    expect(cleaned).toEqual([])
    return log.add({ type: 'C' }, { id: '2 n 0' })
  }).then(function (meta) {
    expect(meta).not.toBeFalsy()
    expect(added).toEqual([
      [{ type: 'A' }, 1],
      [{ type: 'C' }, undefined]
    ])
    expect(cleaned).toEqual([
      [{ type: 'C' }, undefined]
    ])
  })
})

it('fires preadd event', function () {
  var log = createLog()

  var add = []
  log.on('add', function (action) {
    add.push(action.type)
  })

  var preadd = []
  log.on('preadd', function (action, meta) {
    expect(meta.added).toBeUndefined()
    if (action.type === 'A') meta.reasons.push('test')
    preadd.push(action.type)
  })

  return log.add({ type: 'A' }, { id: '1 n 0' }).then(function () {
    checkEntries(log, [
      [{ type: 'A' }, { id: '1 n 0', time: 1, added: 1, reasons: ['test'] }]
    ])
    expect(preadd).toEqual(['A'])
    expect(add).toEqual(['A'])
    return log.add({ type: 'B' }, { id: '1 n 0' })
  }).then(function () {
    expect(preadd).toEqual(['A', 'B'])
    expect(add).toEqual(['A'])
  })
})

it('removes reasons when keepLast option is used', function () {
  return logWith([
    [{ type: '1' }, { keepLast: 'a' }],
    [{ type: '2' }, { keepLast: 'a' }],
    [{ type: '3' }, { keepLast: 'a' }]
  ]).then(function (log) {
    return checkActions(log, [{ type: '3' }])
  })
})

it('allows to set keepLast in preadd', function () {
  var log = createLog()
  log.on('preadd', function (action, meta) {
    meta.keepLast = 'a'
  })
  return Promise.all([
    log.add({ type: '1' }),
    log.add({ type: '2' }),
    log.add({ type: '3' })
  ]).then(function () {
    return checkActions(log, [{ type: '3' }])
  })
})

it('ensures `reasons` to be array of string values', function () {
  var log = createLog()

  return log.add({ type: '1' }).then(function (meta) {
    expect(meta.reasons).toEqual([])
    return log.add({ type: '2' }, { reasons: 'a' })
  }).then(function (meta) {
    expect(meta.reasons).toEqual(['a'])
    return log.add({ type: '3' }, { reasons: [false, 1] })
  }).catch(function (err) {
    expect(err.message).toEqual('Expected "reasons" to be strings')
  })
})
