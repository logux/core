import { restoreAll, spyOn } from 'nanospy'
import { test } from 'uvu'
import { equal, is, throws } from 'uvu/assert'
import WebSocket from 'ws'

import { type Message, ServerConnection } from '../index.js'

function privateMethods(obj: object): any {
  return obj
}

function prepareWs(): WebSocket {
  let ws = new WebSocket('ws://example.com/')
  privateMethods(ws)._readyState = ws.OPEN
  return ws
}

test.after.each(() => {
  restoreAll()
})

test('throws on connect method call', () => {
  let connection = new ServerConnection(prepareWs())
  throws(() => {
    connection.connect()
  }, /reconnect/)
})

test('emits connection states', () => {
  let connection = new ServerConnection(prepareWs())

  let states: string[] = []
  connection.on('disconnect', () => {
    states.push('disconnect')
  })

  equal(states, [])
  is(connection.connected, true)

  connection.ws.emit('close', 500, 'message')
  equal(states, ['disconnect'])
  is(connection.connected, false)
})

test('emits error on wrong format', () => {
  let connection = new ServerConnection(prepareWs())
  let error: Error | undefined
  connection.on('error', err => {
    error = err
  })

  connection.ws.emit('message', '{')
  if (typeof error === 'undefined') throw new Error('Error was no set')
  equal(error.message, 'Wrong message format')
  equal(privateMethods(error).received, '{')
})

test('closes WebSocket', () => {
  let ws = prepareWs()
  let close = spyOn(ws, 'close', () => {
    ws.emit('close')
  })
  let connection = new ServerConnection(ws)

  connection.disconnect()
  equal(close.callCount, 1)
  is(connection.connected, false)
})

test('receives messages', () => {
  let connection = new ServerConnection(prepareWs())

  let received: Message[] = []
  connection.on('message', msg => {
    received.push(msg)
  })

  connection.ws.emit('message', '["ping",1]')
  equal(received, [['ping', 1]])
})

test('sends messages', () => {
  let sent: string[] = []
  let ws = prepareWs()
  ws.send = (msg: string) => {
    sent.push(msg)
  }
  let connection = new ServerConnection(ws)

  connection.send(['ping', 1])
  equal(sent, ['["ping",1]'])
})

test('does not send to closed socket', () => {
  let sent: string[] = []
  let ws = prepareWs()
  ws.send = (msg: string) => {
    sent.push(msg)
  }

  let connection = new ServerConnection(ws)

  let errors: string[] = []
  connection.on('error', e => {
    errors.push(e.message)
  })

  privateMethods(connection.ws)._readyState = 2

  connection.send(['ping', 1])
  equal(sent, [])
  equal(errors, ['WS was closed'])
})

test.run()
