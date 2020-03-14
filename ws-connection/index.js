let { createNanoEvents } = require('nanoevents')

class WsConnection {
  constructor (url, WS, opts) {
    this.connected = false
    this.emitter = createNanoEvents()
    if (WS) {
      this.WS = WS
    } else if (typeof WebSocket !== 'undefined') {
      this.WS = WebSocket
    } else {
      throw new Error('No WebSocket support')
    }
    this.url = url
    this.opts = opts
  }

  init (ws) {
    ws.onerror = event => {
      this.emitter.emit('error', event.error || new Error('WS Error'))
    }

    ws.onclose = () => {
      if (this.ws) {
        this.connected = false
        this.emitter.emit('disconnect')
      }
    }

    ws.onmessage = event => {
      let data
      try {
        data = JSON.parse(event.data)
      } catch (e) {
        this.error(event.data)
        return
      }
      this.emitter.emit('message', data)
    }

    this.ws = ws
  }

  connect () {
    this.emitter.emit('connecting')
    this.init(new this.WS(this.url, undefined, this.opts))

    return new Promise(resolve => {
      this.ws.onopen = () => {
        this.connected = true
        this.emitter.emit('connect')
        resolve()
      }
    })
  }

  disconnect () {
    if (this.ws) {
      this.ws.onclose()
      this.ws.close()
      this.ws = undefined
    }
  }

  on (event, listener) {
    return this.emitter.on(event, listener)
  }

  send (message) {
    if (this.ws && this.ws.readyState === this.ws.OPEN) {
      this.ws.send(JSON.stringify(message))
    } else {
      this.emitter.emit('error', new Error('WS was closed'))
    }
  }

  error (message) {
    let err = new Error('Wrong message format')
    err.received = message
    this.emitter.emit('error', err)
  }
}

module.exports = { WsConnection }
