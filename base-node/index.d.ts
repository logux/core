import type { Unsubscribe } from 'nanoevents'

import type { Action, AnyAction, Log, Meta } from '../log/index.js'
import type { LoguxError, LoguxErrorOptions } from '../logux-error/index.js'

interface Authenticator<Headers extends object> {
  (nodeId: string, token: string, headers: {} | Headers): Promise<boolean>
}

export interface ActionFilter {
  (action: Action, meta: Meta): Promise<[Action, Meta] | false>
}

interface EmptyHeaders {
  [key: string]: undefined
}

export interface TokenGenerator {
  (): Promise<string> | string
}

export type NodeState =
  | 'connecting'
  | 'disconnected'
  | 'sending'
  | 'synchronized'

export interface CompressedMeta {
  id: [number, string, number] | number
  time: number
}

export type Message =
  | ['connect', number, string, number, object?]
  | ['connected', number, string, [number, number], object?]
  | ['debug', 'error', string]
  | ['error', keyof LoguxErrorOptions, any?]
  | ['headers', object]
  | ['ping', number]
  | ['pong', number]
  | ['sync', number, ...(AnyAction | CompressedMeta)[]]
  | ['synced', number]

/**
 * Abstract interface for connection to synchronize logs over it.
 * For example, WebSocket or Loopback.
 */
export abstract class Connection {
  /**
   * Is connection is enabled.
   */
  connected: boolean

  /**
   * Disconnect and unbind all even listeners.
   */
  destroy: () => void

  /**
   * Start connection. Connection should be in disconnected state
   * from the beginning and start connection only on this method call.
   *
   * This method could be called again if connection moved
   * to disconnected state.
   *
   * @returns Promise until connection will be established.
   */
  connect(): Promise<void>

  /**
   * Finish current connection.
   *
   * @param reason Disconnection reason.
   */
  disconnect(reason?: 'destroy' | 'error' | 'timeout'): void
  on(event: 'disconnect', listener: (reason: string) => void): Unsubscribe
  on(event: 'error', listener: (error: Error) => void): Unsubscribe

  /**
   * Subscribe for connection events. It implements nanoevents API.
   * Supported events:
   *
   * * `connecting`: connection establishing was started.
   * * `connect`: connection was established by any side.
   * * `disconnect`: connection was closed by any side.
   * * `message`: message was receive from remote node.
   * * `error`: error during connection, sending or receiving.
   *
   * @param event Event name.
   * @param listener Event listener.
   * @returns Unbind listener from event.
   */
  on(
    event: 'connect' | 'connecting' | 'disconnect',
    listener: () => void
  ): Unsubscribe

  on(event: 'message', listener: (msg: Message) => void): Unsubscribe

  /**
   * Send message to connection.
   *
   * @param message The message to be sent.
   */
  send(message: Message): void
}

export interface NodeOptions<Headers extends object = {}> {
  /**
   * Function to check client credentials.
   */
  auth?: Authenticator<Headers>

  /**
   * Detect difference between client and server and fix time
   * in synchronized actions.
   */
  fixTime?: boolean

  /**
   * Function to filter or change actions coming from remote node’s
   * before put it to current log.
   *
   * ```js
   * async nReceive(action, meta) {
   *   if (checkMeta(meta)) {
   *     await [action, cleanMeta(meta)]
   *   } else {
   *     return false
   *   }
   * }
   * ```
   */
  onReceive?: ActionFilter

  /**
   * Function to filter or change actions before sending to remote node’s.
   *
   * ```js
   * async onSend(action, meta) {
   *   if (meta.sync) {
   *     return [action, cleanMeta(meta)]
   *   } else {
   *     return false
   *   }
   * }
   * ```
   */
  onSend?: ActionFilter

  /**
   * Milliseconds since last message to test connection by sending ping.
   */
  ping?: number

  /**
   * Application subprotocol version in SemVer format.
   */
  subprotocol?: string

  /**
   * Timeout in milliseconds to wait answer before disconnect.
   */
  timeout?: number

  /**
   * Client credentials. For example, access token.
   */
  token?: string | TokenGenerator
}

/**
 * Base methods for synchronization nodes. Client and server nodes
 * are based on this module.
 */
export class BaseNode<
  Headers extends object = {},
  NodeLog extends Log = Log<Meta>
> {
  /**
   * Did we finish remote node authentication.
   */
  authenticated: boolean

  /**
   * Is synchronization in process.
   *
   * ```js
   * node.on('disconnect', () => {
   *   node.connected //=> false
   * })
   */
  connected: boolean

  /**
   * Connection used to communicate to remote node.
   */
  connection: Connection

  /**
   * Promise for node data initial loadiging.
   */
  initializing: Promise<void>

  /**
   * Latest remote node’s log `added` time, which was successfully
   * synchronized. It will be saves in log store.
   */
  lastReceived: number

  /**
   * Latest current log `added` time, which was successfully synchronized.
   * It will be saves in log store.
   */
  lastSent: number

  /**
   * Unique current machine name.
   *
   * ```js
   * console.log(node.localNodeId + ' is started')
   * ```
   */
  localNodeId: string

  /**
   * Used Logux protocol.
   *
   * ```js
   * if (tool.node.localProtocol !== 1) {
   *   throw new Error('Unsupported Logux protocol')
   * }
   * ```
   */
  localProtocol: number

  /**
   * Log for synchronization.
   */
  log: NodeLog

  /**
   * Minimum version of Logux protocol, which is supported.
   *
   * ```js
   * console.log(`You need Logux protocol ${node.minProtocol} or higher`)
   * ```
   */
  minProtocol: number

  /**
   * Synchronization options.
   */
  options: NodeOptions<Headers>

  /**
   * Headers set by remote node.
   * By default, it is an empty object.
   *
   * ```js
   * let message = I18N_ERRORS[node.remoteHeaders.language || 'en']
   * node.log.add({ type: 'error', message })
   * ```
   */
  remoteHeaders: EmptyHeaders | Headers

  /**
   * Unique name of remote machine.
   * It is undefined until nodes handshake.
   *
   * ```js
   * console.log('Connected to ' + node.remoteNodeId)
   * ```
   */
  remoteNodeId: string | undefined

  /**
   * Remote node Logux protocol.
   * It is undefined until nodes handshake.
   *
   * ```js
   * if (node.remoteProtocol >= 5) {
   *   useNewAPI()
   * } else {
   *   useOldAPI()
   * }
   * ```
   */
  remoteProtocol: number | undefined

  /**
   * Remote node’s application subprotocol version in SemVer format.
   *
   * It is undefined until nodes handshake. If remote node will not send
   * on handshake its subprotocol, it will be set to `0.0.0`.
   *
   * ```js
   * if (semver.satisfies(node.remoteSubprotocol, '>= 5.0.0') {
   *   useNewAPI()
   * } else {
   *   useOldAPI()
   * }
   * ```
   */
  remoteSubprotocol: string | undefined

  /**
   * Current synchronization state.
   *
   * * `disconnected`: no connection.
   * * `connecting`: connection was started and we wait for node answer.
   * * `sending`: new actions was sent, waiting for answer.
   * * `synchronized`: all actions was synchronized and we keep connection.
   *
   * ```js
   * node.on('state', () => {
   *   if (node.state === 'sending') {
   *     console.log('Do not close browser')
   *   }
   * })
   * ```
   */
  state: NodeState

  /**
   * Time difference between nodes.
   */
  timeFix: number

  /**
   * @param nodeId Unique current machine name.
   * @param log Logux log instance to be synchronized.
   * @param connection Connection to remote node.
   * @param options Synchronization options.
   */
  constructor(
    nodeId: string,
    log: NodeLog,
    connection: Connection,
    options?: NodeOptions<Headers>
  )

  /**
   * Disable throwing a error on error message and create error listener.
   *
   * ```js
   * node.catch(error => {
   *   console.error(error)
   * })
   * ```
   *
   * @param listener The error listener.
   * @returns Unbind listener from event.
   */
  catch(listener: (error: LoguxError) => void): Unsubscribe

  /**
   * Shut down the connection and unsubscribe from log events.
   *
   * ```js
   * connection.on('disconnect', () => {
   *   server.destroy()
   * })
   * ```
   */
  destroy(): void

  on(event: 'headers', listener: (headers: Headers) => void): Unsubscribe

  on(
    event: 'clientError' | 'error',
    listener: (error: LoguxError) => void
  ): Unsubscribe

  /**
   * Subscribe for synchronization events. It implements nanoevents API.
   * Supported events:
   *
   * * `state`: synchronization state was changed.
   * * `connect`: custom check before node authentication. You can throw
   *              a {@link LoguxError} to send error to remote node.
   * * `error`: synchronization error was raised.
   * * `clientError`: when error was sent to remote node.
   * * `debug`: when debug information received from remote node.
   * * `headers`: headers was receive from remote node.
   *
   * ```js
   * node.on('clientError', error => {
   *   logError(error)
   * })
   * ```
   *
   * @param event Event name.
   * @param listener The listener function.
   * @returns Unbind listener from event.
   */
  on(
    event: 'connect' | 'debug' | 'headers' | 'state',
    listener: () => void
  ): Unsubscribe

  on(
    event: 'debug',
    listener: (type: 'error', data: string) => void
  ): Unsubscribe

  /**
   * Set headers for current node.
   *
   * ```js
   * if (navigator) {
   *   node.setLocalHeaders({ language: navigator.language })
   * }
   * node.connection.connect()
   * ```
   *
   * @param headers The data object will be set as headers for current node.
   */
  setLocalHeaders(headers: Headers): void

  /**
   * Return Promise until sync will have specific state.
   *
   * If current state is correct, method will return resolved Promise.
   *
   * ```js
   * await node.waitFor('synchronized')
   * console.log('Everything is synchronized')
   * ```
   *
   * @param state The expected synchronization state value.
   * @returns Promise until specific state.
   */
  waitFor(state: NodeState): Promise<void>
}
