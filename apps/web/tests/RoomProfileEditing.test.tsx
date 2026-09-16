// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { RoomView, type RoomViewProps } from '../src/App'
import { RoomParticipationHttpError } from '../src/room-participation'
import { ToastProvider } from '../src/toast'

vi.mock('../src/config', () => ({
  webConfig: {
    gameURL: 'http://localhost:8000',
    lobbyURL: 'http://localhost:8001',
  },
}))

vi.mock('../src/RoomDevTools', () => ({ RoomDevTools: () => null }))

vi.mock('../src/useRoomLayout', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/useRoomLayout')>()
  const canvasRef = () => undefined
  const stageRef = () => undefined
  const snapshots = new Map<number, ReturnType<typeof actual.resolveRoomLayoutSnapshot>>()
  return {
    ...actual,
    useRoomLayout(playerCount: number | null) {
      if (playerCount === null) {
        return {
          canvasRef,
          stageRef,
          snapshot: actual.resolveRoomLayoutSnapshot({
            canvasSize: null, playerCount, stageSize: null, viewportSize: null,
          }),
        }
      }
      if (!snapshots.has(playerCount)) {
        snapshots.set(playerCount, actual.resolveRoomLayoutSnapshot({
          canvasSize: { height: 600, width: 800 },
          playerCount,
          stageSize: { height: 600, width: 800 },
          viewportSize: { height: 600, width: 800 },
        }))
      }
      return {
        canvasRef,
        stageRef,
        snapshot: snapshots.get(playerCount),
      }
    },
  }
})

let root: Root | null = null
let container: HTMLDivElement | null = null

globalThis.IS_REACT_ACT_ENVIRONMENT = true

afterEach(async () => {
  await act(async () => root?.unmount())
  container?.remove()
  root = null
  container = null
})

function room() {
  return {
    gameName: 'avalon',
    matchID: 'room-123',
    ownerPlayerID: '0',
    occupiedPlayerIDs: ['0', '1', '2', '3', '4'],
    players: [
      { id: 0, name: 'Alice', isConnected: true },
      { id: 1, name: 'Bob', isConnected: true },
      { id: 2, name: 'Claire', isConnected: true },
      { id: 3, name: 'Dylan', isConnected: true },
      { id: 4, name: 'Eve', isConnected: true },
    ],
    roleConfiguration: { percivalMorgana: true },
    setupData: { numPlayers: 5 },
  } as const
}

function gameState(
  phase: 'lobby' | 'teamProposal',
  connected = true,
): RoomViewProps['gameState'] {
  return {
    G: {
      status: phase === 'lobby' ? 'lobby' : 'playing',
      lobby: { occupiedPlayerIDs: ['0', '1', '2', '3', '4'], ownerPlayerID: '0' },
      players: {
        '0': { name: 'Alice' }, '1': { name: 'Bob' }, '2': { name: 'Claire' },
        '3': { name: 'Dylan' }, '4': { name: 'Eve' },
      },
      identityRecognition: null,
      leaderID: '0',
      questIndex: 0,
      proposedTeam: null,
      submittedTeamVotePlayerIDs: [],
      submittedQuestCardCount: 0,
      voteHistory: [],
      questHistory: [],
      consecutiveRejectedTeams: 0,
      goodSuccesses: 0,
      evilFailures: 0,
      rules: { timeouts: { enabled: false } },
      viewer: {
        role: 'merlin', loyalty: 'good', knownEvilPlayerIDs: ['3', '4'],
        knownMerlinCandidatePlayerIDs: [],
      },
    },
    ctx: {
      numPlayers: 5,
      turn: 1,
      currentPlayer: '0',
      playOrder: ['0', '1', '2', '3', '4'],
      playOrderPos: 0,
      phase,
      activePlayers: phase === 'lobby' ? null : { '0': 'leader' },
    },
    isActive: true,
    isConnected: connected,
  } as RoomViewProps['gameState']
}

function props(overrides: Partial<RoomViewProps> = {}): RoomViewProps {
  return {
    gameState: gameState('lobby'),
    onAssassinate: vi.fn(),
    onBackHome: vi.fn(),
    onCastTeamVote: vi.fn(),
    onChangeSeat: vi.fn(),
    onClearLocalSession: vi.fn(),
    onConfirmIdentityRecognition: vi.fn(),
    onDeleteRoom: vi.fn(),
    onKickPlayer: vi.fn(),
    onOpenHelp: vi.fn(),
    onPlayQuestCard: vi.fn(),
    onProposeTeam: vi.fn(),
    onReconnect: vi.fn(),
    onRequestRoomExit: vi.fn(),
    onSaveProfile: vi.fn(),
    onStart: vi.fn(),
    profile: { avatarID: 'merlin', name: 'Alice' },
    room: room(),
    roomExitBlocked: false,
    roomExitBusy: false,
    seatChangeTargetID: null,
    session: {
      credentials: 'credential', matchID: 'room-123', playerID: '0', playerName: 'Alice',
    },
    startPending: false,
    ...overrides,
  }
}

async function renderRoom(viewProps: RoomViewProps) {
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  await act(async () => root?.render(
    <ToastProvider><RoomView {...viewProps} /></ToastProvider>,
  ))
}

describe('RoomView profile editing', () => {
  it('opens from the current nameplate and discards the dialog when play starts', async () => {
    const viewProps = props()
    await renderRoom(viewProps)

    const edit = container?.querySelector<HTMLButtonElement>(
      'button[aria-label="编辑名字和头像"]',
    )
    await act(async () => edit?.click())
    expect(container?.querySelector('[role="dialog"][aria-label="用户中心"]')).not.toBeNull()

    await act(async () => root?.render(
      <ToastProvider>
        <RoomView {...viewProps} gameState={gameState('teamProposal')} />
      </ToastProvider>,
    ))
    expect(container?.querySelector('[role="dialog"][aria-label="用户中心"]')).toBeNull()
    expect(container?.querySelector('button[aria-label="编辑名字和头像"]')).toBeNull()
  })

  it('closes with a clear error when the server serializes game start first', async () => {
    await renderRoom(props({
      onSaveProfile: vi.fn(async () => {
        throw new RoomParticipationHttpError(409, 'room_not_joinable')
      }),
    }))

    await act(async () => container?.querySelector<HTMLButtonElement>(
      'button[aria-label="编辑名字和头像"]',
    )?.click())
    await act(async () => container?.querySelector<HTMLButtonElement>(
      'button[data-profile-save="true"]',
    )?.click())

    expect(container?.querySelector('[role="dialog"][aria-label="用户中心"]')).toBeNull()
    expect(container?.textContent).toContain('游戏已开始，无法修改资料。')
  })

  it('keeps an open draft editable but disables saving while disconnected', async () => {
    const viewProps = props()
    await renderRoom(viewProps)
    await act(async () => container?.querySelector<HTMLButtonElement>(
      'button[aria-label="编辑名字和头像"]',
    )?.click())

    await act(async () => root?.render(
      <ToastProvider>
        <RoomView {...viewProps} gameState={gameState('lobby', false)} />
      </ToastProvider>,
    ))

    expect(container?.querySelector<HTMLInputElement>('input[name="player-profile-name"]')?.disabled)
      .toBe(false)
    expect(container?.querySelector<HTMLButtonElement>('button[data-profile-save="true"]')?.disabled)
      .toBe(true)
    expect(container?.textContent).toContain('重新连接后才能修改资料。')
  })
})
