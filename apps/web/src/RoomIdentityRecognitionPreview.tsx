import { useMemo, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { getPlayerCountConfig, loyaltyForRole, type AvalonPlayerView, type PlayerID, type Role } from '@avalon/game'

import type { AvalonMatch, LobbyPlayer } from './lobby'
import { buildQuestProgress, buildRoomPlayers } from './room-presentation'
import type { RoomIdentityClue, RoomIdentityRecognitionScene } from './room-screen-props'
import { RoomScreenPreviewShell } from './RoomScreenPreviewShell'
import { useToast } from './toast-context'

type IdentityRecognitionPreviewScenarioID = 'evil-allies' | 'merlin-evil' | 'percival-candidates' | 'waiting'
type CluePresentation = Extract<RoomIdentityRecognitionScene['presentation'], { kind: 'clue' }>
type RoomIdentityRecognitionPreviewState = CluePresentation['view'] | 'confirming' | 'waiting'

const SCENARIO_IDS: readonly IdentityRecognitionPreviewScenarioID[] = [
  'evil-allies',
  'merlin-evil',
  'percival-candidates',
  'waiting',
]
const CURRENT_PLAYER_ID = '2' as PlayerID
const PLAYER_NAMES = ['苍', '雾林守望者', '银', '来自卡美洛的无名骑士', '青岚', '暮色远征者', '白鹿', '暮鸦议会记录官', '荆棘', '霜塔守夜人']
const SCENARIO_ROLES: Readonly<Record<IdentityRecognitionPreviewScenarioID, Role>> = {
  'evil-allies': 'assassin',
  'merlin-evil': 'merlin',
  'percival-candidates': 'percival',
  waiting: 'loyal_servant',
}

function isScenarioID(value: string | undefined): value is IdentityRecognitionPreviewScenarioID {
  return value !== undefined && SCENARIO_IDS.includes(value as IdentityRecognitionPreviewScenarioID)
}

function createPlayers(playerCount: number): LobbyPlayer[] {
  return Array.from({ length: playerCount }, (_, id) => ({
    id,
    name: `${PLAYER_NAMES[id]} ${id + 1}`,
    isConnected: id !== 1,
  }))
}

function createClue(
  scenarioID: Exclude<IdentityRecognitionPreviewScenarioID, 'waiting'>,
  playerCount: number,
): RoomIdentityClue {
  const evilCount = getPlayerCountConfig(playerCount).evil
  const evilSeats = ['0', '4', '6', '8'] as const satisfies readonly PlayerID[]
  if (scenarioID === 'evil-allies') {
    return { kind: 'evilAllies', targetPlayerIDs: evilSeats.slice(0, evilCount - 1) }
  }
  if (scenarioID === 'merlin-evil') {
    return { kind: 'merlinEvil', targetPlayerIDs: evilSeats.slice(0, evilCount) }
  }
  if (scenarioID === 'percival-candidates') {
    return {
      kind: 'percivalCandidates',
      targetPlayerIDs: ['1', playerCount >= 7 ? '6' : '4'],
    }
  }
  throw new Error(`Unhandled clue scenario: ${scenarioID}`)
}

function createPreviewState(input: Readonly<{
  playerCount: number
  role: Role
  confirmedCount: number
}>): { room: AvalonMatch; game: AvalonPlayerView } {
  const players = createPlayers(input.playerCount)
  const ownerPlayerID = '0' as PlayerID
  const occupiedPlayerIDs = players.map(({ id }) => String(id) as PlayerID)
  const roleConfiguration = { percivalMorgana: true }

  return {
    room: {
      gameName: 'avalon',
      matchID: `identity-recognition-preview-${input.role}-${input.playerCount}`,
      players,
      setupData: { numPlayers: input.playerCount },
      ownerPlayerID,
      occupiedPlayerIDs,
      roleConfiguration,
    },
    game: {
      status: 'playing',
      lobby: { authorityVersion: 1, ownerPlayerID, occupiedPlayerIDs },
      players: Object.fromEntries(players.map((player) => [String(player.id), { name: player.name! }])),
      identityRecognition: {
        completedCount: input.confirmedCount,
        participantCount: input.playerCount,
      },
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
      rules: { roleConfiguration, timeouts: { enabled: false } },
      viewer: {
        role: input.role,
        loyalty: loyaltyForRole(input.role),
        knownEvilPlayerIDs: [],
        knownMerlinCandidatePlayerIDs: [],
        identityRecognition: {
          personalStage: input.role === 'loyal_servant'
            ? 'complete'
            : 'clueRecognition',
        },
      },
    },
  }
}

export function RoomIdentityRecognitionPreview() {
  const { scenarioID } = useParams()
  if (!isScenarioID(scenarioID)) return <Navigate replace to="/dev/room-layout" />
  return <IdentityRecognitionPreviewScenario key={scenarioID} scenarioID={scenarioID} />
}

function IdentityRecognitionPreviewScenario({
  scenarioID,
}: {
  scenarioID: IdentityRecognitionPreviewScenarioID
}) {
  const { pushToast } = useToast()
  const [playerCount, setPlayerCount] = useState(5)
  const [confirmedCount, setConfirmedCount] = useState(
    scenarioID === 'waiting' ? 2 : 0,
  )
  const [state, setState] = useState<RoomIdentityRecognitionPreviewState>(
    scenarioID === 'waiting' ? 'waiting' : 'concealed',
  )
  const role = SCENARIO_ROLES[scenarioID]
  const clue = useMemo(
    () => scenarioID === 'waiting' ? null : createClue(scenarioID, playerCount),
    [playerCount, scenarioID],
  )
  const preview = useMemo(
    () => createPreviewState({ playerCount, role, confirmedCount }),
    [confirmedCount, playerCount, role],
  )
  const showStableState = (next: RoomIdentityRecognitionPreviewState) => setState(next)

  const scene: RoomIdentityRecognitionScene = {
    kind: 'identityRecognition',
    matchID: preview.room.matchID,
    playerCount,
    players: buildRoomPlayers({
      players: preview.room.players,
      numPlayers: playerCount,
      currentPlayerID: CURRENT_PLAYER_ID,
      phase: 'identityRecognition',
      viewerConnected: true,
      ownerPlayerID: preview.room.ownerPlayerID,
      game: preview.game,
      selectedTeam: [],
      selectedTarget: null,
      showKnownPlayerInfo: false,
      showPrivateRoleKnowledge: false,
      showRoundDecorations: false,
      interactionMode: 'none',
    }),
    questProgress: buildQuestProgress(playerCount, preview.game),
    presentation: scenarioID === 'waiting' || state === 'waiting'
      ? { kind: 'waiting' }
      : {
          kind: 'clue',
          clue: clue!,
          view: state === 'confirming' ? 'revealed' : state,
          confirmRequestState: state === 'confirming' ? 'pending' : 'idle',
        },
    completedCount: confirmedCount,
    participantCount: playerCount,
  }
  const controls = (
    <>
          <h1>身份辨认预览</h1>
          <label>
            玩家人数
            <select onChange={(event) => {
              const nextCount = Number(event.target.value)
              setPlayerCount(nextCount)
              setConfirmedCount((count) => Math.min(count, nextCount))
            }} value={playerCount}>
              {[5, 6, 7, 8, 9, 10].map((count) => <option key={count} value={count}>{count} 人</option>)}
            </select>
          </label>
          <label>
            已确认人数
            <select onChange={(event) => setConfirmedCount(Number(event.target.value))} value={confirmedCount}>
              {Array.from({ length: playerCount + 1 }, (_, count) => <option key={count} value={count}>{count} / {playerCount}</option>)}
            </select>
          </label>
          <fieldset>
            <legend>场景状态</legend>
            <button onClick={() => showStableState('concealed')} type="button">未查看</button>
            <button onClick={() => showStableState('revealed')} type="button">已显示</button>
            <button onClick={() => showStableState('confirming')} type="button">正在确认</button>
            <button onClick={() => showStableState('waiting')} type="button">已完成等待</button>
          </fieldset>
          {state === 'confirming' && (
            <fieldset>
              <legend>确认请求结果</legend>
              <button onClick={() => {
                setConfirmedCount((count) => Math.min(playerCount, Math.max(1, count + 1)))
                setState('waiting')
                pushToast({ message: '身份辨认成功。', tone: 'success' })
              }} type="button">模拟确认成功</button>
              <button onClick={() => {
                setState('revealed')
                pushToast({ message: '确认辨认失败，请重试。', tone: 'error' })
              }} type="button">模拟确认失败</button>
            </fieldset>
          )}
    </>
  )

  return (
    <div className="size-full" data-identity-recognition-scene={scenarioID} data-identity-recognition-state={state}>
      <RoomScreenPreviewShell
        actions={{
          onConfirm: () => setState('confirming'),
          onHide: () => setState('concealed'),
          onReveal: () => setState('revealing'),
          onRevealComplete: () => setState('revealed'),
        }}
        controls={controls}
        scene={scene}
      />
    </div>
  )
}
