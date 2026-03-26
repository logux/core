export class FakeWebSocket {
  binaryType = 'blob'

  constructor(url, protocols, opts) {
    this.opts = opts
    this.sent = []
    setTimeout(() => {
      this.onopen?.()
    }, 1)
  }

  close() {
    this.emit('close')
  }

  emit(name, data) {
    if (name === 'open') {
      if (typeof this.onopen === 'undefined') {
        throw new Error(`No ${name} event listener`)
      } else {
        this.onopen()
      }
    } else if (name === 'message') {
      if (typeof this.onmessage === 'undefined') {
        throw new Error(`No ${name} event listener`)
      } else {
        this.onmessage({ data })
      }
    } else if (name === 'error') {
      if (typeof this.onerror === 'undefined') {
        throw new Error(`No ${name} event listener`)
      } else {
        this.onerror({ error: data })
      }
    } else if (name === 'close') {
      if (typeof this.onclose !== 'undefined') {
        this.onclose()
      }
    }
  }

  send(msg) {
    this.sent.push(msg)
  }
}
