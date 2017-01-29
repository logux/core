var TestPair = require('../test-pair')

it('tracks events', function () {
  var pair = new TestPair()
  expect(pair.leftEvents).toEqual([])
  expect(pair.rightEvents).toEqual([])

  pair.left.connect()
  return pair.wait().then(function () {
    expect(pair.leftEvents).toEqual([
      ['connect']
    ])
    expect(pair.rightEvents).toEqual([
      ['connect']
    ])

    pair.left.send('test')
    expect(pair.rightEvents).toEqual([
      ['connect']
    ])

    return pair.wait()
  }).then(function () {
    expect(pair.rightEvents).toEqual([
      ['connect'],
      ['message', 'test']
    ])

    pair.left.disconnect()
    expect(pair.leftEvents).toEqual([
      ['connect'],
      ['disconnect']
    ])
    expect(pair.rightEvents).toEqual([
      ['connect'],
      ['message', 'test']
    ])
    return pair.wait()
  }).then(function () {
    expect(pair.rightEvents).toEqual([
      ['connect'],
      ['message', 'test'],
      ['disconnect']
    ])

    pair.right.connect()
    return pair.wait()
  }).then(function () {
    expect(pair.rightEvents).toEqual([
      ['connect'],
      ['message', 'test'],
      ['disconnect'],
      ['connect']
    ])
  })
})

it('tracks messages', function () {
  var pair = new TestPair()
  return pair.left.connect().then(function () {
    pair.right.send('a')
    expect(pair.rightSent).toEqual([])
    expect(pair.leftSent).toEqual([])
    return pair.wait()
  }).then(function () {
    expect(pair.rightSent).toEqual(['a'])
    pair.left.send('b')
    expect(pair.leftSent).toEqual([])
    return pair.wait()
  }).then(function () {
    expect(pair.leftSent).toEqual(['b'])
    expect(pair.rightSent).toEqual(['a'])
  })
})

it('has shortcut for send and wait', function () {
  var pair = new TestPair()
  return pair.left.connect().then(function () {
    return pair.right.sendWait('a')
  }).then(function () {
    expect(pair.rightSent).toEqual(['a'])
    return pair.left.sendWait('b')
  }).then(function () {
    expect(pair.leftSent).toEqual(['b'])
  })
})

it('clears tracked data', function () {
  var pair = new TestPair()
  return pair.left.connect().then(function () {
    pair.left.send('a')
    return pair.wait()
  }).then(function () {
    pair.clear()
    expect(pair.leftSent).toEqual([])
    expect(pair.rightSent).toEqual([])
    expect(pair.leftEvents).toEqual([])
    expect(pair.rightEvents).toEqual([])
  })
})

it('clones messages', function () {
  var pair = new TestPair()
  var msg = { list: [1] }
  return pair.left.connect().then(function () {
    pair.left.send(msg)
    return pair.wait()
  }).then(function () {
    msg.list[0] = 2
    expect(pair.leftSent).toEqual([{ list: [1] }])
    expect(pair.rightEvents).toEqual([
      ['connect'],
      ['message', { list: [1] }]
    ])
  })
})

it('returns self in wait()', function () {
  var pair = new TestPair()
  pair.left.connect().then(function () {
    pair.left.send('test')
    return pair.wait()
  }).then(function (test) {
    expect(test).toBe(pair)
  })
})

it('filters events in wait()', function () {
  var pair = new TestPair()
  pair.left.connect().then(function () {
    pair.left.send('left1')
    pair.right.send('right1')
    return pair.wait()
  }).then(function () {
    expect(pair.rightSent).toEqual([])
    return pair.wait()
  }).then(function () {
    expect(pair.rightSent).toEqual(['right1'])
    pair.left.send('left2')
    pair.right.send('righ2')
    return pair.wait('right')
  }).then(function () {
    expect(pair.rightSent).toEqual(['right1', 'right2'])
  })
})
