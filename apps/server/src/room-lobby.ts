import { randomUUID } from 'node:crypto'

import type { Game, Server, State, StorageAPI } from 'boardgame.io'
import { createMatch } from 'boardgame.io/internal'

import {
  AvalonSeatIDSchema,
  normalizeRoleConfiguration,
  type AvalonCreateRoomRequest,
  type AvalonG,
  type AvalonJoinRoomRequest,
  type AvalonLobbyErrorCode,
  type AvalonLobbyState,
  type AvalonRoleConfiguration,
  type AvalonRoomSessionResponse,
  type AvalonSeatID,
} from '@avalon/game'

import { secretMatches } from './secret'
import type { MatchDeletionGuard } from './storage/deletion-safe'
import type {
  AtomicLobbyStorage,
  LobbyMatchMutation,
  LobbyMatchSnapshot,
} from './storage/lobby-storage'

type MatchQueue = { add<T>(task: () => Promise<T>): Promise<T> }

interface RoomLobbyDependencies {
  db: StorageAPI.Sync | StorageAPI.Async
  storage: AtomicLobbyStorage
  game: Game<AvalonG, Record<string, never>>
  queues: { getMatchQueue(matchID: string): MatchQueue }
  deletionGuard: MatchDeletionGuard
  disconnectPlayer(matchID: string, playerID: string): void
  disconnectMatch(matchID: string): void
  now?: () => number
  createID?: () => string
  createCredential?: () => string
}

export class AvalonLobbyError extends Error {
  constructor(
    readonly status: number,
    readonly code: AvalonLobbyErrorCode | 'invalid_request',
    message: string,
  ) {
    super(message)
    this.name = 'AvalonLobbyError'
  }
}

export interface RoomLobbyService {
  createRoomAndJoin(
    request: AvalonCreateRoomRequest,
  ): Promise<AvalonRoomSessionResponse>
  joinRoom(
    matchID: string,
    request: AvalonJoinRoomRequest,
  ): Promise<AvalonRoomSessionResponse>
  changeSeat(
    matchID: string,
    sourcePlayerID: string,
    credential: string,
    targetPlayerID: string,
  ): Promise<AvalonRoomSessionResponse>
  prepareStart(
    matchID: string,
    playerID: string,
    credential: string,
  ): Promise<void>
  leaveRoom(
    matchID: string,
    playerID: string,
    credential: string,
  ): Promise<void>
  dissolveRoom(
    matchID: string,
    playerID: string,
    credential: string,
  ): Promise<void>
}

type PersistedAvalonG = Omit<AvalonG, 'lobby'> & {
  lobby?: {
    authorityVersion?: unknown
    ownerPlayerID?: unknown
    occupiedPlayerIDs?: unknown
  }
}

function roomNotFound() {
  return new AvalonLobbyError(404, 'room_not_found', 'Room not found')
}

function roomNotJoinable() {
  return new AvalonLobbyError(409, 'room_not_joinable', 'Room is not joinable')
}

function invalidSeatSession() {
  return new AvalonLobbyError(403, 'invalid_seat_session', 'Seat session is invalid')
}

function notRoomOwner() {
  return new AvalonLobbyError(403, 'not_room_owner', 'Only the room owner may perform this action')
}

function isOccupied(
  player: Server.PlayerMetadata | undefined,
): player is Server.PlayerMetadata & { name: string } {
  return player?.name !== undefined
}

function playerAt(metadata: Server.MatchData, playerID: string) {
  const parsed = AvalonSeatIDSchema.safeParse(playerID)
  return parsed.success ? metadata.players[Number(parsed.data)] : undefined
}

function occupiedPlayerIDs(metadata: Server.MatchData): AvalonSeatID[] {
  return Object.values(metadata.players)
    .filter(isOccupied)
    .map(({ id }) => AvalonSeatIDSchema.parse(String(id)))
    .sort((first, second) => Number(first) - Number(second))
}

function normalizedRoleConfiguration(G: PersistedAvalonG) {
  return normalizeRoleConfiguration(G.rules?.roleConfiguration)
}

function persistNormalizedRoleConfiguration(
  G: PersistedAvalonG,
  roleConfiguration: AvalonRoleConfiguration,
) {
  G.rules = {
    ...G.rules,
    roleConfiguration,
  }
}

export function normalizeLobbyAuthority(
  G: PersistedAvalonG,
  metadata: Server.MatchData,
): AvalonLobbyState {
  if (G.status !== 'lobby') throw roomNotJoinable()

  const rawLobby = G.lobby
  if (rawLobby?.authorityVersion === undefined) {
    const occupied = occupiedPlayerIDs(metadata)
    if (!occupied.includes('0')) throw roomNotJoinable()
    return {
      authorityVersion: 1,
      ownerPlayerID: '0',
      occupiedPlayerIDs: occupied,
    }
  }

  if (rawLobby.authorityVersion !== 1) throw roomNotJoinable()
  const owner = AvalonSeatIDSchema.safeParse(rawLobby.ownerPlayerID)
  if (!owner.success || !Array.isArray(rawLobby.occupiedPlayerIDs)) {
    throw roomNotJoinable()
  }
  const occupied = rawLobby.occupiedPlayerIDs.map((playerID) => {
    const parsed = AvalonSeatIDSchema.safeParse(playerID)
    if (!parsed.success) throw roomNotJoinable()
    return parsed.data
  })
  const uniqueOccupied = [...new Set(occupied)]
    .sort((first, second) => Number(first) - Number(second))
  if (
    uniqueOccupied.length !== occupied.length ||
    !uniqueOccupied.includes(owner.data) ||
    uniqueOccupied.some((playerID) => !isOccupied(playerAt(metadata, playerID)))
  ) {
    throw roomNotJoinable()
  }

  return {
    authorityVersion: 1,
    ownerPlayerID: owner.data,
    occupiedPlayerIDs: uniqueOccupied,
  }
}

export function getPublicLobbyAuthority(
  state: State,
  metadata: Server.MatchData,
): {
  authorityVersion: 1
  ownerPlayerID: AvalonSeatID | null
  occupiedPlayerIDs: AvalonSeatID[]
  roleConfiguration: AvalonRoleConfiguration
} {
  const G = state.G as PersistedAvalonG
  const roleConfiguration = normalizedRoleConfiguration(G)
  if (G.lobby?.authorityVersion === 1) {
    const owner = AvalonSeatIDSchema.safeParse(G.lobby.ownerPlayerID)
    const occupied = Array.isArray(G.lobby.occupiedPlayerIDs)
      ? G.lobby.occupiedPlayerIDs.flatMap((playerID) => {
        const parsed = AvalonSeatIDSchema.safeParse(playerID)
        return parsed.success ? [parsed.data] : []
      })
      : []
    return {
      authorityVersion: 1,
      ownerPlayerID: owner.success ? owner.data : null,
      occupiedPlayerIDs: [...new Set(occupied)]
        .sort((first, second) => Number(first) - Number(second)),
      roleConfiguration,
    }
  }

  const occupied = occupiedPlayerIDs(metadata)
  return {
    authorityVersion: 1,
    ownerPlayerID: occupied.includes('0') ? '0' : null,
    occupiedPlayerIDs: occupied,
    roleConfiguration,
  }
}

function authenticatePlayer(
  metadata: Server.MatchData,
  playerID: string,
  credential: string,
) {
  const player = playerAt(metadata, playerID)
  if (!isOccupied(player) || !secretMatches(credential, player?.credentials)) {
    throw invalidSeatSession()
  }
  return player
}

function readClientID(data: unknown) {
  if (typeof data !== 'object' || data === null) return undefined
  const value = (data as Record<string, unknown>).clientID
  return typeof value === 'string' ? value : undefined
}

function sessionResponse(
  matchID: string,
  playerID: string,
  credential: string,
): AvalonRoomSessionResponse {
  return {
    matchID,
    playerID: AvalonSeatIDSchema.parse(playerID),
    playerCredentials: credential,
  }
}

function withUpdatedAt(metadata: Server.MatchData, updatedAt: number) {
  metadata.updatedAt = updatedAt
  return metadata
}

function isMissingMatchError(error: unknown) {
  return error instanceof Error && /not found/i.test(error.message)
}

export function createRoomLobbyService(
  dependencies: RoomLobbyDependencies,
): RoomLobbyService {
  const now = dependencies.now ?? Date.now
  const createID = dependencies.createID ?? randomUUID
  const createCredential = dependencies.createCredential ?? randomUUID

  const mutate = async <T>(
    matchID: string,
    operation: (snapshot: LobbyMatchSnapshot) => LobbyMatchMutation<T>,
  ): Promise<T> => {
    try {
      return await dependencies.storage.mutateLobbyMatch(
        matchID,
        operation,
      )
    } catch (error) {
      if (isMissingMatchError(error)) throw roomNotFound()
      throw error
    }
  }

  return {
    async createRoomAndJoin(request) {
      const matchID = createID()
      const credential = createCredential()
      const match = createMatch({
        game: dependencies.game as unknown as Parameters<typeof createMatch>[0]['game'],
        numPlayers: request.numPlayers,
        setupData: {
          ownerPlayerID: '0',
          occupiedPlayerIDs: ['0'],
          roleConfiguration: request.roleConfiguration,
        },
        unlisted: false,
      })
      if ('setupDataError' in match) {
        throw new AvalonLobbyError(400, 'invalid_request', match.setupDataError)
      }

      match.initialState = structuredClone(match.initialState)
      ;(match.initialState.G as AvalonG).players['0'] = {
        name: request.playerName,
      }
      match.metadata.players[0] = {
        id: 0,
        name: request.playerName,
        data: request.data,
        credentials: credential,
        isConnected: false,
      }
      await dependencies.db.createMatch(matchID, match)
      return sessionResponse(matchID, '0', credential)
    },

    async joinRoom(matchID, request) {
      return dependencies.queues.getMatchQueue(matchID).add(async () =>
        mutate<AvalonRoomSessionResponse>(matchID, ({ state, metadata }) => {
          const G = state.G as PersistedAvalonG
          const lobby = normalizeLobbyAuthority(G, metadata)
          const roleConfiguration = normalizedRoleConfiguration(G)
          const clientID = request.data.clientID
          if (
            Object.values(metadata.players).some(
              (player) => isOccupied(player) && readClientID(player.data) === clientID,
            )
          ) {
            throw new AvalonLobbyError(
              409,
              'client_already_joined',
              'Client has already joined this room',
            )
          }

          const availablePlayerID = Object.keys(metadata.players)
            .map((id) => AvalonSeatIDSchema.parse(id))
            .sort((first, second) => Number(first) - Number(second))
            .find((playerID) => !lobby.occupiedPlayerIDs.includes(playerID))
          if (availablePlayerID === undefined) {
            throw new AvalonLobbyError(409, 'room_full', 'Room is full')
          }

          const credential = createCredential()
          metadata.players[Number(availablePlayerID)] = {
            id: Number(availablePlayerID),
            name: request.playerName,
            data: request.data,
            credentials: credential,
            isConnected: false,
          }
          G.players[availablePlayerID] = { name: request.playerName }
          G.lobby = {
            ...lobby,
            occupiedPlayerIDs: [...lobby.occupiedPlayerIDs, availablePlayerID]
              .sort((first, second) => Number(first) - Number(second)),
          }
          persistNormalizedRoleConfiguration(G, roleConfiguration)
          return {
            state: { ...state, G: G as AvalonG },
            metadata: withUpdatedAt(metadata, now()),
            result: sessionResponse(matchID, availablePlayerID, credential),
          }
        }),
      )
    },

    async changeSeat(matchID, sourcePlayerID, credential, targetPlayerID) {
      const result = await dependencies.queues.getMatchQueue(matchID).add(async () =>
        mutate<AvalonRoomSessionResponse>(matchID, ({ state, metadata }) => {
          const sourceID = AvalonSeatIDSchema.safeParse(sourcePlayerID)
          const targetID = AvalonSeatIDSchema.safeParse(targetPlayerID)
          if (!sourceID.success || !targetID.success) throw invalidSeatSession()
          const G = state.G as PersistedAvalonG
          const lobby = normalizeLobbyAuthority(G, metadata)
          const roleConfiguration = normalizedRoleConfiguration(G)
          const target = playerAt(metadata, targetID.data)

          if (
            isOccupied(target) &&
            secretMatches(credential, target?.credentials)
          ) {
            return {
              state,
              metadata,
              result: sessionResponse(matchID, targetID.data, credential),
            }
          }

          const authenticatedSource = authenticatePlayer(
            metadata,
            sourceID.data,
            credential,
          )
          if (!lobby.occupiedPlayerIDs.includes(sourceID.data)) {
            throw invalidSeatSession()
          }
          if (target === undefined || isOccupied(target)) {
            throw new AvalonLobbyError(409, 'seat_unavailable', 'Seat is unavailable')
          }

          metadata.players[Number(targetID.data)] = {
            ...authenticatedSource,
            id: Number(targetID.data),
          }
          metadata.players[Number(sourceID.data)] = {
            id: Number(sourceID.data),
            isConnected: false,
          }
          G.players[targetID.data] = G.players[sourceID.data] ?? {
            name: authenticatedSource.name ?? `Player ${Number(targetID.data) + 1}`,
          }
          G.players[sourceID.data] = {
            name: `Player ${Number(sourceID.data) + 1}`,
          }
          G.lobby = {
            ...lobby,
            ownerPlayerID: lobby.ownerPlayerID === sourceID.data
              ? targetID.data
              : lobby.ownerPlayerID,
            occupiedPlayerIDs: lobby.occupiedPlayerIDs
              .map((playerID) => playerID === sourceID.data ? targetID.data : playerID)
              .sort((first, second) => Number(first) - Number(second)),
          }
          persistNormalizedRoleConfiguration(G, roleConfiguration)
          return {
            state: { ...state, G: G as AvalonG },
            metadata: withUpdatedAt(metadata, now()),
            result: sessionResponse(matchID, targetID.data, credential),
          }
        }),
      )
      dependencies.disconnectPlayer(matchID, sourcePlayerID)
      return result
    },

    async prepareStart(matchID, playerID, credential) {
      await dependencies.queues.getMatchQueue(matchID).add(async () =>
        mutate<void>(matchID, ({ state, metadata }) => {
          const G = state.G as PersistedAvalonG
          const lobby = normalizeLobbyAuthority(G, metadata)
          authenticatePlayer(metadata, lobby.ownerPlayerID, credential)
          if (playerID !== lobby.ownerPlayerID) throw notRoomOwner()
          if (lobby.occupiedPlayerIDs.length !== Object.keys(metadata.players).length) {
            throw roomNotJoinable()
          }
          G.lobby = lobby
          persistNormalizedRoleConfiguration(G, normalizedRoleConfiguration(G))
          return {
            state: { ...state, G: G as AvalonG },
            metadata: withUpdatedAt(metadata, now()),
            result: undefined,
          }
        }),
      )
    },

    async leaveRoom(matchID, playerID, credential) {
      await dependencies.queues.getMatchQueue(matchID).add(async () =>
        mutate<void>(matchID, ({ state, metadata }) => {
          const normalizedPlayerID = AvalonSeatIDSchema.safeParse(playerID)
          if (!normalizedPlayerID.success) throw invalidSeatSession()
          const G = state.G as PersistedAvalonG
          const lobby = normalizeLobbyAuthority(G, metadata)
          authenticatePlayer(metadata, normalizedPlayerID.data, credential)
          if (!lobby.occupiedPlayerIDs.includes(normalizedPlayerID.data)) {
            throw invalidSeatSession()
          }
          if (normalizedPlayerID.data === lobby.ownerPlayerID) {
            throw new AvalonLobbyError(
              409,
              'owner_must_dissolve',
              'Room owner must dissolve the room',
            )
          }

          metadata.players[Number(normalizedPlayerID.data)] = {
            id: Number(normalizedPlayerID.data),
            credentials: createCredential(),
            isConnected: false,
          }
          G.players[normalizedPlayerID.data] = {
            name: `Player ${Number(normalizedPlayerID.data) + 1}`,
          }
          G.lobby = {
            ...lobby,
            occupiedPlayerIDs: lobby.occupiedPlayerIDs.filter(
              (occupiedPlayerID) => occupiedPlayerID !== normalizedPlayerID.data,
            ),
          }
          persistNormalizedRoleConfiguration(G, normalizedRoleConfiguration(G))
          return {
            state: { ...state, G: G as AvalonG },
            metadata: withUpdatedAt(metadata, now()),
            result: undefined,
          }
        }),
      )
      dependencies.disconnectPlayer(matchID, playerID)
    },

    async dissolveRoom(matchID, playerID, credential) {
      await dependencies.queues.getMatchQueue(matchID).add(async () => {
        await mutate<void>(matchID, ({ state, metadata }) => {
          const G = state.G as PersistedAvalonG
          const lobby = normalizeLobbyAuthority(G, metadata)
          const authenticatedPlayerID = playerID === ''
            ? Object.values(metadata.players).find(
              (player) => isOccupied(player) &&
                secretMatches(credential, player.credentials),
            )?.id
            : Number(playerID)
          if (authenticatedPlayerID === undefined) throw invalidSeatSession()
          const normalizedPlayerID = String(authenticatedPlayerID)
          authenticatePlayer(metadata, normalizedPlayerID, credential)
          if (normalizedPlayerID !== lobby.ownerPlayerID) throw notRoomOwner()
          return { state, metadata, result: undefined }
        })
        dependencies.deletionGuard.markMatchDeleted(matchID)
        dependencies.disconnectMatch(matchID)
        try {
          await dependencies.db.wipe(matchID)
        } catch (error) {
          if (!isMissingMatchError(error)) throw error
        }
      })
    },
  }
}
