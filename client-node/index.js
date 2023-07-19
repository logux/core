import { BaseNode } from '../base-node/index.js'

const DEFAULT_OPTIONS = {
  fixTime: true,
  timeout: 70000,
  ping: 10000
}

export class ClientNode extends BaseNode {
  constructor(nodeId, log, connection, options = {}) {
    super(nodeId, log, connection, {
      ...options,
      fixTime: options.fixTime ?? DEFAULT_OPTIONS.fixTime,
      timeout: options.timeout ?? DEFAULT_OPTIONS.timeout,
      ping: options.ping ?? DEFAULT_OPTIONS.ping
    })
  }

  onConnect() {
    if (!this.connected) {
      this.connected = true
      this.initializing = this.initializing.then(() => {
        if (this.connected) this.sendConnect()
      })
    }
  }
}
