import { useMemo, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import {
  buildRoleDeck,
  getPlayerCountConfig,
  loyaltyForRole,
  type AvalonPlayerView,
  type AvalonResult,
  type PlayerID,
  type QuestResult,
  type Role,
} from '@avalon/game'

import type { AvalonMatch, LobbyPlayer } from './lobby'
import { buildQuestProgress, buildRoomPlayers } from './room-presentation'
import type { RoomGameResultScene } from './room-screen-props'
import { RoomScreenPreviewShell } from './RoomScreenPreviewShell'

type ResultPreviewScenarioID =
  | 'good-assassination'
  | 'evil-assassination'
  | 'evil-quests'
  | 'evil-rejections'

const SCENARIO_IDS: readonly ResultPreviewScenarioID[] = [
  'good-assassination',
  'evil-assassination',
  'evil-quests',
  'evil-rejections',
]
const CURRENT_PLAYER_ID = '2' as PlayerID
const PLAYER_NAMES = ['苍', '雾林守望者', '银', '来自卡美洛的无名骑士', '青岚', '暮色远征者', '白鹿', '暮鸦议会记录官', '荆棘', '霜塔守夜人']
function isScenarioID(value: string | undefined): value is ResultPreviewScenarioID {
  return value !== undefined && SCENARIO_IDS.includes(value as ResultPreviewScenarioID)
}

function createPlayers(playerCount: number): LobbyPlayer[] {
  return Array.from({ length: playerCount }, (_, id) => ({
    id,
    name: `${PLAYER_NAMES[id]} ${id + 1}`,
    isConnected: id !== 1,
  }))
}

function assignPreviewRoles(playerCount: number, pairedRoles: boolean): Record<PlayerID, Role> {
  const playerIDs = Array.from({ length: playerCount }, (_, index) => String(index) as PlayerID)
  const deck = buildRoleDeck(playerCount, { percivalMorgana: pairedRoles })
  return Object.fromEntries(playerIDs.map((playerID, index) => [playerID, deck[index]]))
}

function createQuestHistory(
  playerCount: number,
  outcomes: readonly boolean[],
  playerIDs: readonly PlayerID[],
): QuestResult[] {
  const config = getPlayerCountConfig(playerCount)
  return outcomes.map((succeeded, questIndex) => {
    const teamSize = config.questTeamSizes[questIndex]
    const failCount = succeeded ? 0 : config.questFailThresholds[questIndex]
    return {
      questIndex,
      team: playerIDs.slice(0, teamSize),
      successCount: teamSize - failCount,
      failCount,
      succeeded,
    }
  })
}

function resultForScenario(
  scenarioID: ResultPreviewScenarioID,
  roles: Record<PlayerID, Role>,
): AvalonResult {
  if (scenarioID === 'evil-quests') return { winner: 'evil', reason: 'three_quests' }
  if (scenarioID === 'evil-rejections') return { winner: 'evil', reason: 'five_rejections' }

  const merlinID = Object.entries(roles).find(([, role]) => role === 'merlin')?.[0] as PlayerID
  if (scenarioID === 'evil-assassination') {
    return { winner: 'evil', reason: 'assassination', targetID: merlinID }
  }
  const missedTargetID = Object.entries(roles).find(([, role]) => role !== 'merlin' && loyaltyForRole(role) === 'good')?.[0] as PlayerID
  return { winner: 'good', reason: 'assassination', targetID: missedTargetID }
}

function resultReason(room: AvalonMatch, result: AvalonResult): string {
  if (result.reason === 'five_rejections') return '连续否决 5 支队伍'
  if (result.reason === 'three_quests') return result.winner === 'good' ? '完成 3 次任务' : '破坏 3 次任务'
  const targetName = room.players.find(({ id }) => String(id) === result.targetID)?.name
    ?? `${Number(result.targetID) + 1} 号玩家`
  return result.winner === 'evil' ? `刺杀命中梅林：${targetName}` : `刺杀未命中：${targetName}`
}

// oxlint-disable-next-line react/only-export-components
export function createRoomResultPreviewState(input: Readonly<{
  scenarioID: ResultPreviewScenarioID
  playerCount: number
  pairedRoles: boolean
}>): { room: AvalonMatch; game: AvalonPlayerView } {
  const players = createPlayers(input.playerCount)
  const ownerPlayerID = '0' as PlayerID
  const occupiedPlayerIDs = players.map(({ id }) => String(id) as PlayerID)
  const roleConfiguration = { percivalMorgana: input.pairedRoles }
  const roles = assignPreviewRoles(input.playerCount, input.pairedRoles)
  const outcomes = input.scenarioID === 'evil-quests'
    ? [false, true, false, false]
    : input.scenarioID === 'evil-rejections'
      ? [true, false]
      : [true, false, true, true]
  const questHistory = createQuestHistory(input.playerCount, outcomes, occupiedPlayerIDs)
  const result = resultForScenario(input.scenarioID, roles)
  const viewerRole = roles[CURRENT_PLAYER_ID]
  const room: AvalonMatch = {
    gameName: 'avalon',
    matchID: `result-preview-${input.scenarioID}-${input.playerCount}`,
    players,
    setupData: { numPlayers: input.playerCount },
    ownerPlayerID,
    occupiedPlayerIDs,
    roleConfiguration,
  }

  return {
    room,
    game: {
      status: 'finished',
      lobby: { authorityVersion: 1, ownerPlayerID, occupiedPlayerIDs },
      players: Object.fromEntries(players.map((player) => [String(player.id), { name: player.name! }])),
      identityRecognition: null,
      leaderID: '0',
      questIndex: Math.min(questHistory.length, 4),
      proposedTeam: occupiedPlayerIDs.slice(0, 2),
      submittedTeamVotePlayerIDs: [],
      submittedQuestCardCount: 0,
      voteHistory: [],
      questHistory,
      consecutiveRejectedTeams: input.scenarioID === 'evil-rejections' ? 5 : 0,
      goodSuccesses: questHistory.filter(({ succeeded }) => succeeded).length,
      evilFailures: questHistory.filter(({ succeeded }) => !succeeded).length,
      rules: { roleConfiguration, timeouts: { enabled: false } },
      result,
      revealedRoles: roles,
      viewer: {
        role: viewerRole,
        loyalty: loyaltyForRole(viewerRole),
        knownEvilPlayerIDs: [],
        knownMerlinCandidatePlayerIDs: [],
      },
    },
  }
}

// oxlint-disable-next-line react/only-export-components
export function createRoomResultPreviewScene(
  preview: ReturnType<typeof createRoomResultPreviewState>,
): RoomGameResultScene {
  const playerCount = preview.room.setupData?.numPlayers ?? preview.room.players.length
  return {
    kind: 'gameResult',
    matchID: preview.room.matchID,
    playerCount,
    players: buildRoomPlayers({
      players: preview.room.players,
      numPlayers: playerCount,
      currentPlayerID: CURRENT_PLAYER_ID,
      phase: 'finished',
      viewerConnected: true,
      ownerPlayerID: null,
      game: preview.game,
      selectedTeam: [],
      selectedTarget: null,
      showKnownPlayerInfo: false,
      showPrivateRoleKnowledge: false,
      showRoleReveal: true,
      showRoundDecorations: false,
      showConnectionStatus: false,
      interactionMode: 'none',
    }),
    questProgress: buildQuestProgress(playerCount, preview.game, false),
    winner: preview.game.result?.winner ?? 'good',
    reason: preview.game.result === undefined ? '' : resultReason(preview.room, preview.game.result),
    questScore: `任务 ${preview.game.goodSuccesses} 成功 / ${preview.game.evilFailures} 失败`,
  }
}

export function RoomResultPreview() {
  const { scenarioID } = useParams()
  if (!isScenarioID(scenarioID)) return <Navigate replace to="/dev/room-layout" />
  return <ResultPreviewScenario scenarioID={scenarioID} />
}

function ResultPreviewScenario({ scenarioID }: { scenarioID: ResultPreviewScenarioID }) {
  const [playerCount, setPlayerCount] = useState(5)
  const [pairedRoles, setPairedRoles] = useState(true)
  const preview = useMemo(
    () => createRoomResultPreviewState({ scenarioID, playerCount, pairedRoles }),
    [pairedRoles, playerCount, scenarioID],
  )
  const scene = useMemo(() => createRoomResultPreviewScene(preview), [preview])
  const controls = (
    <>
          <h1>对局结果预览</h1>
          <label>
            玩家人数
            <select value={playerCount} onChange={(event) => setPlayerCount(Number(event.target.value))}>
              {Array.from({ length: 6 }, (_, index) => index + 5).map((count) => <option key={count} value={count}>{count} 人</option>)}
            </select>
          </label>
          <label className="room-lobby-preview__controls-check">
            <input checked={pairedRoles} onChange={(event) => setPairedRoles(event.target.checked)} type="checkbox" />启用帕西维尔与莫甘娜
          </label>
    </>
  )

  return <RoomScreenPreviewShell actions={null} controls={controls} scene={scene} />
}
