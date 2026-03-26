import { WsBinaryConnection } from '../ws-binary-connection/index.js'

export class ServerConnection extends WsBinaryConnection {
  constructor(ws) {
    super(undefined, true)
    this.connected = true
    this.init(ws)
  }

  connect() {
    throw new Error(
      'ServerConnection accepts already connected WebSocket ' +
        'instance and could not reconnect it'
    )
  }
}
