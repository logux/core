var BrowserConnection = require('../browser-connection')
var ServerConnection = require('../server-connection')
var isFirstOlder = require('../is-first-older')
var MemoryStore = require('../memory-store')
var ClientSync = require('../client-sync')
var ServerSync = require('../server-sync')
var LocalPair = require('../local-pair')
var SyncError = require('../sync-error')
var Reconnect = require('../reconnect')
var BaseSync = require('../base-sync')
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

it('has BrowserConnection class', function () {
  expect(core.BrowserConnection).toBe(BrowserConnection)
})

it('has ServerConnection class', function () {
  expect(core.ServerConnection).toBe(ServerConnection)
})

it('has ServerSync class', function () {
  expect(core.ServerSync).toBe(ServerSync)
})

it('has ClientSync class', function () {
  expect(core.ClientSync).toBe(ClientSync)
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

it('has BaseSync class', function () {
  expect(core.BaseSync).toBe(BaseSync)
})

it('has TestPair class', function () {
  expect(core.TestPair).toBe(TestPair)
})
