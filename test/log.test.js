var createTestTimer = require('../create-test-timer')
var MemoryStore = require('../memory-store')
var Log = require('../log')

function createLog () {
  return new Log({ timer: createTestTimer(), store: new MemoryStore() })
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

it('requires timer', function () {
  expect(function () {
    new Log()
  }).toThrowError(/log timer/)
})

it('requires store', function () {
  expect(function () {
    new Log({ timer: createTestTimer() })
  }).toThrowError(/log store/)
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

it('ignore existed ID', function () {
  var log = createLog()

  var added = []
  log.on('add', function (action) {
    added.push(action)
  })

  return log.add({ type: 'a' }, { id: [0] }).then(function (result1) {
    expect(result1).toBeTruthy()
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
        [{ type: 'a' }, { id: [3], time: 3, added: 1 }],
        [{ type: 'b' }, { id: [2], time: 2, added: 2 }],
        [{ type: 'c' }, { id: [1], time: 1, added: 3 }]
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
  var log = new Log({ timer: createTestTimer(), store: store })

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
      [{ type: 'timed' }, { id: [100], time: 100, added: 1 }]
    ])
  })
})

it('keeps existed time', function () {
  return logWith([
    [{ type: 'timed' }, { id: [100], time: 1 }]
  ]).then(function (log) {
    checkEntries(log, [
      [{ type: 'timed' }, { id: [100], time: 1, added: 1 }]
    ])
  })
})

it('sets time for timeless entries', function () {
  return logWith([
    [{ type: 'timeless' }]
  ]).then(function (log) {
    checkEntries(log, [
      [{ type: 'timeless' }, { id: [1], time: 1, added: 1 }]
    ])
  })
})

it('cleans entries', function () {
  return logWith([
    { type: 'a' }
  ]).then(function (log) {
    return log.clean().then(function () {
      checkEntries(log, [])
    })
  })
})

it('keeps entries from cleaning', function () {
  return logWith([
    { type: 'a' },
    { type: 'b' }
  ]).then(function (log) {
    log.keep(function (action) {
      return action.type === 'b'
    })
    return log.clean().then(function () {
      checkActions(log, [{ type: 'b' }])
    })
  })
})

it('removes keeper', function () {
  return logWith([
    { type: 'a' },
    { type: 'b' }
  ]).then(function (log) {
    var unkeep = log.keep(function (action) {
      return action.type === 'b'
    })
    return log.clean().then(function () {
      checkActions(log, [{ type: 'b' }])
      unkeep()
      return log.clean()
    }).then(function () {
      checkActions(log, [])
    })
  })
})

it('does not fall on multiple unkeep call', function () {
  var log = createLog()
  var unkeep = log.keep(function () { })
  unkeep()
  unkeep()
})
