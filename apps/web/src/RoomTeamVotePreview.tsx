import { useMemo, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { getPlayerCountConfig, type AvalonPlayerView, type PlayerID, type Role, type TeamVote } from '@avalon/game'

import type { AvalonMatch, LobbyPlayer } from './lobby'
import { getQuestTeamSize } from './room-game'
import { buildQuestProgress, buildRoomPlayers, buildRoomTeamTokens } from './room-presentation'
import type { RoomGameResultScene, RoomQuestScene, RoomTeamProposalScene, RoomTeamVoteScene } from './room-screen-props'
import { RoomScreenPreviewShell } from './RoomScreenPreviewShell'
import { useToast } from './toast-context'

const CURRENT_PLAYER_ID = '2' as PlayerID
const PLAYER_NAMES = ['苍', '雾林守望者', '银', '来自卡美洛的无名骑士', '青岚', '暮色远征者', '白鹿', '暮鸦议会记录官', '荆棘', '霜塔守夜人']
const PREVIEW_ROLES: readonly Role[] = ['merlin', 'percival', 'loyal_servant', 'loyal_servant', 'assassin', 'minion', 'loyal_servant', 'minion', 'loyal_servant', 'minion']
function createPlayers(playerCount: number, disconnected: boolean): LobbyPlayer[] {
  return Array.from({ length: playerCount }, (_, id) => ({
    id,
    name: `${PLAYER_NAMES[id]} ${id + 1}`,
    isConnected: !disconnected || id !== 1,
  }))
}

function createPreviewState(input: Readonly<{
  playerCount: number
  questIndex: number
  consecutiveRejectedTeams: number
  disconnected: boolean
  otherSubmittedCount: number
  submittedVote: TeamVote | null
}>): { room: AvalonMatch; game: AvalonPlayerView } {
  const players = createPlayers(input.playerCount, input.disconnected)
  const ownerPlayerID = '0' as PlayerID
  const occupiedPlayerIDs = players.map(({ id }) => String(id) as PlayerID)
  const requiredTeamSize = getQuestTeamSize(input.playerCount, input.questIndex)
  const proposedTeam = [CURRENT_PLAYER_ID, ...occupiedPlayerIDs.filter((id) => id !== CURRENT_PLAYER_ID)].slice(0, requiredTeamSize)
  const otherSubmittedPlayerIDs = occupiedPlayerIDs
    .filter((id) => id !== CURRENT_PLAYER_ID)
    .slice(0, input.otherSubmittedCount)
  const submittedTeamVotePlayerIDs = input.submittedVote === null
    ? otherSubmittedPlayerIDs
    : [...otherSubmittedPlayerIDs, CURRENT_PLAYER_ID]
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
  const room: AvalonMatch = {
    gameName: 'avalon',
    matchID: `team-vote-preview-${input.playerCount}`,
    players,
    setupData: { numPlayers: input.playerCount },
    ownerPlayerID,
    occupiedPlayerIDs,
    roleConfiguration: { percivalMorgana: true },
  }

  return {
    room,
    game: {
      status: 'playing',
      lobby: { authorityVersion: 1, ownerPlayerID, occupiedPlayerIDs },
      players: Object.fromEntries(players.map((player) => [String(player.id), { name: player.name! }])),
      identityRecognition: null,
      leaderID: ownerPlayerID,
      questIndex: input.questIndex,
      proposedTeam,
      submittedTeamVotePlayerIDs,
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
        ...(input.submittedVote === null ? {} : { submittedVote: input.submittedVote }),
      },
    },
  }
}

function previewRoles(playerCount: number): Record<PlayerID, Role> {
  return Object.fromEntries(Array.from({ length: playerCount }, (_, index) => [String(index), PREVIEW_ROLES[index]!])) as Record<PlayerID, Role>
}

function postVoteGame(
  game: AvalonPlayerView,
  playerCount: number,
  result: Readonly<{ approved: boolean; approvalCount: number; rejectionCount: number; continueIntent: 'continue' | 'gameResult' }>,
): AvalonPlayerView {
  const playerIDs = Array.from({ length: playerCount }, (_, index) => String(index) as PlayerID)
  const votes = Object.fromEntries(playerIDs.map((playerID, index) => [
    playerID,
    index < result.approvalCount ? 'approve' : 'reject',
  ])) as Record<PlayerID, TeamVote>
  const voteHistory = [...game.voteHistory, {
    proposerID: game.leaderID ?? undefined,
    questIndex: game.questIndex,
    team: game.proposedTeam ?? [],
    votes,
    approved: result.approved,
  }]
  const viewer = {
    role: game.viewer.role,
    loyalty: game.viewer.loyalty,
    knownEvilPlayerIDs: game.viewer.knownEvilPlayerIDs,
    knownMerlinCandidatePlayerIDs: game.viewer.knownMerlinCandidatePlayerIDs,
  }
  if (result.continueIntent === 'gameResult') {
    return {
      ...game, status: 'finished', voteHistory, proposedTeam: null,
      submittedTeamVotePlayerIDs: [], submittedQuestCardCount: 0,
      consecutiveRejectedTeams: 5, viewer,
      result: { winner: 'evil', reason: 'five_rejections' },
      revealedRoles: previewRoles(playerCount),
    }
  }
  return {
    ...game, voteHistory, proposedTeam: result.approved ? game.proposedTeam : null,
    submittedTeamVotePlayerIDs: [], submittedQuestCardCount: 0,
    consecutiveRejectedTeams: result.approved ? 0 : game.consecutiveRejectedTeams + 1,
    leaderID: result.approved ? game.leaderID : String((Number(game.leaderID) + 1) % playerCount),
    viewer,
  }
}

export function RoomTeamVotePreview() {
  const { scenarioID } = useParams()
  if (scenarioID !== 'voter') return <Navigate replace to="/dev/room-layout" />
  return <TeamVotePreviewScenario />
}

function TeamVotePreviewScenario() {
  const { pushToast } = useToast()
  const [playerCount, setPlayerCount] = useState(5)
  const [questIndex, setQuestIndex] = useState(0)
  const [consecutiveRejectedTeams, setConsecutiveRejectedTeams] = useState(0)
  const [otherSubmittedCount, setOtherSubmittedCount] = useState(2)
  const [selectedVote, setSelectedVote] = useState<TeamVote | null>(null)
  const [submittedVote, setSubmittedVote] = useState<TeamVote | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [disconnected, setDisconnected] = useState(true)
  const [result, setResult] = useState<Readonly<{ approved: boolean; approvalCount: number; rejectionCount: number; continueIntent: 'continue' | 'gameResult' }> | null>(null)
  const [advancedScene, setAdvancedScene] = useState<'quest' | 'proposal' | 'gameResult' | null>(null)
  const preview = useMemo(() => createPreviewState({
    playerCount,
    questIndex,
    consecutiveRejectedTeams,
    disconnected,
    otherSubmittedCount,
    submittedVote,
  }), [consecutiveRejectedTeams, disconnected, otherSubmittedCount, playerCount, questIndex, submittedVote])
  const resetVote = (vote: TeamVote | null = null) => {
    setSelectedVote(vote)
    setSubmittedVote(null)
    setSubmitting(false)
  }
  const resetPreview = () => {
    setQuestIndex(0)
    setConsecutiveRejectedTeams(0)
    setOtherSubmittedCount(2)
    setDisconnected(true)
    resetVote()
    setResult(null)
    setAdvancedScene(null)
  }

  const scene: RoomTeamVoteScene = {
    kind: 'teamVote',
    matchID: preview.room.matchID,
    playerCount,
    players: buildRoomPlayers({
      players: preview.room.players,
      numPlayers: playerCount,
      currentPlayerID: CURRENT_PLAYER_ID,
      phase: 'teamVote',
      viewerConnected: true,
      ownerPlayerID: preview.room.ownerPlayerID,
      game: preview.game,
      selectedTeam: [],
      selectedTarget: null,
      showKnownPlayerInfo: false,
      showPrivateRoleKnowledge: false,
      interactionMode: 'none',
    }),
    questProgress: buildQuestProgress(playerCount, preview.game),
    questIndex,
    submittedCount: preview.game.submittedTeamVotePlayerIDs.length,
    participantCount: playerCount,
    consecutiveRejectedTeams,
    teamTokens: buildRoomTeamTokens(preview.room, preview.game.proposedTeam ?? []),
    view: result !== null
      ? { kind: 'result', ...result }
      : submittedVote === null
      ? {
          kind: 'choosing',
          selectedVote,
          canChoose: !submitting,
          submitRequestState: submitting ? 'pending' : 'idle',
        }
      : { kind: 'waiting', submittedVote },
  }
  const controls = (
    <>
          <h1>投票阶段预览</h1>
          <label>
            玩家人数
            <select onChange={(event) => { const count = Number(event.target.value); setPlayerCount(count); setOtherSubmittedCount(Math.min(2, count - 1)); resetVote() }} value={playerCount}>
              {[5, 6, 7, 8, 9, 10].map((count) => <option key={count} value={count}>{count} 人</option>)}
            </select>
          </label>
          <label>
            当前任务
            <select onChange={(event) => setQuestIndex(Number(event.target.value))} value={questIndex}>
              {[0, 1, 2, 3, 4].map((index) => <option key={index} value={index}>第 {index + 1} 次任务</option>)}
            </select>
          </label>
          <label>
            连续否决
            <select onChange={(event) => setConsecutiveRejectedTeams(Number(event.target.value))} value={consecutiveRejectedTeams}>
              {[0, 1, 2, 3, 4].map((count) => <option key={count} value={count}>{count} / 5</option>)}
            </select>
          </label>
          <label>
            其他玩家已投票
            <select onChange={(event) => setOtherSubmittedCount(Number(event.target.value))} value={otherSubmittedCount}>
              {Array.from({ length: playerCount }, (_, count) => <option key={count} value={count}>{count} 人</option>)}
            </select>
          </label>
          <label className="room-lobby-preview__controls-check">
            <input checked={disconnected} onChange={(event) => setDisconnected(event.target.checked)} type="checkbox" />
            2 号玩家掉线
          </label>
          <fieldset>
            <legend>本人投票</legend>
            <button onClick={() => resetVote()} type="button">未选择</button>
            <button onClick={() => resetVote('approve')} type="button">选择同意</button>
            <button onClick={() => resetVote('reject')} type="button">选择反对</button>
            <button onClick={() => { resetVote('approve'); setSubmitting(true) }} type="button">正在确认</button>
            <button onClick={() => { setSelectedVote(null); setSubmittedVote('approve'); setSubmitting(false) }} type="button">已确认同意</button>
            <button onClick={() => { setSelectedVote(null); setSubmittedVote('reject'); setSubmitting(false) }} type="button">已确认反对</button>
          </fieldset>
          {submitting && (
            <>
              <button onClick={() => { setSubmittedVote(selectedVote ?? 'approve'); setSelectedVote(null); setSubmitting(false) }} type="button">模拟提交成功</button>
              <button onClick={() => { setSubmitting(false); pushToast({ message: '确认投票失败，请重试。', tone: 'error' }) }} type="button">模拟提交失败</button>
            </>
          )}
          <fieldset>
            <legend>结算结果</legend>
            <button onClick={() => { setResult({ approved: true, approvalCount: Math.ceil(playerCount / 2), rejectionCount: Math.floor(playerCount / 2), continueIntent: 'continue' }); setAdvancedScene(null) }} type="button">模拟队伍通过</button>
            <button onClick={() => { setResult({ approved: false, approvalCount: Math.floor(playerCount / 2), rejectionCount: Math.ceil(playerCount / 2), continueIntent: consecutiveRejectedTeams === 4 ? 'gameResult' : 'continue' }); setAdvancedScene(null) }} type="button">模拟队伍被否决</button>
          </fieldset>
          <button onClick={resetPreview} type="button">重置预览</button>
    </>
  )

  if (advancedScene !== null) {
    const postGame = postVoteGame(preview.game, playerCount, result ?? {
      approved: advancedScene === 'quest', approvalCount: 0, rejectionCount: 0,
      continueIntent: advancedScene === 'gameResult' ? 'gameResult' : 'continue',
    })
    if (advancedScene === 'quest') {
      const players = buildRoomPlayers({
        players: preview.room.players, numPlayers: playerCount, currentPlayerID: CURRENT_PLAYER_ID,
        phase: 'quest', viewerConnected: true, ownerPlayerID: preview.room.ownerPlayerID, game: postGame,
        selectedTeam: [], selectedTarget: null, showKnownPlayerInfo: false, showPrivateRoleKnowledge: false,
        showSettledTeamVoteDetails: false, interactionMode: 'none',
      })
      const questScene: RoomQuestScene = {
        kind: 'quest', matchID: preview.room.matchID, playerCount, players, questProgress: buildQuestProgress(playerCount, postGame),
        questIndex: postGame.questIndex, requiredSubmissionCount: postGame.proposedTeam?.length ?? 0, submittedCount: 0,
        failThreshold: getPlayerCountConfig(playerCount).questFailThresholds[questIndex] ?? 1,
        view: { kind: 'waiting', participation: 'observer', submittedCard: null },
      }
      return <RoomScreenPreviewShell actions={{ onSelectCard: () => undefined, onConfirmCard: () => undefined, onContinue: () => undefined }} controls={controls} scene={questScene} />
    }
    if (advancedScene === 'proposal') {
      const players = buildRoomPlayers({
        players: preview.room.players, numPlayers: playerCount, currentPlayerID: CURRENT_PLAYER_ID,
        phase: 'teamProposal', viewerConnected: true, ownerPlayerID: preview.room.ownerPlayerID, game: postGame,
        selectedTeam: [], selectedTarget: null, showKnownPlayerInfo: false, showPrivateRoleKnowledge: false,
        showSettledTeamVoteDetails: false, interactionMode: 'none',
      })
      const proposalScene: RoomTeamProposalScene = {
        kind: 'teamProposal', matchID: preview.room.matchID, playerCount, players, questProgress: buildQuestProgress(playerCount, postGame),
        questIndex: postGame.questIndex, requiredTeamSize: getQuestTeamSize(playerCount, postGame.questIndex), selectedCount: 0,
        consecutiveRejectedTeams: postGame.consecutiveRejectedTeams, perspective: 'observer', canSubmit: false, submitRequestState: 'idle',
      }
      return <RoomScreenPreviewShell actions={{ onActivatePlayer: () => undefined, onSubmitTeam: () => undefined }} controls={controls} scene={proposalScene} />
    }
    const players = buildRoomPlayers({
      players: preview.room.players, numPlayers: playerCount, currentPlayerID: CURRENT_PLAYER_ID,
      phase: 'finished', viewerConnected: true, ownerPlayerID: null, game: postGame,
      selectedTeam: [], selectedTarget: null, showKnownPlayerInfo: false, showPrivateRoleKnowledge: false,
      showRoleReveal: true, showRoundDecorations: false, showConnectionStatus: false, interactionMode: 'none',
    })
    const gameResult: RoomGameResultScene = {
      kind: 'gameResult', matchID: preview.room.matchID, playerCount, players, questProgress: buildQuestProgress(playerCount, postGame, false),
      winner: 'evil', reason: '连续否决 5 支队伍', questScore: '任务 0 成功 / 0 失败',
    }
    return <RoomScreenPreviewShell actions={null} controls={controls} scene={gameResult} />
  }

  return (
    <RoomScreenPreviewShell
      actions={{
        onSelectVote: (vote) => resetVote(vote),
        onConfirmVote: () => {
          if (selectedVote !== null && submittedVote === null) setSubmitting(true)
        },
        onContinue: () => {
          if (result === null) return
          setAdvancedScene(result.continueIntent === 'gameResult' ? 'gameResult' : result.approved ? 'quest' : 'proposal')
        },
      }}
      controls={controls}
      scene={scene}
    />
  )
}
