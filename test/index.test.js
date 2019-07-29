let ServerConnection = require('../server-connection')
let isFirstOlder = require('../is-first-older')
let WsConnection = require('../ws-connection')
let MemoryStore = require('../memory-store')
let ClientNode = require('../client-node')
let ServerNode = require('../server-node')
let LoguxError = require('../logux-error')
let LocalPair = require('../local-pair')
let Reconnect = require('../reconnect')
let BaseNode = require('../base-node')
let TestPair = require('../test-pair')
let TestTime = require('../test-time')
let core = require('../')
let Log = require('../log')

it('has compare helper', () => {
  expect(core.isFirstOlder).toBe(isFirstOlder)
})

it('has test time class', () => {
  expect(core.TestTime).toBe(TestTime)
})

it('has memory store class', () => {
  expect(core.MemoryStore).toBe(MemoryStore)
})

it('has log class', () => {
  expect(core.Log).toBe(Log)
})

it('has WsConnection class', () => {
  expect(core.WsConnection).toBe(WsConnection)
})

it('has ServerConnection class', () => {
  expect(core.ServerConnection).toBe(ServerConnection)
})

it('has ServerNode class', () => {
  expect(core.ServerNode).toBe(ServerNode)
})

it('has ClientNode class', () => {
  expect(core.ClientNode).toBe(ClientNode)
})

it('has LocalPair class', () => {
  expect(core.LocalPair).toBe(LocalPair)
})

it('has LoguxError class', () => {
  expect(core.LoguxError).toBe(LoguxError)
})

it('has Reconnect class', () => {
  expect(core.Reconnect).toBe(Reconnect)
})

it('has BaseNode class', () => {
  expect(core.BaseNode).toBe(BaseNode)
})

it('has TestPair class', () => {
  expect(core.TestPair).toBe(TestPair)
})
