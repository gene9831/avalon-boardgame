import { useMemo, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import type { AvalonPlayerView, PlayerID } from '@avalon/game'

import type { AvalonMatch, LobbyPlayer } from './lobby'
import { getQuestTeamSize, toggleTeamMember } from './room-game'
import { buildQuestProgress, buildRoomPlayers } from './room-screen-model'
import type { RoomTeamProposalScene } from './room-screen-props'
import { RoomScreenPreviewShell } from './RoomScreenPreviewShell'
import { useToast } from './toast-context'

type TeamProposalPreviewScenarioID = 'leader' | 'member'

const SCENARIO_IDS: readonly TeamProposalPreviewScenarioID[] = ['leader', 'member']
const CURRENT_PLAYER_ID = '2' as PlayerID
const PLAYER_NAMES = ['苍', '雾林守望者', '银', '来自卡美洛的无名骑士', '青岚', '暮色远征者', '白鹿', '暮鸦议会记录官', '荆棘', '霜塔守夜人']
function isScenarioID(value: string | undefined): value is TeamProposalPreviewScenarioID {
  return value !== undefined && SCENARIO_IDS.includes(value as TeamProposalPreviewScenarioID)
}

function createPlayers(playerCount: number, disconnected: boolean): LobbyPlayer[] {
  return Array.from({ length: playerCount }, (_, id) => ({
    id,
    name: `${PLAYER_NAMES[id]} ${id + 1}`,
    isConnected: !disconnected || id !== 1,
  }))
}

function createPreviewState(input: Readonly<{
  scenarioID: TeamProposalPreviewScenarioID
  playerCount: number
  questIndex: number
  consecutiveRejectedTeams: number
  disconnected: boolean
}>): { room: AvalonMatch; game: AvalonPlayerView } {
  const players = createPlayers(input.playerCount, input.disconnected)
  const ownerPlayerID = '0' as PlayerID
  const leaderID = input.scenarioID === 'leader' ? CURRENT_PLAYER_ID : ownerPlayerID
  const occupiedPlayerIDs = players.map(({ id }) => String(id) as PlayerID)
  const room: AvalonMatch = {
    gameName: 'avalon',
    matchID: `team-proposal-preview-${input.scenarioID}-${input.playerCount}`,
    players,
    setupData: { numPlayers: input.playerCount },
    ownerPlayerID,
    occupiedPlayerIDs,
    roleConfiguration: { percivalMorgana: true },
  }
  const questHistory = Array.from({ length: input.questIndex }, (_, questIndex) => {
    const teamSize = getQuestTeamSize(input.playerCount, questIndex)
    const succeeded = questIndex % 2 === 0
    return {
      questIndex,
      team: occupiedPlayerIDs.slice(0, teamSize),
      successCount: succeeded ? teamSize : teamSize - 1,
      failCount: succeeded ? 0 : 1,
      succeeded,
    }
  })

  return {
    room,
    game: {
      status: 'playing',
      lobby: { authorityVersion: 1, ownerPlayerID, occupiedPlayerIDs },
      players: Object.fromEntries(players.map((player) => [String(player.id), { name: player.name! }])),
      identityRecognition: null,
      leaderID,
      questIndex: input.questIndex,
      proposedTeam: null,
      submittedTeamVotePlayerIDs: [],
      submittedQuestCardCount: 0,
      voteHistory: [],
      questHistory,
      consecutiveRejectedTeams: input.consecutiveRejectedTeams,
      goodSuccesses: questHistory.filter(({ succeeded }) => succeeded).length,
      evilFailures: questHistory.filter(({ succeeded }) => !succeeded).length,
      rules: { roleConfiguration: room.roleConfiguration, timeouts: { enabled: false } },
      viewer: {
        role: 'loyal_servant',
        loyalty: 'good',
        knownEvilPlayerIDs: [],
        knownMerlinCandidatePlayerIDs: [],
      },
    },
  }
}

export function RoomTeamProposalPreview() {
  const { scenarioID } = useParams()
  if (!isScenarioID(scenarioID)) return <Navigate replace to="/dev/room-layout" />
  return <TeamProposalPreviewScenario scenarioID={scenarioID} />
}

function TeamProposalPreviewScenario({ scenarioID }: { scenarioID: TeamProposalPreviewScenarioID }) {
  const { pushToast } = useToast()
  const [playerCount, setPlayerCount] = useState(5)
  const [questIndex, setQuestIndex] = useState(0)
  const [consecutiveRejectedTeams, setConsecutiveRejectedTeams] = useState(0)
  const [selectedTeam, setSelectedTeam] = useState<PlayerID[]>([CURRENT_PLAYER_ID])
  const [disconnected, setDisconnected] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const preview = useMemo(() => createPreviewState({
    scenarioID, playerCount, questIndex, consecutiveRejectedTeams, disconnected,
  }), [consecutiveRejectedTeams, disconnected, playerCount, questIndex, scenarioID])
  const requiredTeamSize = getQuestTeamSize(playerCount, questIndex)
  const isLeader = scenarioID === 'leader'

  const setSelection = (selection: readonly PlayerID[]) => {
    setSelectedTeam([...selection])
    setSubmitting(false)
  }
  const selectionOrder = [CURRENT_PLAYER_ID, ...Array.from({ length: playerCount }, (_, id) => String(id) as PlayerID).filter((id) => id !== CURRENT_PLAYER_ID)]

  const scene: RoomTeamProposalScene = {
    kind: 'teamProposal',
    matchID: preview.room.matchID,
    playerCount,
    players: buildRoomPlayers({
      players: preview.room.players,
      numPlayers: playerCount,
      currentPlayerID: CURRENT_PLAYER_ID,
      phase: 'teamProposal',
      viewerConnected: true,
      ownerPlayerID: preview.room.ownerPlayerID,
      game: preview.game,
      selectedTeam: isLeader ? selectedTeam : [],
      selectedTarget: null,
      showKnownPlayerInfo: false,
      showPrivateRoleKnowledge: false,
      interactionMode: isLeader ? 'selectTeam' : 'none',
    }),
    questProgress: buildQuestProgress(playerCount, preview.game),
    questIndex,
    requiredTeamSize,
    selectedCount: isLeader ? selectedTeam.length : 0,
    consecutiveRejectedTeams,
    perspective: isLeader ? 'leader' : 'observer',
    canSubmit: isLeader && !submitting && selectedTeam.length === requiredTeamSize,
    submitRequestState: submitting ? 'pending' : 'idle',
  }
  const controls = (
    <>
          <h1>组队阶段预览</h1>
          <label>
            玩家人数
            <select onChange={(event) => { setPlayerCount(Number(event.target.value)); setSelection([]) }} value={playerCount}>
              {[5, 6, 7, 8, 9, 10].map((count) => <option key={count} value={count}>{count} 人</option>)}
            </select>
          </label>
          <label>
            当前任务
            <select onChange={(event) => { setQuestIndex(Number(event.target.value)); setSelection([]) }} value={questIndex}>
              {[0, 1, 2, 3, 4].map((index) => <option key={index} value={index}>第 {index + 1} 次任务</option>)}
            </select>
          </label>
          <label>
            连续否决
            <select onChange={(event) => setConsecutiveRejectedTeams(Number(event.target.value))} value={consecutiveRejectedTeams}>
              {[0, 1, 2, 3, 4].map((count) => <option key={count} value={count}>{count} / 5</option>)}
            </select>
          </label>
          <label className="room-lobby-preview__controls-check">
            <input checked={disconnected} onChange={(event) => setDisconnected(event.target.checked)} type="checkbox" />
            2 号玩家掉线
          </label>
          {isLeader && (
            <fieldset>
              <legend>队伍选择</legend>
              <button onClick={() => setSelection([])} type="button">未选择</button>
              <button onClick={() => setSelection(selectionOrder.slice(0, Math.max(1, requiredTeamSize - 1)))} type="button">部分选择</button>
              <button onClick={() => setSelection(selectionOrder.slice(0, requiredTeamSize))} type="button">选择完成</button>
              <button onClick={() => { setSelection(selectionOrder.slice(0, requiredTeamSize)); setSubmitting(true) }} type="button">正在确认</button>
            </fieldset>
          )}
          {submitting && <button onClick={() => { setSubmitting(false); pushToast({ message: '确认队伍失败，请重试。', tone: 'error' }) }} type="button">模拟确认失败</button>}
          <button onClick={() => { setQuestIndex(0); setConsecutiveRejectedTeams(0); setDisconnected(true); setSelection([]) }} type="button">重置预览</button>
    </>
  )

  return (
    <RoomScreenPreviewShell
      actions={{
        onActivatePlayer: (playerID) => {
          if (!isLeader || submitting) return
          setSelection(toggleTeamMember(selectedTeam, playerID, requiredTeamSize))
        },
        onSubmitTeam: () => setSubmitting(true),
      }}
      controls={controls}
      scene={scene}
    />
  )
}
