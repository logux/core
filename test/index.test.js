var ServerConnection = require('../server-connection')
var isFirstOlder = require('../is-first-older')
var WsConnection = require('../ws-connection')
var MemoryStore = require('../memory-store')
var ClientNode = require('../client-node')
var ServerNode = require('../server-node')
var LocalPair = require('../local-pair')
var SyncError = require('../sync-error')
var Reconnect = require('../reconnect')
var BaseNode = require('../base-node')
var TestPair = require('../test-pair')
var TestTime = require('../test-time')
var core = require('../')
var Log = require('../log')

it('has compare helper', function () {
  expect(core.isFirstOlder).toBe(isFirstOlder)
})

it('has test time class', function () {
  expect(core.TestTime).toBe(TestTime)
})

it('has memory store class', function () {
  expect(core.MemoryStore).toBe(MemoryStore)
})

it('has log class', function () {
  expect(core.Log).toBe(Log)
})

it('has WsConnection class', function () {
  expect(core.WsConnection).toBe(WsConnection)
})

it('has ServerConnection class', function () {
  expect(core.ServerConnection).toBe(ServerConnection)
})

it('has ServerNode class', function () {
  expect(core.ServerNode).toBe(ServerNode)
})

it('has ClientNode class', function () {
  expect(core.ClientNode).toBe(ClientNode)
})

it('has LocalPair class', function () {
  expect(core.LocalPair).toBe(LocalPair)
})

it('has SyncError class', function () {
  expect(core.SyncError).toBe(SyncError)
})

it('has Reconnect class', function () {
  expect(core.Reconnect).toBe(Reconnect)
})

it('has BaseNode class', function () {
  expect(core.BaseNode).toBe(BaseNode)
})

it('has TestPair class', function () {
  expect(core.TestPair).toBe(TestPair)
})
