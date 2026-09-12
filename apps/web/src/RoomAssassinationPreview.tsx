import { useEffect, useMemo, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import type { AvalonPlayerView, PlayerID, Role } from '@avalon/game'

import type { AvalonMatch, LobbyPlayer } from './lobby'
import type { AssassinationOutcome } from './room-assassination-preview-model'
import { buildQuestProgress, buildRoomPlayers } from './room-screen-model'
import type { RoomAssassinationScene, RoomGameResultScene } from './room-screen-props'
import { RoomScreenPreviewShell } from './RoomScreenPreviewShell'
import { useToast } from './toast-context'

type AssassinationPreviewScenarioID = 'assassin' | 'evil' | 'good'

const SCENARIO_IDS: readonly AssassinationPreviewScenarioID[] = ['assassin', 'evil', 'good']
const CURRENT_PLAYER_ID = '2' as PlayerID
const PLAYER_NAMES = ['苍', '雾林守望者', '银', '来自卡美洛的无名骑士', '青岚']
function isScenarioID(value: string | undefined): value is AssassinationPreviewScenarioID {
  return value !== undefined && SCENARIO_IDS.includes(value as AssassinationPreviewScenarioID)
}

function rolesForScenario(scenarioID: AssassinationPreviewScenarioID): Record<PlayerID, Role> {
  if (scenarioID === 'assassin') {
    return { '0': 'merlin', '1': 'percival', '2': 'assassin', '3': 'loyal_servant', '4': 'minion' }
  }
  if (scenarioID === 'evil') {
    return { '0': 'merlin', '1': 'percival', '2': 'minion', '3': 'loyal_servant', '4': 'assassin' }
  }
  return { '0': 'merlin', '1': 'percival', '2': 'loyal_servant', '3': 'minion', '4': 'assassin' }
}

function createPlayers(disconnected: boolean): LobbyPlayer[] {
  return PLAYER_NAMES.map((name, id) => ({
    id,
    name: `${name} ${id + 1}`,
    isConnected: !disconnected || id !== 1,
  }))
}

function createPreviewState(input: Readonly<{
  scenarioID: AssassinationPreviewScenarioID
  disconnected: boolean
  finalOutcome: AssassinationOutcome | null
}>): { room: AvalonMatch; game: AvalonPlayerView; roles: Record<PlayerID, Role> } {
  const players = createPlayers(input.disconnected)
  const ownerPlayerID = '0' as PlayerID
  const occupiedPlayerIDs = players.map(({ id }) => String(id) as PlayerID)
  const roles = rolesForScenario(input.scenarioID)
  const questHistory = [
    { questIndex: 0, team: ['0', '1'], successCount: 2, failCount: 0, succeeded: true },
    { questIndex: 1, team: ['1', '2', '3'], successCount: 3, failCount: 0, succeeded: true },
    { questIndex: 2, team: ['0', '2'], successCount: 2, failCount: 0, succeeded: true },
  ]
  const viewerRole = roles[CURRENT_PLAYER_ID]
  const viewerLoyalty = input.scenarioID === 'good' ? 'good' : 'evil'
  const knownEvilPlayerIDs = viewerLoyalty === 'evil'
    ? occupiedPlayerIDs.filter((playerID) => playerID !== CURRENT_PLAYER_ID && ['assassin', 'minion'].includes(roles[playerID]))
    : []
  const room: AvalonMatch = {
    gameName: 'avalon', matchID: `assassination-preview-${input.scenarioID}`,
    players, setupData: { numPlayers: 5 }, ownerPlayerID, occupiedPlayerIDs,
    roleConfiguration: { percivalMorgana: true },
  }

  return {
    room,
    roles,
    game: {
      status: input.finalOutcome === null ? 'playing' : 'finished',
      lobby: { authorityVersion: 1, ownerPlayerID, occupiedPlayerIDs },
      players: Object.fromEntries(players.map((player) => [String(player.id), { name: player.name! }])),
      identityRecognition: null,
      leaderID: '0', questIndex: 2, proposedTeam: ['0', '2'],
      submittedTeamVotePlayerIDs: [], submittedQuestCardCount: 0,
      voteHistory: [{
        proposerID: '0', questIndex: 2, team: ['0', '2'], approved: true,
        votes: { '0': 'approve', '1': 'approve', '2': 'reject', '3': 'approve', '4': 'approve' },
      }],
      questHistory,
      consecutiveRejectedTeams: 0, goodSuccesses: 3, evilFailures: 0,
      rules: { roleConfiguration: room.roleConfiguration, timeouts: { enabled: false } },
      viewer: {
        role: viewerRole, loyalty: viewerLoyalty, knownEvilPlayerIDs,
        knownMerlinCandidatePlayerIDs: [],
      },
      ...(input.finalOutcome === null ? {} : {
        result: {
          winner: input.finalOutcome.winner,
          reason: 'assassination' as const,
          targetID: input.finalOutcome.targetID,
        },
        revealedRoles: roles,
      }),
    },
  }
}

export function RoomAssassinationPreview() {
  const { scenarioID } = useParams()
  if (!isScenarioID(scenarioID)) return <Navigate replace to="/dev/room-layout" />
  return <AssassinationPreviewScenario scenarioID={scenarioID} />
}

function AssassinationPreviewScenario({ scenarioID }: { scenarioID: AssassinationPreviewScenarioID }) {
  const { pushToast } = useToast()
  const [selectedTarget, setSelectedTarget] = useState<PlayerID | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [disconnected, setDisconnected] = useState(true)
  const [outcome, setOutcome] = useState<AssassinationOutcome | null>(null)
  const [finalOutcome, setFinalOutcome] = useState<AssassinationOutcome | null>(null)

  useEffect(() => {
    if (outcome === null) return
    const timer = window.setTimeout(() => {
      setFinalOutcome(outcome)
      setOutcome(null)
    }, 3_000)
    return () => window.clearTimeout(timer)
  }, [outcome])

  const preview = useMemo(() => createPreviewState({ scenarioID, disconnected, finalOutcome }), [disconnected, finalOutcome, scenarioID])

  const resetPreview = () => {
    setSelectedTarget(null)
    setSubmitting(false)
    setDisconnected(true)
    setOutcome(null)
    setFinalOutcome(null)
  }
  const simulateOutcome = (hit: boolean) => {
    const targetID = hit ? ('0' as PlayerID) : ('1' as PlayerID)
    const targetRole = preview.roles[targetID]
    setSelectedTarget(targetID)
    setSubmitting(false)
    setFinalOutcome(null)
    setOutcome({ targetID, targetRole, hit, winner: hit ? 'evil' : 'good' })
  }

  const controls = (
    <>
          <h1>刺杀阶段预览</h1>
          <label className="room-lobby-preview__controls-check">
            <input checked={disconnected} onChange={(event) => setDisconnected(event.target.checked)} type="checkbox" />2 号玩家掉线
          </label>
          {scenarioID === 'assassin' && (
            <fieldset>
              <legend>刺杀选择</legend>
              <button onClick={() => { setSelectedTarget(null); setSubmitting(false); setOutcome(null); setFinalOutcome(null) }} type="button">未选择</button>
              <button onClick={() => { setSelectedTarget('0'); setSubmitting(false); setOutcome(null); setFinalOutcome(null) }} type="button">选择梅林</button>
              <button onClick={() => { setSelectedTarget('1'); setSubmitting(false); setOutcome(null); setFinalOutcome(null) }} type="button">选择其他正义玩家</button>
              <button onClick={() => { setSelectedTarget('0'); setSubmitting(true); setOutcome(null); setFinalOutcome(null) }} type="button">正在确认</button>
              <button onClick={() => { setSubmitting(false); pushToast({ message: '刺杀提交失败，请重试', tone: 'error' }) }} type="button">模拟提交失败</button>
            </fieldset>
          )}
          <button onClick={() => simulateOutcome(true)} type="button">模拟刺杀命中</button>
          <button onClick={() => simulateOutcome(false)} type="button">模拟刺杀未命中</button>
          <button onClick={resetPreview} type="button">重置预览</button>
    </>
  )

  if (finalOutcome !== null) {
    const scene: RoomGameResultScene = {
      kind: 'gameResult',
      matchID: preview.room.matchID,
      playerCount: 5,
      players: buildRoomPlayers({
        players: preview.room.players,
        numPlayers: 5,
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
      questProgress: buildQuestProgress(5, preview.game, false),
      winner: finalOutcome.winner,
      reason: finalOutcome.hit ? '刺杀命中梅林' : '刺杀未命中',
      questScore: '任务 3 成功 / 0 失败',
    }
    return <RoomScreenPreviewShell actions={null} controls={controls} scene={scene} />
  }

  const selectable = scenarioID === 'assassin' && outcome === null
  const basePlayers = buildRoomPlayers({
    players: preview.room.players,
    numPlayers: 5,
    currentPlayerID: CURRENT_PLAYER_ID,
    phase: 'assassination',
    viewerConnected: true,
    ownerPlayerID: preview.room.ownerPlayerID,
    game: preview.game,
    selectedTeam: [],
    selectedTarget: scenarioID === 'assassin' ? selectedTarget : null,
    showKnownPlayerInfo: true,
    showPrivateRoleKnowledge: false,
    showRoundDecorations: false,
    interactionMode: selectable ? 'selectAssassinationTarget' : 'none',
  })
  const scene: RoomAssassinationScene = {
    kind: 'assassination',
    matchID: preview.room.matchID,
    playerCount: 5,
    players: outcome === null
      ? basePlayers
      : basePlayers.map((player) => player.playerID === outcome.targetID
          ? {
              ...player,
              portrait: { kind: 'roleArtwork', role: outcome.targetRole },
              emphasis: 'target',
            }
          : player),
    questProgress: buildQuestProgress(5, preview.game, false),
    view: outcome !== null
      ? {
          kind: 'result',
          targetPlayerID: outcome.targetID,
          targetRole: outcome.targetRole,
          hit: outcome.hit,
          winner: outcome.winner,
        }
      : scenarioID === 'assassin'
        ? {
            kind: 'selecting',
            targetPlayerID: selectedTarget,
            canSubmit: !submitting && selectedTarget !== null,
            submitRequestState: submitting ? 'pending' : 'idle',
          }
        : { kind: 'observing', perspective: scenarioID },
  }

  return (
    <RoomScreenPreviewShell
      actions={{
        onActivatePlayer: (playerID) => {
          if (scenarioID !== 'assassin' || submitting || outcome !== null) return
          setSelectedTarget(playerID)
        },
        onAssassinate: () => {
          if (scenarioID === 'assassin' && selectedTarget !== null) setSubmitting(true)
        },
      }}
      controls={controls}
      scene={scene}
    />
  )
}
