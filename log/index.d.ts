import type { Emitter, Unsubscribe } from 'nanoevents'

/**
 * Encode number to `-0-9A-Z_a-z` alphabet.
 *
 * Chars are in ASCII order, so strings of the same length have the same
 * order as encoded numbers.
 *
 * ```js
 * toCompat(64) //=> "0-"
 * ```
 *
 * @param number Number to encode.
 * @returns Encoded number.
 */
export function toCompat(number: number): string

/**
 * Decode number from `-0-9A-Z_a-z` alphabet.
 *
 * ```js
 * fromCompat('OzcVoWD') //=> 1786312345678
 * ```
 *
 * @param str Encoded number.
 * @returns Decoded number.
 */
export function fromCompat(str: string): number

/**
 * Decode `meta.time` from action ID.
 *
 * ```js
 * idToTime('OzcVoWD client:1') //=> 1786312345678
 * ```
 *
 * @param id Action ID or its time part.
 * @returns Milliseconds since UNIX epoch.
 */
export function idToTime(id: ID): number

/**
 * Convert metadata to a string with the same order as `isFirstOlder()`.
 *
 * Numbers are padded, so simple string sorting (for instance, in a database
 * column) will return actions in the log order.
 *
 * ```js
 * db.insert({ action, sorted: toSorted(meta) })
 * // SELECT * FROM actions ORDER BY sorted
 * ```
 *
 * @param meta Action’s metadata.
 * @returns String to sort actions.
 */
export function toSorted(meta: MetaTime): string

/**
 * Convert string created by `toSorted()` back to metadata.
 *
 * ```js
 * sortedToMeta('------Ec test ------Ec') //=> { id: 'Ec test', time: 1000 }
 * ```
 *
 * @param sorted String created by `toSorted()`.
 * @returns Action’s metadata with `id` and `time` keys.
 */
export function sortedToMeta(sorted: string): MetaTime

/**
 * Action unique ID across all nodes.
 *
 * ```js
 * "OzcVoWD 380:R7BNGA:1"
 * ```
 */
export type ID = string

interface PreaddListener<ListenerAction extends Action, LogMeta extends Meta> {
  (action: ListenerAction, meta: LogMeta): void
}

export interface ReadonlyListener<
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
  event: 'add' | 'clean' | 'preadd',
  action: Action,
  meta: Meta
): void

export interface Meta {
  [extra: string]: unknown

  /**
   * Sequence number of action in current log. Log fills it.
   */
  added: number

  /**
   * Action unique ID. Log sets it automatically.
   */
  id: ID

  /**
   * Indexes for action quick extraction.
   */
  indexes?: string[]

  /**
   * Set value to `reasons` and this reason from old action.
   */
  keepLast?: string

  /**
   * Why action should be kept in log. Action without reasons will be removed.
   */
  reasons: string[]

  /**
   * Application subprotocol version.
   */
  subprotocol?: number

  /**
   * Action created time in current node time. Milliseconds since UNIX epoch.
   *
   * Log could move the action a few milliseconds to the future to keep
   * actions of the same node in the log order.
   */
  time: number
}

export type MetaTime = Pick<Meta, 'time' | 'id'>

export interface Action {
  /**
   * Action type name.
   */
  type: string
}

export interface AnyAction {
  [extra: string]: unknown
  type: string
}

export interface Criteria {
  /**
   * Change reasons only for action with `id`.
   */
  id?: ID

  /**
   * Change reasons only for actions with these IDs.
   */
  ids?: ID[]

  /**
   * Change reasons only for actions with this index in `meta.indexes`.
   *
   * Store will use the index instead of scanning the whole log.
   */
  index?: string

  /**
   * Do not change reasons for actions with this index in `meta.indexes`.
   */
  exceptIndex?: string

  /**
   * Change reasons only for actions with lower `added`.
   */
  maxAdded?: number

  /**
   * Change reasons only for actions with bigger `added`.
   */
  minAdded?: number

  /**
   * Change reasons only for actions older than specific action.
   */
  olderThan?: Meta

  /**
   * Change reasons only for actions younger than specific action.
   */
  youngerThan?: Meta
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
   * Get entries with a custom index.
   */
  index?: string

  /**
   * Sort entries by created time or when they was added to current log.
   */
  order?: 'added' | 'created'

  /**
   * Get only entries with this reason.
   */
  reason?: string
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
  add(action: AnyAction, meta: Meta): Promise<false | Meta>

  /**
   * Add reasons to metadata of actions, which are already in the store.
   *
   * Reasons, which action already has, should not be duplicated.
   *
   * @param reasons The reason names.
   * @param criteria Criteria to select actions for reason adding.
   * @returns Promise when adding will be finished.
   */
  addReason(reasons: string[], criteria: Criteria): Promise<void>

  /**
   * Return action by action ID.
   *
   * @param id Action ID.
   * @returns Promise with array of action and metadata.
   */
  byId(id: ID): Promise<[Action, Meta] | [null, null]>

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
   * Remove all data from the store.
   *
   * @returns Promise when cleaning will be finished.
   */
  clean(): Promise<void>

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
   * Remove action from store.
   *
   * @param id Action ID.
   * @returns Promise with entry if action was in store.
   */
  remove(id: ID): Promise<[Action, Meta] | false>

  /**
   * Remove reasons from action’s metadata and remove actions without reasons.
   *
   * @param reasons The reason names.
   * @param criteria Criteria to select actions for reason removing.
   * @param callback Callback for every removed action.
   * @returns Promise when cleaning will be finished.
   */
  removeReason(
    reasons: string[],
    criteria: Criteria,
    callback: ReadonlyListener<Action, Meta>
  ): Promise<void>

  /**
   * Set `added` value for latest synchronized received or/and sent events.
   * @param values Object with latest sent or received values.
   * @returns Promise when values will be saved to store.
   */
  setLastSynced(values: Partial<LastSynced>): Promise<void>
}

interface LogOptions<Store extends LogStore = LogStore> {
  /**
   * Unique current machine name.
   */
  nodeId: string

  /**
   * Store for log.
   */
  store: Store
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
   * Unique node ID. It is used in action IDs.
   */
  nodeId: string

  /**
   * Log store.
   */
  store: Store

  /**
   * @param opts Log options.
   */
  constructor(opts: LogOptions<Store>)

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
  ): Promise<false | LogMeta>
  add(entries: [AnyAction, Partial<LogMeta>?][]): Promise<(false | LogMeta)[]>

  /**
   * Add reason tags to metadata of actions, which are already in the log. Reasons, which action already has, will not be duplicated.
   *
   * ```js
   * // The action still owns these cells, so it should keep their reasons
   * log.addReason('last-value', { id: meta.id })
   * ```
   *
   * @param reasons The reason name or names.
   * @param criteria Criteria to select actions for reason adding.
   * @returns Promise when adding will be finished.
   */
  addReason(reasons: string[] | string, criteria?: Criteria): Promise<void>

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
   * @param opts Iterator options.
   * @param callback Function will be executed on every action.
   */
  each(opts: GetOptions, callback: ActionIterator<LogMeta>): Promise<void>
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
  each(callback: ActionIterator<LogMeta>): Promise<void>

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
   * Current time of this node. Log uses it for `meta.time` and action ID.
   *
   * Redefine it to use a custom clock, for instance, in tests.
   *
   * ```js
   * log.now = () => fakeTime
   * ```
   *
   * @returns Milliseconds since UNIX epoch.
   */
  now(): number

  /**
   * Subscribe for log events. It implements nanoevents API. Supported events:
   *
   * * `preadd`: when somebody try to add action to log.
   *   It fires before ID check. The best place to add reason.
   * * `add`: when new action was added to log.
   * * `clean`: when action was cleaned from store.
   * * `batch`: when actions from a single `Log#add()` call were added.
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
  on(
    event: 'batch',
    listener: (entries: [Action, LogMeta][]) => void
  ): Unsubscribe

  /**
   * Remove reason tags from actions’ metadata and remove actions without
   * reasons from log.
   *
   * ```js
   * onSync(lastSent) {
   *   log.removeReason('unsynchronized', { maxAdded: lastSent })
   * }
   * ```
   *
   * @param reasons The reason name or names.
   * @param criteria Criteria to select actions for reason removing.
   * @returns Promise when cleaning will be finished.
   */
  removeReason(reasons: string[] | string, criteria?: Criteria): Promise<void>

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
  type<NewAction extends Action = Action>(
    type: NewAction['type'],
    listener: ReadonlyListener<NewAction, LogMeta>,
    opts?: { event?: 'add' | 'clean'; id?: string }
  ): Unsubscribe
  type<NewAction extends Action = Action>(
    type: NewAction['type'],
    listener: PreaddListener<NewAction, LogMeta>,
    opts: { event: 'preadd'; id?: string }
  ): Unsubscribe
}
