import { BaseNode } from '../base-node/index.js'

const DEFAULT_OPTIONS = {
  fixTime: true,
  ping: 10000,
  timeout: 70000
}

export class ClientNode extends BaseNode {
  constructor(nodeId, log, connection, options = {}) {
    super(nodeId, log, connection, {
      ...options,
      fixTime: options.fixTime ?? DEFAULT_OPTIONS.fixTime,
      ping: options.ping ?? DEFAULT_OPTIONS.ping,
      timeout: options.timeout ?? DEFAULT_OPTIONS.timeout
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
