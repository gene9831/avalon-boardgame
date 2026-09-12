import { useEffect, useMemo, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import {
  getPlayerCountConfig,
  type AvalonPlayerView,
  type PlayerID,
  type QuestCard,
  type QuestResult,
  type TeamVote,
} from '@avalon/game'

import type { AvalonMatch, LobbyPlayer } from './lobby'
import { getQuestTeamSize } from './room-game'
import { buildQuestProgress, buildRoomPlayers } from './room-presentation'
import type { RoomQuestScene, RoomTeamProposalScene } from './room-screen-props'
import { RoomScreenPreviewShell } from './RoomScreenPreviewShell'
import { useToast } from './toast-context'

type QuestPreviewScenarioID = 'member-good' | 'member-evil' | 'observer'

const SCENARIO_IDS: readonly QuestPreviewScenarioID[] = ['member-good', 'member-evil', 'observer']
const CURRENT_PLAYER_ID = '2' as PlayerID
const PLAYER_NAMES = ['苍', '雾林守望者', '银', '来自卡美洛的无名骑士', '青岚', '暮色远征者', '白鹿', '暮鸦议会记录官', '荆棘', '霜塔守夜人']
function isScenarioID(value: string | undefined): value is QuestPreviewScenarioID {
  return value !== undefined && SCENARIO_IDS.includes(value as QuestPreviewScenarioID)
}

function createPlayers(playerCount: number, disconnected: boolean): LobbyPlayer[] {
  return Array.from({ length: playerCount }, (_, id) => ({
    id,
    name: `${PLAYER_NAMES[id]} ${id + 1}`,
    isConnected: !disconnected || id !== 1,
  }))
}

function createQuestHistory(playerCount: number, questIndex: number, playerIDs: readonly PlayerID[]) {
  return Array.from({ length: questIndex }, (_, index) => {
    const teamSize = getQuestTeamSize(playerCount, index)
    const succeeded = index % 2 === 0
    return {
      questIndex: index,
      team: playerIDs.slice(0, teamSize),
      successCount: succeeded ? teamSize : teamSize - 1,
      failCount: succeeded ? 0 : 1,
      succeeded,
    }
  })
}

function createApprovedVote(playerIDs: readonly PlayerID[], questIndex: number, team: readonly PlayerID[]) {
  const votes = Object.fromEntries(playerIDs.map((playerID, index) => [
    playerID,
    index === playerIDs.length - 1 ? 'reject' : 'approve',
  ])) as Record<PlayerID, TeamVote>
  return { proposerID: '0' as PlayerID, questIndex, team: [...team], votes, approved: true }
}

function createPreviewState(input: Readonly<{
  scenarioID: QuestPreviewScenarioID
  playerCount: number
  questIndex: number
  submittedCount: number
  submittedCard: QuestCard | null
  disconnected: boolean
  advancedResult: QuestResult | null
}>): { room: AvalonMatch; game: AvalonPlayerView; teamSize: number } {
  const players = createPlayers(input.playerCount, input.disconnected)
  const ownerPlayerID = '0' as PlayerID
  const occupiedPlayerIDs = players.map(({ id }) => String(id) as PlayerID)
  const teamSize = getQuestTeamSize(input.playerCount, input.questIndex)
  const otherPlayerIDs = occupiedPlayerIDs.filter((id) => id !== CURRENT_PLAYER_ID)
  const proposedTeam = input.scenarioID === 'observer'
    ? otherPlayerIDs.slice(0, teamSize)
    : [CURRENT_PLAYER_ID, ...otherPlayerIDs].slice(0, teamSize)
  const questHistory = createQuestHistory(input.playerCount, input.questIndex, occupiedPlayerIDs)
  if (input.advancedResult !== null) questHistory.push(input.advancedResult)
  const currentQuestIndex = input.advancedResult === null
    ? input.questIndex
    : Math.min(input.questIndex + 1, 4)
  const room: AvalonMatch = {
    gameName: 'avalon',
    matchID: `quest-preview-${input.scenarioID}-${input.playerCount}`,
    players,
    setupData: { numPlayers: input.playerCount },
    ownerPlayerID,
    occupiedPlayerIDs,
    roleConfiguration: { percivalMorgana: true },
  }
  const approvedVote = createApprovedVote(occupiedPlayerIDs, input.questIndex, proposedTeam)

  return {
    room,
    teamSize,
    game: {
      status: 'playing',
      lobby: { authorityVersion: 1, ownerPlayerID, occupiedPlayerIDs },
      players: Object.fromEntries(players.map((player) => [String(player.id), { name: player.name! }])),
      identityRecognition: null,
      leaderID: input.advancedResult === null ? ownerPlayerID : ('1' as PlayerID),
      questIndex: currentQuestIndex,
      proposedTeam: input.advancedResult === null ? proposedTeam : null,
      submittedTeamVotePlayerIDs: [],
      submittedQuestCardCount: input.advancedResult === null ? input.submittedCount : 0,
      voteHistory: [approvedVote],
      questHistory,
      consecutiveRejectedTeams: 0,
      goodSuccesses: questHistory.filter(({ succeeded }) => succeeded).length,
      evilFailures: questHistory.filter(({ succeeded }) => !succeeded).length,
      rules: { roleConfiguration: room.roleConfiguration, timeouts: { enabled: false } },
      viewer: {
        role: input.scenarioID === 'member-evil' ? 'minion' : 'loyal_servant',
        loyalty: input.scenarioID === 'member-evil' ? 'evil' : 'good',
        knownEvilPlayerIDs: input.scenarioID === 'member-evil' ? ['4' as PlayerID] : [],
        knownMerlinCandidatePlayerIDs: [],
        ...(input.submittedCard === null ? {} : { submittedQuestCard: input.submittedCard }),
      },
    },
  }
}

export function RoomQuestPreview() {
  const { scenarioID } = useParams()
  if (!isScenarioID(scenarioID)) return <Navigate replace to="/dev/room-layout" />
  return <QuestPreviewScenario scenarioID={scenarioID} />
}

function QuestPreviewScenario({ scenarioID }: { scenarioID: QuestPreviewScenarioID }) {
  const { pushToast } = useToast()
  const [playerCount, setPlayerCount] = useState(5)
  const [questIndex, setQuestIndex] = useState(0)
  const [submittedCount, setSubmittedCount] = useState(1)
  const [selectedCard, setSelectedCard] = useState<QuestCard | null>(null)
  const [submittedCard, setSubmittedCard] = useState<QuestCard | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [disconnected, setDisconnected] = useState(true)
  const [showVoteDetails, setShowVoteDetails] = useState(false)
  const [questResult, setQuestResult] = useState<QuestResult | null>(null)
  const [advancedResult, setAdvancedResult] = useState<QuestResult | null>(null)

  useEffect(() => {
    if (!showVoteDetails) return
    const timer = window.setTimeout(() => setShowVoteDetails(false), 3_000)
    return () => window.clearTimeout(timer)
  }, [showVoteDetails])
  useEffect(() => {
    if (questResult === null) return
    const timer = window.setTimeout(() => {
      setAdvancedResult(questResult)
      setQuestResult(null)
    }, 3_000)
    return () => window.clearTimeout(timer)
  }, [questResult])

  const preview = useMemo(() => createPreviewState({
    scenarioID, playerCount, questIndex, submittedCount, submittedCard, disconnected, advancedResult,
  }), [advancedResult, disconnected, playerCount, questIndex, scenarioID, submittedCard, submittedCount])
  const failThreshold = getPlayerCountConfig(playerCount).questFailThresholds[questIndex] ?? 1

  const resetCard = (card: QuestCard | null = null) => {
    setSelectedCard(card)
    setSubmittedCard(null)
    setSubmitting(false)
    setSubmittedCount(1)
    setQuestResult(null)
    setAdvancedResult(null)
  }
  const simulateResult = (succeeded: boolean) => {
    const failCount = succeeded ? Math.max(0, failThreshold - 1) : failThreshold
    const result = {
      questIndex,
      team: preview.game.proposedTeam ?? [],
      successCount: preview.teamSize - failCount,
      failCount,
      succeeded,
    }
    setSubmittedCount(preview.teamSize)
    setSubmitting(false)
    setQuestResult(result)
    setAdvancedResult(null)
  }
  const resetPreview = () => {
    setQuestIndex(0)
    setSubmittedCount(1)
    setSelectedCard(null)
    setSubmittedCard(null)
    setSubmitting(false)
    setDisconnected(true)
    setShowVoteDetails(false)
    setQuestResult(null)
    setAdvancedResult(null)
  }

  const controls = (
    <>
          <h1>执行任务预览</h1>
          <label>玩家人数
            <select onChange={(event) => { setPlayerCount(Number(event.target.value)); resetCard() }} value={playerCount}>
              {[5, 6, 7, 8, 9, 10].map((count) => <option key={count} value={count}>{count} 人</option>)}
            </select>
          </label>
          <label>当前任务
            <select onChange={(event) => { setQuestIndex(Number(event.target.value)); resetCard() }} value={questIndex}>
              {[0, 1, 2, 3, 4].map((index) => <option key={index} value={index}>第 {index + 1} 次任务</option>)}
            </select>
          </label>
          <label>已提交任务牌
            <select onChange={(event) => setSubmittedCount(Number(event.target.value))} value={submittedCount}>
              {Array.from({ length: preview.teamSize + 1 }, (_, count) => <option key={count} value={count}>{count} / {preview.teamSize}</option>)}
            </select>
          </label>
          <label className="room-lobby-preview__controls-check">
            <input checked={disconnected} onChange={(event) => setDisconnected(event.target.checked)} type="checkbox" />2 号玩家掉线
          </label>
          {scenarioID !== 'observer' && (
            <fieldset>
              <legend>本人任务牌</legend>
              <button onClick={() => resetCard()} type="button">未提交</button>
              {scenarioID === 'member-evil' && <button onClick={() => resetCard('success')} type="button">选择成功</button>}
              {scenarioID === 'member-evil' && <button onClick={() => resetCard('fail')} type="button">选择失败</button>}
              <button onClick={() => { if (scenarioID === 'member-evil' && selectedCard === null) setSelectedCard('fail'); setSubmitting(true); setSubmittedCard(null); setAdvancedResult(null) }} type="button">正在确认</button>
              <button onClick={() => { setSubmittedCard(scenarioID === 'member-evil' ? selectedCard ?? 'fail' : 'success'); setSubmittedCount(Math.min(preview.teamSize, submittedCount + 1)); setSubmitting(false); setAdvancedResult(null) }} type="button">模拟提交成功</button>
              <button onClick={() => { setSubmitting(false); pushToast({ message: '任务牌提交失败，请重试', tone: 'error' }) }} type="button">模拟提交失败</button>
            </fieldset>
          )}
          <button onClick={() => setShowVoteDetails(true)} type="button">显示表决明细 3 秒</button>
          <button onClick={() => simulateResult(true)} type="button">模拟任务成功</button>
          <button onClick={() => simulateResult(false)} type="button">模拟任务失败</button>
          {advancedResult !== null && <button onClick={() => { setAdvancedResult(null); setSubmittedCount(1); setSubmittedCard(null) }} type="button">返回当前任务</button>}
          <button onClick={resetPreview} type="button">重置预览</button>
    </>
  )

  const phase = advancedResult === null ? 'quest' : 'teamProposal'
  const players = buildRoomPlayers({
    players: preview.room.players,
    numPlayers: playerCount,
    currentPlayerID: CURRENT_PLAYER_ID,
    phase,
    viewerConnected: true,
    ownerPlayerID: preview.room.ownerPlayerID,
    game: preview.game,
    selectedTeam: [],
    selectedTarget: null,
    showKnownPlayerInfo: false,
    showPrivateRoleKnowledge: false,
    showSettledTeamVoteDetails: showVoteDetails,
    interactionMode: 'none',
  })
  const questProgress = buildQuestProgress(playerCount, preview.game)

  if (advancedResult !== null) {
    const advancedQuestIndex = preview.game.questIndex
    const scene: RoomTeamProposalScene = {
      kind: 'teamProposal',
      matchID: preview.room.matchID,
      playerCount,
      players,
      questProgress,
      questIndex: advancedQuestIndex,
      requiredTeamSize: getQuestTeamSize(playerCount, advancedQuestIndex),
      selectedCount: 0,
      consecutiveRejectedTeams: preview.game.consecutiveRejectedTeams,
      perspective: 'observer',
      canSubmit: false,
      submitRequestState: 'idle',
    }
    return (
      <RoomScreenPreviewShell
        actions={{ onActivatePlayer: () => undefined, onSubmitTeam: () => undefined }}
        controls={controls}
        scene={scene}
      />
    )
  }

  const scene: RoomQuestScene = {
    kind: 'quest',
    matchID: preview.room.matchID,
    playerCount,
    players,
    questProgress: questResult === null
      ? questProgress
      : questProgress.map((node) => node.questIndex === questResult.questIndex
          ? { ...node, state: questResult.succeeded ? 'success' : 'failure' }
          : node),
    questIndex,
    requiredSubmissionCount: preview.teamSize,
    submittedCount,
    view: questResult !== null
      ? {
          kind: 'result',
          succeeded: questResult.succeeded,
          successCount: questResult.successCount,
          failCount: questResult.failCount,
        }
      : scenarioID === 'observer' || submittedCard !== null
        ? {
            kind: 'waiting',
            participation: scenarioID === 'observer' ? 'observer' : 'member',
            submittedCard,
          }
        : {
            kind: 'choosing',
            alignment: scenarioID === 'member-evil' ? 'evil' : 'good',
            selectedCard: scenarioID === 'member-evil' ? selectedCard : 'success',
            canChoose: !submitting,
            submitRequestState: submitting ? 'pending' : 'idle',
          },
  }

  return (
    <RoomScreenPreviewShell
      actions={{
        onSelectCard: (card) => {
          if (scenarioID !== 'member-evil' || submitting || submittedCard !== null) return
          setSelectedCard(card)
        },
        onConfirmCard: () => {
          if (scenarioID === 'observer' || submitting || submittedCard !== null) return
          if (scenarioID === 'member-evil' && selectedCard === null) return
          setSubmitting(true)
        },
      }}
      controls={controls}
      scene={scene}
    />
  )
}
