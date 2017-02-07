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
    if (entry.length) {
      return log.add(entry[0], entry[1])
    } else {
      return log.add(entry)
    }
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
  }).toThrowError(/Logux store/)
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

  return log.add({ type: 'a' }).then(function () {
    log.on('add', function (action, meta) {
      expect(typeof meta).toEqual('object')
      actions1.push(action)
    })

    log.on('add', function (action) {
      actions2.push(action)
    })

    expect(actions1).toEqual([])
    expect(actions2).toEqual([])

    return log.add({ type: 'b' })
  }).then(function () {
    return log.add({ type: 'c' })
  }).then(function () {
    expect(actions1).toEqual([{ type: 'b' }, { type: 'c' }])
    expect(actions2).toEqual(actions1)
  })
})

it('supports one-time listeners', function () {
  var log = createLog()

  var actions = []
  log.once('add', function (action) {
    actions.push(action)
  })

  return log.add({ type: 'b' }).then(function () {
    return log.add({ type: 'c' })
  }).then(function () {
    expect(actions).toEqual([{ type: 'b' }])
  })
})

it('unsubscribes listeners', function () {
  var log = createLog()

  var actions = []
  var unsubscribe = log.on('add', function (action) {
    actions.push(action)
  })

  return log.add({ type: 'a' }).then(function () {
    unsubscribe()
    return log.add({ type: 'b' })
  }).then(function () {
    expect(actions).toEqual([{ type: 'a' }])
  })
})

it('ignore entry with existed ID', function () {
  var log = createLog()

  var added = []
  log.on('add', function (action) {
    added.push(action)
  })

  return log.add({ type: 'a' }, { id: [0] }).then(function (result1) {
    expect(typeof result1).toEqual('object')
    return log.add({ type: 'b' }, { id: [0] })
  }).then(function (result2) {
    expect(result2).toBeFalsy()
    checkActions(log, [{ type: 'a' }])
    expect(added).toEqual([{ type: 'a' }])
  })
})

it('iterates through added entries', function () {
  return logWith([
    [{ type: 'a' }, { id: [3] }],
    [{ type: 'b' }, { id: [2] }],
    [{ type: 'c' }, { id: [1] }]
  ]).then(function (log) {
    var entries = []
    return log.each(function (action, meta) {
      entries.push([action, meta])
    }).then(function () {
      expect(entries).toEqual([
        [{ type: 'a' }, { id: [3], time: 3, added: 1, reasons: [] }],
        [{ type: 'b' }, { id: [2], time: 2, added: 2, reasons: [] }],
        [{ type: 'c' }, { id: [1], time: 1, added: 3, reasons: [] }]
      ])
    })
  })
})

it('iterates by added order', function () {
  return logWith([
    [{ type: 'a' }, { id: [3] }],
    [{ type: 'b' }, { id: [2] }],
    [{ type: 'c' }, { id: [1] }]
  ]).then(function (log) {
    var actions = []
    return log.each({ order: 'added' }, function (action) {
      actions.push(action)
    }).then(function () {
      expect(actions).toEqual([
        { type: 'c' },
        { type: 'b' },
        { type: 'a' }
      ])
    })
  })
})

it('disables iteration on false', function () {
  return logWith([
    { type: 'a' },
    { type: 'b' }
  ]).then(function (log) {
    var actions = []
    return log.each(function (action) {
      actions.push(action)
      return false
    }).then(function () {
      expect(actions).toEqual([{ type: 'b' }])
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

it('keeps existed ID', function () {
  return logWith([
    [{ type: 'timed' }, { id: [100] }]
  ]).then(function (log) {
    checkEntries(log, [
      [{ type: 'timed' }, { id: [100], time: 100, added: 1, reasons: [] }]
    ])
  })
})

it('keeps existed ID, time and reasons', function () {
  return logWith([
    [{ type: 'timed' }, { id: [100], time: 1, reasons: ['a'] }]
  ]).then(function (log) {
    checkEntries(log, [
      [{ type: 'timed' }, { id: [100], time: 1, added: 1, reasons: ['a'] }]
    ])
  })
})

it('sets default ID, time and reason for new entries', function () {
  var log = createLog()
  return log.add({ type: 'timeless' }).then(function (meta) {
    expect(meta).toEqual(log.store.created[0][1])
    expect(meta.added).toEqual(1)
    expect(meta.reasons).toEqual([])
    expect(typeof meta.time).toEqual('number')
    expect(meta.id.length).toEqual(3)
    expect(meta.id[0]).toEqual(meta.time)
    expect(meta.id[1]).toEqual('test')
    expect(meta.id[2]).toEqual(0)
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

  expect(log.generateId()).toEqual([10, 'test', 0])
  expect(log.generateId()).toEqual([10, 'test', 1])
})

it('changes meta', function () {
  return logWith([
    [{ type: 'A' }, { id: [1, 'node', 0] }],
    [{ type: 'B' }, { id: [2, 'node', 0], a: 1 }]
  ]).then(function (log) {
    return log.changeMeta([2, 'node', 0], { a: 2, b: 2 }).then(function (r) {
      expect(r).toBeTruthy()
      checkEntries(log, [
        [
          { type: 'B' },
          { id: [2, 'node', 0], time: 2, added: 2, reasons: [], a: 2, b: 2 }
        ],
        [
          { type: 'A' },
          { id: [1, 'node', 0], time: 1, added: 1, reasons: [] }
        ]
      ])
    })
  })
})

it('does not allow to change ID or added', function () {
  var log = createLog()
  expect(function () {
    log.changeMeta([1], { id: [2] })
  }).toThrowError(/id is prohibbited/)
  expect(function () {
    log.changeMeta([1], { added: 2 })
  }).toThrowError(/added is prohibbited/)
})

it('cleans log by reason', function () {
  return logWith([
    [{ type: 'A' }, { reasons: ['a'] }],
    [{ type: 'AB' }, { reasons: ['a', 'b'] }],
    [{ type: 'B' }, { reasons: ['b'] }]
  ]).then(function (log) {
    return log.removeReason('a').then(function () {
      checkActions(log, [{ type: 'B' }, { type: 'AB' }])
      expect(log.store.created[1][1].reasons).toEqual(['a'])
    })
  })
})

it('removes reason with minimum added', function () {
  return logWith([
    [{ type: '1' }, { reasons: ['a'] }],
    [{ type: '2' }, { reasons: ['a'] }],
    [{ type: '3' }, { reasons: ['a'] }]
  ]).then(function (log) {
    return log.removeReason('a', { minAdded: 2 }).then(function () {
      checkActions(log, [{ type: '3' }])
    })
  })
})

it('removes reason with maximum added', function () {
  return logWith([
    [{ type: '1' }, { reasons: ['a'] }],
    [{ type: '2' }, { reasons: ['a'] }],
    [{ type: '3' }, { reasons: ['a'] }]
  ]).then(function (log) {
    return log.removeReason('a', { maxAdded: 2 }).then(function () {
      checkActions(log, [{ type: '1' }])
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
        checkActions(log, [{ type: '3' }, { type: '1' }])
      })
  })
})
