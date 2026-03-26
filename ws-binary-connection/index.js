import { WsConnection } from '../ws-connection/index.js'

let encoder = new TextEncoder()
let decoder = new TextDecoder()

function encodeVarint(value) {
  let bytes = []
  do {
    let byte = value & 0x7f
    value = Math.floor(value / 128)
    if (value > 0) byte |= 0x80
    bytes.push(byte)
  } while (value > 0)
  return bytes
}

function decodeVarint(buf, offset) {
  let value = 0
  let multiplier = 1
  while (true) {
    let byte = buf[offset]
    value += (byte & 0x7f) * multiplier
    offset++
    if ((byte & 0x80) === 0) break
    multiplier *= 128
  }
  return [value, offset]
}

function encodeString(str) {
  let bytes = encoder.encode(str)
  return [...encodeVarint(bytes.length), ...bytes]
}

function decodeString(buf, offset) {
  let [length, pos] = decodeVarint(buf, offset)
  let str = decoder.decode(buf.subarray(pos, pos + length))
  return [str, pos + length]
}

function encodeJson(value) {
  return encodeString(value !== undefined ? JSON.stringify(value) : '')
}

function decodeJson(buf, offset) {
  let [str, pos] = decodeString(buf, offset)
  if (str === '') return [undefined, pos]
  return [JSON.parse(str), pos]
}

function decodeActionId(ctx, buf, offset) {
  let type = buf[offset++]
  let [shift, pos] = decodeVarint(buf, offset)
  let timestamp = shift + ctx.baseTime

  // Implicit nodeId, orderInMs = 0
  if (type === 10) {
    return [`${timestamp} ${ctx.remoteNodeId} 0`, pos]
  }

  // Implicit nodeId
  if (type === 11) {
    let [order, end] = decodeVarint(buf, pos)
    return [`${timestamp} ${ctx.remoteNodeId} ${order}`, end]
  }

  // Explicit nodeId
  if (type === 12) {
    let [nodeId, pos2] = decodeString(buf, pos)
    let [order, end] = decodeVarint(buf, pos2)
    return [`${timestamp} ${nodeId} ${order}`, end]
  /* node:coverage ignore next 3 */
  }

  throw new Error('Unknown action ID type: ' + type)
}

function decodeMeta(buf, offset) {
  let fieldCount = buf[offset++]
  let [time, pos] = decodeVarint(buf, offset)
  let [shift, pos2] = decodeVarint(buf, pos)

  let meta = { time }

  // time, shift
  if (fieldCount === 2) {
    meta.id = shift
    return [meta, pos2]
  }

  // time, shift, orderInMs
  if (fieldCount === 3) {
    let [order, end] = decodeVarint(buf, pos2)
    meta.id = [shift, order]
    return [meta, end]
  }

  // time, shift, orderInMs, subprotocol
  if (fieldCount === 4) {
    let [order, pos3] = decodeVarint(buf, pos2)
    let [subprotocol, end] = decodeVarint(buf, pos3)
    meta.id = [shift, order]
    meta.subprotocol = subprotocol
    return [meta, end]
  }

  // time, shift, nodeId, orderInMs, subprotocol
  if (fieldCount === 5) {
    let [nodeId, pos3] = decodeString(buf, pos2)
    let [order, pos4] = decodeVarint(buf, pos3)
    let [subprotocol, end] = decodeVarint(buf, pos4)
    meta.id = [shift, nodeId, order]
    meta.subprotocol = subprotocol
    return [meta, end]
  /* node:coverage ignore next 3 */
  }

  throw new Error('Unknown meta field count: ' + fieldCount)
}

function decodeAction(ctx, buf, offset) {
  let type = buf[offset++]

  // 'j' — JSON action
  if (type === 0x6a) {
    let [length, pos] = decodeVarint(buf, offset)
    let json = decoder.decode(buf.subarray(pos, pos + length))
    let action = JSON.parse(json)
    let [meta, end] = decodeMeta(buf, pos + length)
    return [action, meta, end]
  }

  // 'p' — logux/processed
  if (type === 0x70) {
    let [id, pos] = decodeActionId(ctx, buf, offset)
    let [meta, end] = decodeMeta(buf, pos)
    return [{ id, type: 'logux/processed' }, meta, end]
  }

  // 'Z' — encrypted with compression, 'z' — encrypted without
  if (type === 0x5a || type === 0x7a) {
    let iv = new Uint8Array(buf.buffer, buf.byteOffset + offset, 12)
    offset += 12
    let [length, pos] = decodeVarint(buf, offset)
    let d = new Uint8Array(buf.buffer, buf.byteOffset + pos, length)
    let action = {
      d: new Uint8Array(d),
      iv: new Uint8Array(iv),
      type: '0'
    }
    if (type === 0x5a) action.compressed = true
    let [meta, end] = decodeMeta(buf, pos + length)
    return [action, meta, end]
  }

  // 'c' — 0/clean
  if (type === 0x63) {
    let [id, pos] = decodeActionId(ctx, buf, offset)
    let [meta, end] = decodeMeta(buf, pos)
    return [{ id, type: '0/clean' }, meta, end]
  /* node:coverage ignore next 3 */
  }

  throw new Error('Unknown action type: ' + type)
}

function decodeMessage(ctx, buf) {
  let type = buf[0]
  let offset = 1

  // 'e' — error
  if (type === 0x65) {
    let [errorType, pos] = decodeString(buf, offset)
    let [options] = decodeJson(buf, pos)
    let msg = ['error', errorType]
    if (options !== undefined) msg.push(options)
    return msg
  }

  // 'h' — headers
  if (type === 0x68) {
    let [data] = decodeJson(buf, offset)
    return ['headers', data]
  }

  // 'c' — connect
  if (type === 0x63) {
    let [protocol, pos] = decodeVarint(buf, offset)
    let [nodeId, pos2] = decodeString(buf, pos)
    let [synced, pos3] = decodeVarint(buf, pos2)
    let [subprotocol, pos4] = decodeVarint(buf, pos3)
    let [jsonOpts] = decodeJson(buf, pos4)
    let options = jsonOpts || {}
    if (subprotocol) options.subprotocol = subprotocol
    let msg = ['connect', protocol, nodeId, synced]
    if (Object.keys(options).length > 0) msg.push(options)
    return msg
  }

  // 'C' — connected
  if (type === 0x43) {
    let [protocol, pos] = decodeVarint(buf, offset)
    let [nodeId, pos2] = decodeString(buf, pos)
    let [start, pos3] = decodeVarint(buf, pos2)
    let [end, pos4] = decodeVarint(buf, pos3)
    let [subprotocol, pos5] = decodeVarint(buf, pos4)
    let [jsonOpts] = decodeJson(buf, pos5)
    let options = jsonOpts || {}
    if (subprotocol) options.subprotocol = subprotocol
    let msg = ['connected', protocol, nodeId, [start, end]]
    if (Object.keys(options).length > 0) msg.push(options)
    return msg
  }

  // 'p' — ping
  if (type === 0x70) {
    let [synced] = decodeVarint(buf, offset)
    return ['ping', synced]
  }

  // 'P' — pong
  if (type === 0x50) {
    let [synced] = decodeVarint(buf, offset)
    return ['pong', synced]
  }

  // 's' — sync
  if (type === 0x73) {
    let [synced, pos] = decodeVarint(buf, offset)
    let [count, pos2] = decodeVarint(buf, pos)
    let msg = ['sync', synced]
    for (let i = 0; i < count; i++) {
      let [action, meta, end] = decodeAction(ctx, buf, pos2)
      msg.push(action, meta)
      pos2 = end
    }
    return msg
  }

  // 'S' — synced
  if (type === 0x53) {
    let [synced] = decodeVarint(buf, offset)
    return ['synced', synced]
  }

  // 'd' — debug
  if (type === 0x64) {
    let [debugType, pos] = decodeString(buf, offset)
    let [data] = decodeJson(buf, pos)
    return ['debug', debugType, data]
  }

  throw new Error('Unknown message type: ' + type)
}

function encodeActionId(ctx, id) {
  let parts = id.split(' ')
  let shift = parseInt(parts[0]) - ctx.baseTime
  let nodeId = parts[1]
  let counter = parseInt(parts[2])

  if (nodeId === ctx.localNodeId) {
    if (counter === 0) {
      return [10, ...encodeVarint(shift)] // Implicit nodeId, orderInMs = 0
    }
    return [11, ...encodeVarint(shift), ...encodeVarint(counter)] // Implicit nodeId
  }

  return [
    12, // Explicit nodeId
    ...encodeVarint(shift),
    ...encodeString(nodeId),
    ...encodeVarint(counter)
  ]
}

function encodeMeta(ctx, meta) {
  let nodeId, orderInMs, shift

  if (typeof meta.id === 'number') {
    shift = meta.id
    orderInMs = 0
    nodeId = null
  } else if (meta.id.length === 2) {
    shift = meta.id[0]
    orderInMs = meta.id[1]
    nodeId = null
  } else {
    shift = meta.id[0]
    nodeId = meta.id[1]
    orderInMs = meta.id[2]
  }

  let hasSubprotocol =
    meta.subprotocol !== undefined &&
    meta.subprotocol !== ctx.connectedSubprotocol

  if (nodeId !== null) {
    return [
      5, // time, shift, nodeId, orderInMs, subprotocol
      ...encodeVarint(meta.time),
      ...encodeVarint(shift),
      ...encodeString(nodeId),
      ...encodeVarint(orderInMs),
      ...encodeVarint(
        meta.subprotocol !== undefined
          ? meta.subprotocol
          : ctx.connectedSubprotocol
      )
    ]
  }

  if (hasSubprotocol) {
    return [
      4, // time, shift, orderInMs, subprotocol
      ...encodeVarint(meta.time),
      ...encodeVarint(shift),
      ...encodeVarint(orderInMs),
      ...encodeVarint(meta.subprotocol)
    ]
  }

  if (orderInMs !== 0) {
    return [
      3, // time, shift, orderInMs
      ...encodeVarint(meta.time),
      ...encodeVarint(shift),
      ...encodeVarint(orderInMs)
    ]
  }

  return [
    2, // time, shift
    ...encodeVarint(meta.time),
    ...encodeVarint(shift)
  ]
}

function encodeAction(ctx, action, meta) {
  // 'p' — logux/processed
  if (action.type === 'logux/processed') {
    return [0x70, ...encodeActionId(ctx, action.id), ...encodeMeta(ctx, meta)]
  }

  // 'c' — 0/clean
  if (action.type === '0/clean') {
    return [0x63, ...encodeActionId(ctx, action.id), ...encodeMeta(ctx, meta)]
  }

  // 'Z' or 'z' — encrypted 0 action
  if (action.type === '0' && action.iv instanceof Uint8Array) {
    let typeByte = action.compressed ? 0x5a : 0x7a
    return [
      typeByte,
      ...action.iv,
      ...encodeVarint(action.d.length),
      ...action.d,
      ...encodeMeta(ctx, meta)
    ]
  }

  // 'j' — JSON action (default)
  let jsonBytes = encoder.encode(JSON.stringify(action))
  return [
    0x6a,
    ...encodeVarint(jsonBytes.length),
    ...jsonBytes,
    ...encodeMeta(ctx, meta)
  ]
}

function encodeMessage(ctx, message) {
  let type = message[0]
  let bytes

  switch (type) {
    case 'connect': {
      let options = message[4] || {}
      let { subprotocol, ...rest } = options
      bytes = [
        0x63, // 'c'
        ...encodeVarint(message[1]),
        ...encodeString(message[2]),
        ...encodeVarint(message[3]),
        ...encodeVarint(subprotocol || 0),
        ...encodeJson(Object.keys(rest).length > 0 ? rest : undefined)
      ]
      break
    }
    case 'connected': {
      let options = message[4] || {}
      let { subprotocol, ...rest } = options
      bytes = [
        0x43, // 'C'
        ...encodeVarint(message[1]),
        ...encodeString(message[2]),
        ...encodeVarint(message[3][0]),
        ...encodeVarint(message[3][1]),
        ...encodeVarint(subprotocol || 0),
        ...encodeJson(Object.keys(rest).length > 0 ? rest : undefined)
      ]
      break
    }
    case 'debug': {
      bytes = [
        0x64, // 'd'
        ...encodeString(message[1]),
        ...encodeJson(message[2])
      ]
      break
    }
    case 'error': {
      bytes = [
        0x65, // 'e'
        ...encodeString(message[1]),
        ...encodeJson(message[2])
      ]
      break
    }
    case 'headers': {
      bytes = [
        0x68, // 'h'
        ...encodeJson(message[1])
      ]
      break
    }
    case 'ping': {
      bytes = [0x70 /* 'p' */, ...encodeVarint(message[1])]
      break
    }
    case 'pong': {
      bytes = [0x50 /* 'P' */, ...encodeVarint(message[1])]
      break
    }
    case 'sync': {
      let actionCount = (message.length - 2) / 2
      bytes = [
        0x73, // 's'
        ...encodeVarint(message[1]),
        ...encodeVarint(actionCount)
      ]
      for (let i = 2; i < message.length; i += 2) {
        bytes.push(...encodeAction(ctx, message[i], message[i + 1]))
      }
      break
    }
    case 'synced': {
      bytes = [0x53 /* 'S' */, ...encodeVarint(message[1])]
      break
    }
    /* node:coverage ignore next 2 */
    default:
      throw new Error('Unknown message type: ' + type)
  }

  return new Uint8Array(bytes)
}

function trackMessage(ctx, message, outgoing) {
  let type = message[0]
  if (type === 'connect') {
    if (outgoing) {
      ctx.localNodeId = message[2]
    } else {
      ctx.remoteNodeId = message[2]
    }
  } else if (type === 'connected') {
    if (outgoing) {
      ctx.localNodeId = message[2]
      ctx.baseTime = message[3][1]
    } else {
      ctx.remoteNodeId = message[2]
      ctx.baseTime = message[3][1]
    }
    let options = message[4] || {}
    ctx.connectedSubprotocol = options.subprotocol || 0
  }
}

export class WsBinaryConnection extends WsConnection {
  constructor(url, Class, opts) {
    super(url, Class, opts)
    this.baseTime = 0
    this.localNodeId = undefined
    this.remoteNodeId = undefined
    this.connectedSubprotocol = 0
    this.textMode = false
  }

  init(ws) {
    super.init(ws)
    ws.binaryType = 'arraybuffer'
    ws.onmessage = event => {
      let data = event.data
      try {
        let message
        if (typeof data === 'string') {
          this.textMode = true
          message = JSON.parse(data)
        } else {
          let buf = new Uint8Array(data)
          if (buf[0] === 0x5b) {
            // '[' — text protocol in binary frame
            this.textMode = true
            message = JSON.parse(decoder.decode(buf))
          } else {
            this.textMode = false
            message = decodeMessage(this, buf)
          }
        }
        trackMessage(this, message, false)
        this.emitter.emit('message', message)
      } catch {
        if (typeof data === 'string') {
          this.error(data)
        } else {
          let hex = Array.from(new Uint8Array(data).subarray(0, 20), b => {
            return b.toString(16).padStart(2, '0')
          }).join(' ')
          this.error(hex)
        }
      }
    }
  }

  send(message) {
    if (this.ws && this.ws.readyState === this.ws.OPEN) {
      trackMessage(this, message, true)
      if (this.textMode) {
        this.ws.send(JSON.stringify(message))
      } else {
        this.ws.send(encodeMessage(this, message))
      }
    } else {
      this.emitter.emit('error', new Error('WS was closed'))
    }
  }
}
