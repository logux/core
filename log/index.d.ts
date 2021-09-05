import { Unsubscribe, Emitter } from 'nanoevents'

/**
 * Action unique ID accross all nodes.
 *
 * ```js
 * "1564508138460 380:R7BNGAP5:px3-J3oc 0"
 * ```
 */
export type ID = string

interface PreaddListener<ListenerAction extends Action, LogMeta extends Meta> {
  (action: ListenerAction, meta: LogMeta): void
}

interface ReadonlyListener<
  ListenerAction extends Action,
  LogMeta extends Meta
> {
  (action: ListenerAction, meta: LogMeta): void
}

interface ActionIterator<LogMeta extends Meta> {
  (action: Action, meta: Readonly<LogMeta>): boolean | void
}

export function actionEvents(
  emitter: Emitter,
  event: 'preadd' | 'add' | 'clean',
  action: Action,
  meta: Meta
): void

export interface Meta {
  /**
   * Sequence number of action in current log. Log fills it.
   */
  added: number

  /**
   * Action created time in current node time. Milliseconds since UNIX epoch.
   */
  time: number

  /**
   * Action unique ID. Log sets it automatically.
   */
  id: ID

  /**
   * Why action should be kept in log. Action without reasons will be removed.
   */
  reasons: string[]

  /**
   * Set code as reason and remove this reasons from previous actions.
   */
  subprotocol?: string

  /**
   * Set value to `reasons` and this reason from old action.
   */
  keepLast?: string

  /**
   * Indexes for action quick extraction.
   */
  indexes?: string[]

  [extra: string]: any
}

export interface Action {
  /**
   * Action type name.
   */
  type: string
}

export interface AnyAction {
  type: string
  [extra: string]: any
}

interface Criteria {
  /**
   * Remove reason only for actions with bigger `added`.
   */
  minAdded?: number

  /**
   * Remove reason only for actions with lower `added`.
   */
  maxAdded?: number

  /**
   * Remove reason only older than specific action.
   */
  olderThan?: Meta

  /**
   * Remove reason only younger than specific action.
   */
  youngerThan?: Meta

  /**
   * Remove reason only for action with `id`.
   */
  id?: ID
}

interface LastSynced {
  /**
   * The `added` value of latest received event.
   */
  received: number

  /**
   * The `added` value of latest sent event.
   */
  sent: number
}

export interface LogPage {
  /**
   * Pagination page.
   */
  entries: [Action, Meta][]

  /**
   * Next page loader.
   */
  next?(): Promise<LogPage>
}

interface GetOptions {
  /**
   * Sort entries by created time or when they was added to current log.
   */
  order?: 'created' | 'added'

  /**
   * Get entries with a custom index.
   */
  index?: string
}

/**
 *  Every Store class should provide 8 standard methods.
 */
export abstract class LogStore {
  /**
   * Add action to store. Action always will have `type` property.
   *
   * @param action The action to add.
   * @param meta Action’s metadata.
   * @returns Promise with `meta` for new action or `false` if action with
   *          same `meta.id` was already in store.
   */
  add(action: AnyAction, meta: Meta): Promise<Meta | false>

  /**
   * Return a Promise with first page. Page object has `entries` property
   * with part of actions and `next` property with function to load next page.
   * If it was a last page, `next` property should be empty.
   *
   * This tricky API is used, because log could be very big. So we need
   * pagination to keep them in memory.
   *
   * @param opts Query options.
   * @returns Promise with first page.
   */
  get(opts?: GetOptions): Promise<LogPage>

  /**
   * Remove action from store.
   *
   * @param id Action ID.
   * @returns Promise with entry if action was in store.
   */
  remove(id: ID): Promise<[Action, Meta] | false>

  /**
   * Change action metadata.
   *
   * @param id Action ID.
   * @param diff Object with values to change in action metadata.
   * @returns Promise with `true` if metadata was changed or `false`
   *          on unknown ID.
   */
  changeMeta(id: ID, diff: Partial<Meta>): Promise<boolean>

  /**
   * Return action by action ID.
   *
   * @param id Action ID.
   * @returns Promise with array of action and metadata.
   */
  byId(id: ID): Promise<[Action, Meta] | [null, null]>

  /**
   * Remove reason from action’s metadata and remove actions without reasons.
   *
   * @param reason The reason name.
   * @param criteria Criteria to select action for reason removing.
   * @param callback Callback for every removed action.
   * @returns Promise when cleaning will be finished.
   */
  removeReason(
    reason: string,
    criteria: Criteria,
    callback: ReadonlyListener<Action, Meta>
  ): Promise<void>

  /**
   * Remove all data from the store.
   *
   * @returns Promise when cleaning will be finished.
   */
  clean(): Promise<void>

  /**
   * Return biggest `added` number in store.
   * All actions in this log have less or same `added` time.
   *
   * @returns Promise with biggest `added` number.
   */
  getLastAdded(): Promise<number>

  /**
   * Get `added` values for latest synchronized received/sent events.
   *
   * @returns Promise with `added` values
   */
  getLastSynced(): Promise<LastSynced>

  /**
   * Set `added` value for latest synchronized received or/and sent events.
   * @param values Object with latest sent or received values.
   * @returns Promise when values will be saved to store.
   */
  setLastSynced(values: LastSynced): Promise<void>
}

interface LogOptions<Store extends LogStore = LogStore> {
  /**
   * Store for log.
   */
  store: Store

  /**
   * Unique current machine name.
   */
  nodeId: string
}

/**
 * Stores actions with time marks. Log is main idea in Logux.
 * In most end-user tools you will work with log and should know log API.
 *
 * ```js
 * import Log from '@logux/core'
 * const log = new Log({
 *   store: new MemoryStore(),
 *   nodeId: 'client:134'
 * })
 *
 * log.on('add', beeper)
 * log.add({ type: 'beep' })
 * ```
 */
export class Log<
  LogMeta extends Meta = Meta,
  Store extends LogStore = LogStore
> {
  /**
   * @param opts Log options.
   */
  constructor(opts: LogOptions<Store>)

  /**
   * Log store.
   */
  store: Store

  /**
   * Unique node ID. It is used in action IDs.
   */
  nodeId: string

  /**
   *
   * Add action to log.
   *
   * It will set `id`, `time` (if they was missed) and `added` property
   * to `meta` and call all listeners.
   *
   * ```js
   * removeButton.addEventListener('click', () => {
   *   log.add({ type: 'users:remove', user: id })
   * })
   * ```
   *
   * @param action The new action.
   * @param meta Open structure for action metadata.
   * @returns Promise with `meta` if action was added to log or `false`
   *          if action was already in log.
   */
  add<NewAction extends Action = AnyAction>(
    action: NewAction,
    meta?: Partial<LogMeta>
  ): Promise<LogMeta | false>

  /**
   * Add listener for adding action with specific type.
   * Works faster than `on('add', cb)` with `if`.
   *
   * Setting `opts.id` will filter events ponly from actions with specific
   * `action.id`.
   *
   * ```js
   * const unbind = log.type('beep', (action, meta) => {
   *   beep()
   * })
   * function disableBeeps () {
   *   unbind()
   * }
   * ```
   *
   * @param type Action’s type.
   * @param listener The listener function.
   * @param event
   * @returns Unbind listener from event.
   */
  type<
    NewAction extends Action = Action,
    Type extends string = NewAction['type']
  >(
    type: Type,
    listener: ReadonlyListener<NewAction, LogMeta>,
    opts?: { id?: string; event?: 'add' | 'clean' }
  ): Unsubscribe
  type<
    NewAction extends Action = Action,
    Type extends string = NewAction['type']
  >(
    type: Type,
    listener: PreaddListener<NewAction, LogMeta>,
    opts: { id?: string; event: 'preadd' }
  ): Unsubscribe

  /**
   * Subscribe for log events. It implements nanoevents API. Supported events:
   *
   * * `preadd`: when somebody try to add action to log.
   *   It fires before ID check. The best place to add reason.
   * * `add`: when new action was added to log.
   * * `clean`: when action was cleaned from store.
   *
   * Note, that `Log#type()` will work faster than `on` event with `if`.
   *
   * ```js
   * log.on('preadd', (action, meta) => {
   *   if (action.type === 'beep') {
   *     meta.reasons.push('test')
   *   }
   * })
   * ```
   *
   * @param event The event name.
   * @param listener The listener function.
   * @returns Unbind listener from event.
   */
  on(
    event: 'add' | 'clean',
    listener: ReadonlyListener<Action, LogMeta>
  ): Unsubscribe
  on(event: 'preadd', listener: PreaddListener<Action, LogMeta>): Unsubscribe

  /**
   * Generate next unique action ID.
   *
   * ```js
   * const id = log.generateId()
   * ```
   *
   * @returns Unique ID for action.
   */
  generateId(): ID

  /**
   * Iterates through all actions, from last to first.
   *
   * Return false from callback if you want to stop iteration.
   *
   * ```js
   * log.each((action, meta) => {
   *   if (compareTime(meta.id, lastBeep) <= 0) {
   *     return false;
   *   } else if (action.type === 'beep') {
   *     beep()
   *     lastBeep = meta.id
   *     return false;
   *   }
   * })
   * ```
   *
   * @param callback Function will be executed on every action.
   * @returns When iteration will be finished by iterator or end of actions.
   */
  each(callback: ActionIterator<LogMeta>): Promise<void>

  /**
   * @param opts Iterator options.
   * @param callback Function will be executed on every action.
   */
  each(opts: GetOptions, callback: ActionIterator<LogMeta>): Promise<void>
  each(callback: ActionIterator<LogMeta>): Promise<void>

  /**
   * Change action metadata. You will remove action by setting `reasons: []`.
   *
   * ```js
   * await process(action)
   * log.changeMeta(action, { status: 'processed' })
   * ```
   *
   * @param id Action ID.
   * @param diff Object with values to change in action metadata.
   * @returns Promise with `true` if metadata was changed or `false`
   *          on unknown ID.
   */
  changeMeta(id: ID, diff: Partial<LogMeta>): Promise<boolean>

  /**
   * Remove reason tag from action’s metadata and remove actions without reason
   * from log.
   *
   * ```js
   * onSync(lastSent) {
   *   log.removeReason('unsynchronized', { maxAdded: lastSent })
   * }
   * ```
   *
   * @param reason The reason name.
   * @param criteria Criteria to select action for reason removing.
   * @returns Promise when cleaning will be finished.
   */
  removeReason(reason: string, criteria?: Criteria): Promise<void>

  /**
   * Does log already has action with this ID.
   *
   * ```js
   * if (action.type === 'logux/undo') {
   *   const [undidAction, undidMeta] = await log.byId(action.id)
   *   log.changeMeta(meta.id, { reasons: undidMeta.reasons })
   * }
   * ```
   *
   * @param id Action ID.
   * @returns Promise with array of action and metadata.
   */
  byId(id: ID): Promise<[Action, LogMeta] | [null, null]>
}
