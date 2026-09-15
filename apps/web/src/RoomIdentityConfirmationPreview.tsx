import { useMemo, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { loyaltyForRole, type AvalonPlayerView, type PlayerID, type Role } from '@avalon/game'

import type { AvalonMatch, LobbyPlayer } from './lobby'
import { ROLE_LABELS } from './room-game'
import { buildQuestProgress, buildRoomPlayers } from './room-presentation'
import type { RoomIdentityConfirmationScene } from './room-screen-props'
import { RoomScreenPreviewShell } from './RoomScreenPreviewShell'
import { useToast } from './toast-context'

type RoomIdentityConfirmationPreviewState = RoomIdentityConfirmationScene['view'] | 'confirming'
type IdentityConfirmationPreviewScenarioID = Extract<
  RoomIdentityConfirmationPreviewState,
  'concealed' | 'revealed' | 'confirming'
>

const SCENARIO_IDS: readonly IdentityConfirmationPreviewScenarioID[] = [
  'concealed',
  'revealed',
  'confirming',
]
const ROLES: readonly Role[] = ['merlin', 'percival', 'loyal_servant', 'assassin', 'morgana', 'minion']
const CURRENT_PLAYER_ID = '2' as PlayerID
const PLAYER_NAMES = ['苍', '雾林守望者', '银', '来自卡美洛的无名骑士', '青岚', '暮色远征者', '白鹿', '暮鸦议会记录官', '荆棘', '霜塔守夜人']
function isScenarioID(value: string | undefined): value is IdentityConfirmationPreviewScenarioID {
  return value !== undefined && SCENARIO_IDS.includes(value as IdentityConfirmationPreviewScenarioID)
}

function createPlayers(playerCount: number): LobbyPlayer[] {
  return Array.from({ length: playerCount }, (_, id) => ({
    id,
    name: `${PLAYER_NAMES[id]} ${id + 1}`,
    isConnected: id !== 1,
  }))
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
      matchID: `identity-confirmation-preview-${input.role}-${input.playerCount}`,
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
        stage: 'identityConfirmation',
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
          personalStage: 'identityConfirmation',
        },
      },
    },
  }
}

export function RoomIdentityConfirmationPreview() {
  const { scenarioID } = useParams()
  if (!isScenarioID(scenarioID)) return <Navigate replace to="/dev/room-layout" />
  return <IdentityConfirmationPreviewScenario key={scenarioID} scenarioID={scenarioID} />
}

function IdentityConfirmationPreviewScenario({
  scenarioID,
}: {
  scenarioID: IdentityConfirmationPreviewScenarioID
}) {
  const { pushToast } = useToast()
  const [playerCount, setPlayerCount] = useState(5)
  const [role, setRole] = useState<Role>('merlin')
  const [confirmedCount, setConfirmedCount] = useState(0)
  const [state, setState] = useState<RoomIdentityConfirmationPreviewState>(scenarioID)
  const preview = useMemo(
    () => createPreviewState({ playerCount, role, confirmedCount }),
    [confirmedCount, playerCount, role],
  )
  const setPreviewState = (next: RoomIdentityConfirmationPreviewState) => {
    setState(next)
  }

  const scene: RoomIdentityConfirmationScene = {
    kind: 'identityConfirmation',
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
    role,
    view: state === 'confirming' ? 'revealed' : state,
    completedCount: confirmedCount,
    participantCount: playerCount,
    confirmRequestState: state === 'confirming' ? 'pending' : 'idle',
  }
  const controls = (
    <>
          <h1>首次身份确认预览</h1>
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
            当前角色
            <select onChange={(event) => setRole(event.target.value as Role)} value={role}>
              {ROLES.map((option) => <option key={option} value={option}>{ROLE_LABELS[option]}</option>)}
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
            <button onClick={() => setPreviewState('concealed')} type="button">未揭示</button>
            <button onClick={() => setPreviewState('revealed')} type="button">已揭示</button>
            <button onClick={() => setPreviewState('confirming')} type="button">正在确认</button>
          </fieldset>
          {state === 'confirming' && (
            <fieldset>
              <legend>确认请求结果</legend>
              <button onClick={() => {
                setConfirmedCount((count) => Math.min(playerCount, Math.max(1, count + 1)))
                pushToast({ message: '身份确认成功。', tone: 'success' })
              }} type="button">模拟确认成功</button>
              <button onClick={() => {
                setPreviewState('revealed')
                pushToast({ message: '确认身份失败，请重试。', tone: 'error' })
              }} type="button">模拟确认失败</button>
            </fieldset>
          )}
    </>
  )

  return (
    <div className="size-full" data-identity-confirmation-state={state}>
      <RoomScreenPreviewShell
        actions={{
          onConfirm: () => setPreviewState('confirming'),
          onHide: () => setPreviewState('hiding'),
          onHideComplete: () => setPreviewState('concealed'),
          onReveal: () => setPreviewState('revealing'),
          onRevealComplete: () => setPreviewState('revealed'),
        }}
        controls={controls}
        scene={scene}
      />
    </div>
  )
}
