'use strict'

var assert = require('assert')

function all (request, list) {
  if (!list) list = []
  return request.then(function (page) {
    list = page.entries.concat(list)
    return page.next ? all(page.next(), list) : list
  })
}

function check (store, order, list) {
  return all(store.get({ order: order })).then(function (entries) {
    assert.deepEqual(entries, list)
  })
}

function checkBoth (store, entries) {
  return Promise.all([
    check(store, 'created', entries),
    check(store, 'added', entries)
  ])
}

function nope () { }

/**
 * Pass all common tests for Logux store to callback.
 *
 * @param {creator} test Callback to create tests in your test framework.
 *
 * @returns {undefined}
 *
 * @example
 * import { eachStoreCheck } from 'logux-core'
 *
 * eachStoreCheck((desc, creator) => {
 *   it(desc, creator(() => new CustomStore()))
 * })
 */
function eachStoreCheck (test) {
  test('is empty in the beginning', function (factory) {
    return function () {
      var store = factory()
      return checkBoth(store, []).then(function () {
        return store.getLastAdded()
      }).then(function (added) {
        assert.equal(added, 0)
        return store.getLastSynced()
      }).then(function (synced) {
        assert.deepEqual(synced, { sent: 0, received: 0 })
      })
    }
  })

  test('updates latest synced values', function (factory) {
    return function () {
      var store = factory()
      return store.setLastSynced({ sent: 1 }).then(function () {
        return store.getLastSynced()
      }).then(function (synced) {
        return assert.deepEqual(synced, { sent: 1, received: 0 })
      }).then(function () {
        return store.setLastSynced({ received: 1 })
      }).then(function () {
        return store.getLastSynced()
      }).then(function (synced) {
        return assert.deepEqual(synced, { sent: 1, received: 1 })
      })
    }
  })

  test('updates both synced values', function (factory) {
    return function () {
      var store = factory()
      return store.setLastSynced({ sent: 2, received: 1 }).then(function () {
        return store.getLastSynced()
      }).then(function (synced) {
        return assert.deepEqual(synced, { sent: 2, received: 1 })
      })
    }
  })

  test('stores entries sorted', function (factory) {
    return function () {
      var store = factory()
      return Promise.all([
        store.add({ type: '1' }, { id: [1, 'a', 0], time: 1 }),
        store.add({ type: '2' }, { id: [1, 'c', 0], time: 2 }),
        store.add({ type: '3' }, { id: [1, 'b', 1], time: 2 }),
        store.add({ type: '4' }, { id: [3, 'b', 0], time: 2 })
      ]).then(function () {
        return check(store, 'created', [
          [{ type: '1' }, { added: 1, id: [1, 'a', 0], time: 1 }],
          [{ type: '4' }, { added: 4, id: [3, 'b', 0], time: 2 }],
          [{ type: '3' }, { added: 3, id: [1, 'b', 1], time: 2 }],
          [{ type: '2' }, { added: 2, id: [1, 'c', 0], time: 2 }]
        ])
      }).then(function () {
        return check(store, 'added', [
          [{ type: '1' }, { added: 1, id: [1, 'a', 0], time: 1 }],
          [{ type: '2' }, { added: 2, id: [1, 'c', 0], time: 2 }],
          [{ type: '3' }, { added: 3, id: [1, 'b', 1], time: 2 }],
          [{ type: '4' }, { added: 4, id: [3, 'b', 0], time: 2 }]
        ])
      })
    }
  })

  test('returns latest added', function (factory) {
    return function () {
      var store = factory()
      return store.add({ type: 'A' }, { id: [1], time: 1 }).then(function () {
        return store.getLastAdded().then(function (added) {
          assert.ok(added)
          return store.add({ type: 'A' }, { id: [1] })
        }).then(function () {
          return store.getLastAdded()
        }).then(function (added) {
          assert.equal(added, 1)
        })
      })
    }
  })

  test('changes meta', function (factory) {
    return function () {
      var store = factory()
      return store.add({ }, { id: [1], time: 1, a: 1 }).then(function () {
        return store.changeMeta([1], { a: 2, b: 2 })
      }).then(function (result) {
        assert.equal(result, true)
        return checkBoth(store, [
          [{ }, { id: [1], time: 1, added: 1, a: 2, b: 2 }]
        ])
      })
    }
  })

  test('resolves to false on unknown ID in changeMeta', function (factory) {
    return function () {
      var store = factory()
      return store.changeMeta([1], { a: 1 }).then(function (result) {
        assert.equal(result, false)
      })
    }
  })

  test('removes entries', function (factory) {
    return function () {
      var store = factory()
      return Promise.all([
        store.add({ type: '1' }, { id: [1, 'node1', 0], time: 1 }),
        store.add({ type: '1' }, { id: [1, 'node1', 0], time: 1 }),
        store.add({ type: '2' }, { id: [1, 'node1', 1], time: 2 }),
        store.add({ type: '3' }, { id: [1, 'node1', 2], time: 2 }),
        store.add({ type: '4' }, { id: [1, 'node1', 3], time: 2 }),
        store.add({ type: '5' }, { id: [1, 'node2', 0], time: 2 }),
        store.add({ type: '6' }, { id: [4, 'node1', 0], time: 4 })
      ]).then(function () {
        return store.remove([1, 'node1', 1])
      }).then(function (result) {
        assert.deepEqual(result, [
          { type: '2' }, { id: [1, 'node1', 1], time: 2, added: 2 }
        ])
        return checkBoth(store, [
          [{ type: '1' }, { id: [1, 'node1', 0], time: 1, added: 1 }],
          [{ type: '3' }, { id: [1, 'node1', 2], time: 2, added: 3 }],
          [{ type: '4' }, { id: [1, 'node1', 3], time: 2, added: 4 }],
          [{ type: '5' }, { id: [1, 'node2', 0], time: 2, added: 5 }],
          [{ type: '6' }, { id: [4, 'node1', 0], time: 4, added: 6 }]
        ])
      })
    }
  })

  test('removes entry with 0 time', function (factory) {
    return function () {
      var store = factory()
      return Promise.all([
        store.add({ type: '1' }, { id: [1, 'node1', 0], time: 1 }),
        store.add({ type: '2' }, { id: [2, 'node1', 0], time: 2 }),
        store.add({ type: '3' }, { id: [3, 'node1', 0], time: 0 })
      ]).then(function () {
        store.remove([3, 'node1', 0])
      }).then(function () {
        return checkBoth(store, [
          [{ type: '1' }, { id: [1, 'node1', 0], time: 1, added: 1 }],
          [{ type: '2' }, { id: [2, 'node1', 0], time: 2, added: 2 }]
        ])
      })
    }
  })

  test('ignores removing unknown entry', function (factory) {
    return function () {
      var store = factory()
      return store.add({ }, { id: [1], time: 1, added: 1 }).then(function () {
        return store.remove([2])
      }).then(function (result) {
        assert.equal(result, false)
        return check(store, 'created', [
          [{ }, { id: [1], time: 1, added: 1 }]
        ])
      })
    }
  })

  test('removes reasons and actions without reason', function (factory) {
    return function () {
      var store = factory()
      var removed = []
      return Promise.all([
        store.add({ type: '1' }, { id: [1], time: 1, reasons: ['a'] }),
        store.add({ type: '2' }, { id: [2], time: 2, reasons: ['a'] }),
        store.add({ type: '3' }, { id: [3], time: 3, reasons: ['a', 'b'] }),
        store.add({ type: '4' }, { id: [4], time: 4, reasons: ['b'] })
      ]).then(function () {
        return store.removeReason('a', { }, function (action, meta) {
          removed.push([action, meta])
        })
      }).then(function () {
        return checkBoth(store, [
          [{ type: '3' }, { added: 3, id: [3], time: 3, reasons: ['b'] }],
          [{ type: '4' }, { added: 4, id: [4], time: 4, reasons: ['b'] }]
        ])
      })
    }
  })

  test('removes reason by time', function (factory) {
    return function () {
      var store = factory()
      return Promise.all([
        store.add({ type: '1' }, { id: [1], time: 1, reasons: ['a'] }),
        store.add({ type: '2' }, { id: [2], time: 2, reasons: ['a'] }),
        store.add({ type: '3' }, { id: [3], time: 3, reasons: ['a'] })
      ]).then(function () {
        var m1 = { id: [1], time: 1 }
        var m3 = { id: [3], time: 3 }
        return store.removeReason('a', { olderThan: m3, youngerThan: m1 }, nope)
      }).then(function () {
        return checkBoth(store, [
          [{ type: '1' }, { added: 1, id: [1], time: 1, reasons: ['a'] }],
          [{ type: '3' }, { added: 3, id: [3], time: 3, reasons: ['a'] }]
        ])
      })
    }
  })

  test('removes reason for older action', function (factory) {
    return function () {
      var store = factory()
      return Promise.all([
        store.add({ type: '1' }, { id: [1], time: 1, reasons: ['a'] }),
        store.add({ type: '2' }, { id: [2], time: 2, reasons: ['a'] }),
        store.add({ type: '3' }, { id: [3], time: 3, reasons: ['a'] })
      ]).then(function () {
        var m2 = { id: [2], time: 2 }
        return store.removeReason('a', { olderThan: m2 }, nope)
      }).then(function () {
        return checkBoth(store, [
          [{ type: '2' }, { added: 2, id: [2], time: 2, reasons: ['a'] }],
          [{ type: '3' }, { added: 3, id: [3], time: 3, reasons: ['a'] }]
        ])
      })
    }
  })

  test('removes reason for younger action', function (factory) {
    return function () {
      var store = factory()
      return Promise.all([
        store.add({ type: '1' }, { id: [1], time: 1, reasons: ['a'] }),
        store.add({ type: '2' }, { id: [2], time: 2, reasons: ['a'] }),
        store.add({ type: '3' }, { id: [3], time: 3, reasons: ['a'] })
      ]).then(function () {
        var m2 = { id: [2], time: 2 }
        return store.removeReason('a', { youngerThan: m2 }, nope)
      }).then(function () {
        return checkBoth(store, [
          [{ type: '1' }, { added: 1, id: [1], time: 1, reasons: ['a'] }],
          [{ type: '2' }, { added: 2, id: [2], time: 2, reasons: ['a'] }]
        ])
      })
    }
  })

  test('removes reason with minimum added', function (factory) {
    return function () {
      var store = factory()
      return Promise.all([
        store.add({ type: '1' }, { id: [1], time: 1, reasons: ['a'] }),
        store.add({ type: '2' }, { id: [2], time: 2, reasons: ['a'] }),
        store.add({ type: '3' }, { id: [3], time: 3, reasons: ['a'] })
      ]).then(function () {
        return store.removeReason('a', { minAdded: 2 }, nope)
      }).then(function () {
        return checkBoth(store, [
          [{ type: '1' }, { added: 1, id: [1], time: 1, reasons: ['a'] }]
        ])
      })
    }
  })

  test('removes reason with maximum added', function (factory) {
    return function () {
      var store = factory()
      return Promise.all([
        store.add({ type: '1' }, { id: [1], time: 1, reasons: ['a'] }),
        store.add({ type: '2' }, { id: [2], time: 2, reasons: ['a'] }),
        store.add({ type: '3' }, { id: [3], time: 3, reasons: ['a'] })
      ]).then(function () {
        return store.removeReason('a', { maxAdded: 2 }, nope)
      }).then(function () {
        return checkBoth(store, [
          [{ type: '3' }, { added: 3, id: [3], time: 3, reasons: ['a'] }]
        ])
      })
    }
  })

  test('removes reason with minimum and maximum added', function (factory) {
    return function () {
      var store = factory()
      return Promise.all([
        store.add({ type: '1' }, { id: [1], time: 1, reasons: ['a'] }),
        store.add({ type: '2' }, { id: [2], time: 2, reasons: ['a'] }),
        store.add({ type: '3' }, { id: [3], time: 3, reasons: ['a'] })
      ]).then(function () {
        return store.removeReason('a', { maxAdded: 2, minAdded: 2 }, nope)
      }).then(function () {
        return checkBoth(store, [
          [{ type: '1' }, { added: 1, id: [1], time: 1, reasons: ['a'] }],
          [{ type: '3' }, { added: 3, id: [3], time: 3, reasons: ['a'] }]
        ])
      })
    }
  })

  test('removes reason with zero at maximum added', function (factory) {
    return function () {
      var store = factory()
      return store.add({ }, { id: [1], time: 1, reasons: ['a'] })
        .then(function () {
          return store.removeReason('a', { maxAdded: 0 }, nope)
        })
        .then(function () {
          return checkBoth(store, [
            [{ }, { added: 1, id: [1], time: 1, reasons: ['a'] }]
          ])
        })
    }
  })

  test('returns action by ID', function (factory) {
    return function () {
      var store = factory()
      return Promise.all([
        store.add({ type: 'A' }, { id: [1, 'node', 0], time: 1 }),
        store.add({ type: 'B' }, { id: [1, 'node', 1], time: 2 }),
        store.add({ type: 'C' }, { id: [1, 'node', 2], time: 2 }),
        store.add({ type: 'D' }, { id: [1, 'node', 3], time: 2 }),
        store.add({ type: 'E' }, { id: [2, 'node', 0], time: 2 })
      ]).then(function () {
        return store.byId([1, 'node', 0])
      }).then(function (result) {
        assert.deepEqual(result[0], { type: 'A' })
        assert.deepEqual(result[1].time, 1)
        return store.byId([1, 'node', 2])
      }).then(function (result) {
        assert.deepEqual(result[0], { type: 'C' })
        return store.byId([2, 'node', 1])
      }).then(function (result) {
        assert.deepEqual(result[0], null)
        assert.deepEqual(result[1], null)
      })
    }
  })

  test('ignores entries with same ID', function (factory) {
    return function () {
      var store = factory()
      var id = [1, 'a', 1]
      return store.add({ a: 1 }, { id: id, time: 1 }).then(function (meta) {
        assert.deepEqual(meta, { id: id, time: 1, added: 1 })
        return store.add({ a: 2 }, { id: id, time: 2 })
      }).then(function (meta) {
        assert.ok(!meta)
        return checkBoth(store, [
          [{ a: 1 }, { id: id, time: 1, added: 1 }]
        ])
      })
    }
  })

  test('stores any metadata', function (factory) {
    return function () {
      var store = factory()
      return store.add(
        { type: 'A' },
        { id: [1, 'a'], time: 1, test: 1 }
      ).then(function () {
        return checkBoth(store, [
          [{ type: 'A' }, { added: 1, id: [1, 'a'], time: 1, test: 1 }]
        ])
      })
    }
  })

  test('sorts actions with same time', function (factory) {
    return function () {
      var store = factory()
      return Promise.all([
        store.add({ type: 'B' }, { id: [2, 'a', 0], time: 1 }),
        store.add({ type: 'C' }, { id: [3, 'a', 0], time: 1 }),
        store.add({ type: 'A' }, { id: [1, 'a', 0], time: 1 })
      ]).then(function () {
        return check(store, 'created', [
          [{ type: 'A' }, { added: 3, id: [1, 'a', 0], time: 1 }],
          [{ type: 'B' }, { added: 1, id: [2, 'a', 0], time: 1 }],
          [{ type: 'C' }, { added: 2, id: [3, 'a', 0], time: 1 }]
        ])
      })
    }
  })
}

module.exports = eachStoreCheck

/**
 * @callback creator
 * @param {string} name The test name.
 * @param {creator} generator The test creator.
 */

/**
 * @callback generator
 * @param {Store} store The store instance.
 * @return {function} The test function to be used in test framework.
 */
