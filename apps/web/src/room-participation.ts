import {
  AVALON_LOBBY_ERROR_CODES,
  parseAvalonRoomSessionResponse,
  type AvalonLobbyErrorCode,
  type AvalonRoomSessionResponse,
} from '@avalon/game'

import {
  beginSeatTransition,
  clearRoomSessionIfCurrent,
  clearSeatTransitionIfCurrent,
  completeSeatTransition,
  isExactRoomSessionCurrent,
  loadRoomSession,
  loadSeatTransition,
  markSeatTransitionUncertain,
  recoverSeatTransition,
  renewSeatTransitionLease,
  SEAT_TRANSITION_LEASE_MS,
  type RoomSession,
  type RoomSessionStorage,
  type SeatTransition,
  type ValidateSeat,
} from './room-session'
import { getLobbyErrorMessage } from './join-error'

type Fetcher = typeof fetch

export class RoomParticipationHttpError extends Error {
  readonly code: AvalonLobbyErrorCode | null
  readonly status: number

  constructor(status: number, code: AvalonLobbyErrorCode | null = null) {
    super(`HTTP status ${status}`)
    this.name = 'RoomParticipationHttpError'
    this.code = code
    this.status = status
  }
}

export class RoomParticipationResponseContractError extends Error {
  constructor() {
    super('Room participation response is invalid')
    this.name = 'RoomParticipationResponseContractError'
  }
}

export class SeatTransitionPendingError extends Error {
  constructor() {
    super('A seat transition is already pending')
    this.name = 'SeatTransitionPendingError'
  }
}

export class SeatTransitionLockUnavailableError extends Error {
  constructor() {
    super('Browser seat-transition locking is unavailable')
    this.name = 'SeatTransitionLockUnavailableError'
  }
}

export type SeatTransitionLock = <T>(
  matchID: string,
  action: () => Promise<T>,
) => Promise<T | null>

export interface SeatTransitionLeaseRecord {
  matchID: string
  ownerToken: string
  expiresAt: number
}

export interface SeatTransitionLeaseTransaction {
  get: (matchID: string) => Promise<SeatTransitionLeaseRecord | undefined>
  put: (record: SeatTransitionLeaseRecord) => void
  delete: (matchID: string) => void
}

export interface SeatTransitionLeaseDatabase {
  transaction: <T>(
    operation: (transaction: SeatTransitionLeaseTransaction) => Promise<T>,
  ) => Promise<T>
  close: () => void
}

type BrowserLockManager = Pick<LockManager, 'request'>
type OpenSeatTransitionLeaseDatabase = () => Promise<SeatTransitionLeaseDatabase>

interface BrowserSeatTransitionLockOptions {
  lockManager?: BrowserLockManager | null
  openLeaseDatabase?: OpenSeatTransitionLeaseDatabase | null
  now?: () => number
  generateOwnerToken?: () => string
  leaseMs?: number
}

const SEAT_TRANSITION_LOCK_DATABASE = 'avalon-seat-transition-locks'
const SEAT_TRANSITION_LOCK_STORE = 'leases'
const SEAT_TRANSITION_LOCK_LEASE_MS = SEAT_TRANSITION_LEASE_MS

function browserLockManager() {
  return typeof navigator === 'undefined' ? null : navigator.locks ?? null
}

function browserLeaseDatabaseOpener(): OpenSeatTransitionLeaseDatabase | null {
  return typeof indexedDB === 'undefined'
    ? null
    : () => openIndexedDBSeatTransitionLeaseDatabase(indexedDB)
}

function generateSeatTransitionLockOwnerToken() {
  if (typeof globalThis.crypto?.getRandomValues !== 'function') {
    throw new SeatTransitionLockUnavailableError()
  }
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16))
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function isSeatTransitionLeaseRecord(value: unknown): value is SeatTransitionLeaseRecord {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Partial<SeatTransitionLeaseRecord>
  return typeof record.matchID === 'string' && record.matchID.length > 0 &&
    typeof record.ownerToken === 'string' && record.ownerToken.length > 0 &&
    typeof record.expiresAt === 'number' && Number.isFinite(record.expiresAt)
}

function idbRequestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
  })
}

function wrapIndexedDBDatabase(database: IDBDatabase): SeatTransitionLeaseDatabase {
  database.onversionchange = () => database.close()

  return {
    close: () => database.close(),
    transaction: <T>(
      operation: (transaction: SeatTransitionLeaseTransaction) => Promise<T>,
    ) => new Promise<T>((resolve, reject) => {
      const idbTransaction = database.transaction(
        SEAT_TRANSITION_LOCK_STORE,
        'readwrite',
      )
      const objectStore = idbTransaction.objectStore(SEAT_TRANSITION_LOCK_STORE)
      let operationError: unknown
      let operationFinished = false
      let operationResult: T

      const transaction: SeatTransitionLeaseTransaction = {
        delete: (matchID) => { objectStore.delete(matchID) },
        get: async (matchID) => {
          const value: unknown = await idbRequestResult(objectStore.get(matchID))
          if (value === undefined) return undefined
          if (!isSeatTransitionLeaseRecord(value)) {
            throw new Error('IndexedDB seat-transition lease is invalid')
          }
          return value
        },
        put: (record) => { objectStore.put(record) },
      }

      idbTransaction.oncomplete = () => {
        if (!operationFinished) {
          reject(new Error('IndexedDB transaction completed before its operation'))
          return
        }
        resolve(operationResult)
      }
      idbTransaction.onerror = () => {
        reject(operationError ?? idbTransaction.error ?? new Error('IndexedDB transaction failed'))
      }
      idbTransaction.onabort = () => {
        reject(operationError ?? idbTransaction.error ?? new Error('IndexedDB transaction aborted'))
      }

      void operation(transaction).then((result) => {
        operationResult = result
        operationFinished = true
      }, (error: unknown) => {
        operationError = error
        try {
          idbTransaction.abort()
        } catch {
          reject(error)
        }
      })
    }),
  }
}

function openIndexedDBSeatTransitionLeaseDatabase(
  factory: IDBFactory,
): Promise<SeatTransitionLeaseDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(SEAT_TRANSITION_LOCK_DATABASE, 1)
    let rejected = false

    request.onblocked = () => {
      rejected = true
      reject(new Error('IndexedDB seat-transition database is blocked'))
    }
    request.onerror = () => {
      rejected = true
      reject(request.error ?? new Error('IndexedDB seat-transition database failed to open'))
    }
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(SEAT_TRANSITION_LOCK_STORE)) {
        request.result.createObjectStore(SEAT_TRANSITION_LOCK_STORE, { keyPath: 'matchID' })
      }
    }
    request.onsuccess = () => {
      if (rejected) {
        request.result.close()
        return
      }
      resolve(wrapIndexedDBDatabase(request.result))
    }
  })
}

async function withIndexedDBSeatTransitionLock<T>(
  matchID: string,
  action: () => Promise<T>,
  openDatabase: OpenSeatTransitionLeaseDatabase,
  now: () => number,
  generateOwnerToken: () => string,
  leaseMs: number,
): Promise<T | null> {
  let database: SeatTransitionLeaseDatabase
  let ownerToken: string
  try {
    ownerToken = generateOwnerToken()
    database = await openDatabase()
  } catch {
    throw new SeatTransitionLockUnavailableError()
  }

  let acquired: boolean
  try {
    acquired = await database.transaction(async (transaction) => {
      const current = await transaction.get(matchID)
      const acquiredAt = now()
      if (current !== undefined && current.expiresAt > acquiredAt) return false

      transaction.put({
        matchID,
        ownerToken,
        expiresAt: acquiredAt + leaseMs,
      })
      return true
    })
  } catch {
    database.close()
    throw new SeatTransitionLockUnavailableError()
  }

  if (!acquired) {
    database.close()
    return null
  }

  let actionOutcome: { status: 'completed', value: T } | { status: 'failed', error: unknown }
  try {
    actionOutcome = { status: 'completed', value: await action() }
  } catch (error) {
    actionOutcome = { status: 'failed', error }
  }

  try {
    await database.transaction(async (transaction) => {
      const current = await transaction.get(matchID)
      if (current?.ownerToken === ownerToken) transaction.delete(matchID)
    })
  } catch {
    // The acquired lease is bounded and may expire naturally. Once the action
    // has run, a best-effort release failure must not replace its outcome.
  }
  database.close()

  if (actionOutcome.status === 'failed') throw actionOutcome.error
  return actionOutcome.value
}

export function createBrowserSeatTransitionLock(
  options: BrowserSeatTransitionLockOptions = {},
): SeatTransitionLock {
  const lockManager = Object.hasOwn(options, 'lockManager')
    ? options.lockManager ?? null
    : browserLockManager()
  const openLeaseDatabase = Object.hasOwn(options, 'openLeaseDatabase')
    ? options.openLeaseDatabase ?? null
    : browserLeaseDatabaseOpener()
  const now = options.now ?? Date.now
  const generateOwnerToken = options.generateOwnerToken ?? generateSeatTransitionLockOwnerToken
  const leaseMs = options.leaseMs ?? SEAT_TRANSITION_LOCK_LEASE_MS

  return async (matchID, action) => {
    if (lockManager !== null) {
      return lockManager.request(
        `avalon:seat-transition:${encodeURIComponent(matchID)}`,
        { ifAvailable: true, mode: 'exclusive' },
        (lock) => lock === null ? null : action(),
      )
    }

    if (openLeaseDatabase === null) {
      throw new SeatTransitionLockUnavailableError()
    }

    return withIndexedDBSeatTransitionLock(
      matchID,
      action,
      openLeaseDatabase,
      now,
      generateOwnerToken,
      leaseMs,
    )
  }
}

export const withBrowserSeatTransitionLock: SeatTransitionLock = (
  matchID,
  action,
) => createBrowserSeatTransitionLock()(matchID, action)

export interface RoomParticipationClient {
  changeSeat: (
    matchID: string,
    sourcePlayerID: string,
    credentials: string,
    targetPlayerID: string,
  ) => Promise<AvalonRoomSessionResponse>
  prepareStart: (
    matchID: string,
    playerID: string,
    credentials: string,
  ) => Promise<void>
}

export type SeatTransitionReplayClient = Pick<RoomParticipationClient, 'changeSeat'>

export interface RoomExitResult {
  status: 204 | 403 | 404
}

export type RoomExitResolution =
  | { status: 'completed' }
  | { status: 'rebind', session: RoomSession }
  | { status: 'session-retained' }
  | { status: 'transition-pending' }

export function createRoomParticipationClient(
  baseURL: string,
  fetcher: Fetcher = fetch,
): RoomParticipationClient {
  const request = async (url: string, credentials: string, body?: unknown) => {
    const response = await fetcher(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${credentials}`,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    if (!response.ok) {
      const body: unknown = await response.json().catch(() => undefined)
      const code = typeof body === 'object' && body !== null && 'error' in body
        ? (body as { error?: { code?: unknown } }).error?.code
        : undefined
      throw new RoomParticipationHttpError(
        response.status,
        typeof code === 'string' && AVALON_LOBBY_ERROR_CODES.includes(code as AvalonLobbyErrorCode)
          ? code as AvalonLobbyErrorCode
          : null,
      )
    }
    return response
  }

  return {
    async changeSeat(matchID, sourcePlayerID, credentials, targetPlayerID) {
      const response = await request(
        `${baseURL}/rooms/avalon/${encodeURIComponent(matchID)}/players/${encodeURIComponent(sourcePlayerID)}/seat`,
        credentials,
        { targetPlayerID },
      )
      try {
        return parseAvalonRoomSessionResponse(await response.json())
      } catch {
        throw new RoomParticipationResponseContractError()
      }
    },
    async prepareStart(matchID, playerID, credentials) {
      await request(
        `${baseURL}/rooms/avalon/${encodeURIComponent(matchID)}/players/${encodeURIComponent(playerID)}/prepare-start`,
        credentials,
      )
    },
  }
}

export function getSeatChangeErrorMessage(error: unknown) {
  if (error instanceof SeatTransitionPendingError) {
    return '座位正在变更，请稍后再试。'
  }
  if (error instanceof SeatTransitionLockUnavailableError) {
    return '当前浏览器无法安全换座，请刷新或更换浏览器后重试。'
  }
  if (error instanceof RoomParticipationHttpError && error.code === 'seat_unavailable') {
    return getLobbyErrorMessage(error.code)
  }
  return '换座失败，请重试。'
}

export function getStartErrorMessage(error: unknown) {
  if (error instanceof RoomParticipationHttpError && error.code !== null) {
    return getLobbyErrorMessage(error.code)
  }
  return '开始游戏失败，请重试。'
}

export function getRoomExitErrorMessage(error: unknown, isHost: boolean) {
  if (error instanceof RoomParticipationHttpError && error.status === 409) {
    return isHost
      ? '对局已经开始，无法解散房间。'
      : '对局已经开始，无法退出房间。'
  }
  return isHost ? '解散房间失败，请重试。' : '退出房间失败，请重试。'
}

export async function changeRoomSeat(
  client: RoomParticipationClient,
  source: RoomSession,
  targetPlayerID: string,
  storage?: RoomSessionStorage,
  lock: SeatTransitionLock = withBrowserSeatTransitionLock,
) {
  const result = await lock(source.matchID, async () => {
    if (loadSeatTransition(source.matchID, storage) !== null) {
      throw new SeatTransitionPendingError()
    }
    if (!isExactRoomSessionCurrent(source, storage)) {
      throw new SeatTransitionPendingError()
    }

    const transition = beginSeatTransition(source, targetPlayerID, storage)
    const heartbeat = globalThis.setInterval(
      () => renewSeatTransitionLease(transition, storage),
      SEAT_TRANSITION_LEASE_MS / 4,
    )
    try {
      const response = await client.changeSeat(
        source.matchID,
        source.playerID,
        source.credentials,
        targetPlayerID,
      )
      return completeSeatTransition(source, transition, response, storage)
    } catch (error) {
      if (isExactRoomSessionCurrent(source, storage)) {
        if (isDefinitiveSeatChangeRejection(error)) {
          clearSeatTransitionIfCurrent(transition, storage)
        } else {
          markSeatTransitionUncertain(transition, storage)
        }
      }
      throw error
    } finally {
      globalThis.clearInterval(heartbeat)
    }
  })

  if (result === null) throw new SeatTransitionPendingError()
  return result
}

function isDefinitiveSeatChangeRejection(error: unknown) {
  if (!(error instanceof RoomParticipationHttpError)) return false
  if ([400, 401, 403, 404].includes(error.status)) return true
  return error.status === 409 && error.code === 'seat_unavailable'
}

export function recoverRoomSeatTransition(
  client: SeatTransitionReplayClient,
  transition: SeatTransition,
  validate: ValidateSeat,
  storage?: RoomSessionStorage,
  now = Date.now(),
) {
  return recoverSeatTransition(transition, {
    isDefinitiveRejection: isDefinitiveSeatChangeRejection,
    replay: (matchID, sourcePlayerID, credentials, targetPlayerID) =>
      client.changeSeat(matchID, sourcePlayerID, credentials, targetPlayerID),
    validate,
  }, storage, now)
}

async function requestRoomExit(
  url: string,
  credentials: string,
  fetcher: Fetcher,
): Promise<RoomExitResult> {
  const response = await fetcher(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${credentials}` },
  })
  if (response.status === 204 || response.status === 403 || response.status === 404) {
    return { status: response.status as RoomExitResult['status'] }
  }

  throw new RoomParticipationHttpError(response.status)
}

function sameRoomSession(current: RoomSession | null, expected: RoomSession) {
  return current?.playerID === expected.playerID &&
    current.credentials === expected.credentials
}

export async function reconcileRoomExit(
  expected: RoomSession,
  result: RoomExitResult,
  transitionChanged: boolean,
  client: SeatTransitionReplayClient,
  validate: ValidateSeat,
  storage?: RoomSessionStorage,
): Promise<RoomExitResolution> {
  let currentSession = loadRoomSession(expected.matchID, storage)
  if (currentSession !== null && !sameRoomSession(currentSession, expected)) {
    return { status: 'rebind', session: currentSession }
  }

  const transition = loadSeatTransition(expected.matchID, storage)
  if (transition !== null) {
    const recovery = await recoverRoomSeatTransition(
      client,
      transition,
      validate,
      storage,
    )
    currentSession = loadRoomSession(expected.matchID, storage)
    if (currentSession !== null && !sameRoomSession(currentSession, expected)) {
      return { status: 'rebind', session: currentSession }
    }
    if (recovery.status === 'requesting') return { status: 'transition-pending' }
    if (recovery.status === 'source') return { status: 'session-retained' }
    if (recovery.status === 'target' && currentSession !== null) {
      return { status: 'rebind', session: currentSession }
    }
    if (recovery.status === 'invalid') return { status: 'completed' }
  }

  if (transitionChanged && result.status === 403) {
    const sourceValid = await validate(
      expected.matchID,
      expected.playerID,
      expected.credentials,
    )
    currentSession = loadRoomSession(expected.matchID, storage)
    if (currentSession !== null && !sameRoomSession(currentSession, expected)) {
      return { status: 'rebind', session: currentSession }
    }
    if (sourceValid || currentSession !== null) return { status: 'session-retained' }
  }

  clearRoomSessionIfCurrent(expected, storage)
  currentSession = loadRoomSession(expected.matchID, storage)
  if (currentSession === null) return { status: 'completed' }
  return sameRoomSession(currentSession, expected)
    ? { status: 'session-retained' }
    : { status: 'rebind', session: currentSession }
}

export async function leaveRoom(
  baseURL: string,
  session: Pick<RoomSession, 'matchID' | 'playerID' | 'credentials'>,
  fetcher: Fetcher = fetch,
) {
  return requestRoomExit(
    `${baseURL}/rooms/avalon/${encodeURIComponent(session.matchID)}/players/${encodeURIComponent(session.playerID)}`,
    session.credentials,
    fetcher,
  )
}

export async function dissolveRoom(
  baseURL: string,
  session: Pick<RoomSession, 'matchID' | 'credentials'>,
  fetcher: Fetcher = fetch,
) {
  return requestRoomExit(
    `${baseURL}/rooms/avalon/${encodeURIComponent(session.matchID)}`,
    session.credentials,
    fetcher,
  )
}
