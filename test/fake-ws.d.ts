export class FakeWebSocket {
  binaryType: string

  onclose?: () => void

  onerror?: (event: object) => void

  onmessage?: (event: object) => void

  onopen?: () => void

  opts: object

  readyState?: number

  sent: (string | Uint8Array)[]

  constructor(url: string, protocols: string, opts: object)

  close(): void

  emit(name: string, data?: ArrayBufferLike | Error | string): void

  send(msg: string | Uint8Array): void
}
