/// <reference path="./boardgame-io-esm.d.ts" />

import { INVALID_MOVE } from 'boardgame.io/dist/esm/core.js'
import type { Game, Plugin } from 'boardgame.io'

import { getPlayerCountConfig } from './config'
import { buildRoleDeck, assignRoles, loyaltyForRole } from './roles'
import { getAvalonPlayerView } from './player-view'
import { getIdentityRecognitionParticipantIDs } from './identity-recognition'
import type {
  AvalonG,
  AvalonResult,
  AvalonSetupData,
  IdentityRecognitionStep,
  PlayerID,
  QuestCard,
  TeamVote,
} from './types'

function createPlayers(
  playerIDs: readonly string[],
  setupPlayers: AvalonSetupData['players'],
) {
  return Object.fromEntries(
    playerIDs.map((playerID) => [
      playerID,
      setupPlayers?.[playerID] ?? { name: `Player ${Number(playerID) + 1}` },
    ]),
  )
}

function createInitialGame(
  playerIDs: readonly string[],
  setupData?: AvalonSetupData,
): AvalonG {
  return {
    status: 'lobby',
    players: createPlayers(playerIDs, setupData?.players),
    secret: {
      roleByPlayer: {},
      identityRecognitionConfirmedPlayerIDs: [],
      identityRecognitionServerInstanceID: null,
      pendingVotes: {},
      pendingQuestCards: {},
    },
    identityRecognition: null,
    leaderID: null,
    questIndex: 0,
    proposedTeam: null,
    voteHistory: [],
    questHistory: [],
    consecutiveRejectedTeams: 0,
    goodSuccesses: 0,
    evilFailures: 0,
    rules: {
      timeouts: setupData?.timeouts ?? { enabled: false },
    },
  }
}

function validateSetupData(
  setupData: AvalonSetupData | undefined,
  numPlayers: number,
) {
  if (numPlayers < 5 || numPlayers > 10) {
    return `Unsupported Avalon player count: ${numPlayers}`
  }

  if (setupData?.players !== undefined) {
    const playerIDs = Object.keys(setupData.players)
    const expectedPlayerIDs = Array.from(
      { length: numPlayers },
      (_, index) => String(index),
    )

    if (
      playerIDs.length !== expectedPlayerIDs.length ||
      expectedPlayerIDs.some((playerID) => !playerIDs.includes(playerID))
    ) {
      return 'Setup players must contain every seated player ID exactly once'
    }
  }

  return undefined
}

function nextPlayerID(
  playerIDs: readonly PlayerID[],
  currentPlayerID: PlayerID | null,
) {
  const currentIndex = currentPlayerID === null
    ? -1
    : playerIDs.indexOf(currentPlayerID)
  return playerIDs[(currentIndex + 1) % playerIDs.length]
}

function finishGame(
  G: AvalonG,
  result: AvalonResult,
  endGame: (gameover?: unknown) => void,
) {
  G.status = 'finished'
  G.result = result
  endGame(result)
}

const IDENTITY_RECOGNITION_STEPS: readonly IdentityRecognitionStep[] = [
  'roleReveal',
  'evilRecognition',
  'merlinRecognition',
]

const identityRecognitionLogPrivacyPlugin: Plugin = {
  name: 'identityRecognitionLogPrivacy',
  setup: () => ({}),
  dangerouslyFlushRawState: ({ state }) => {
    const containsPrivateRecognitionAction = state.deltalog?.some((entry) => {
      const actionType = entry.action.payload.type
      return actionType === 'confirmIdentityRecognition' ||
        actionType === 'advanceIdentityRecognition'
    })

    return containsPrivateRecognitionAction
      ? { ...state, deltalog: [] }
      : state
  },
}

function createAvalonGameDefinition(
  options: AvalonGameOptions,
): Game<AvalonG, Record<string, never>, AvalonSetupData> {
  const now = options.now ?? Date.now
  const identityRecognitionDeadlineEnabled =
    options.identityRecognitionDeadlineEnabled ?? false
  const identityRecognitionStepMs = options.identityRecognitionStepMs ?? 10_000
  const serverInstanceID = options.serverInstanceID ?? 'default'
  const enterIdentityRecognitionStep = (
    G: AvalonG,
    step: IdentityRecognitionStep,
    deadlineAt = now() + identityRecognitionStepMs,
  ) => {
    const participantIDs = getIdentityRecognitionParticipantIDs(
      step,
      G.secret.roleByPlayer,
    )
    G.secret.identityRecognitionConfirmedPlayerIDs = []
    G.identityRecognition = {
      step,
      deadlineAt,
      confirmedCount: 0,
      participantCount: participantIDs.length,
    }
  }
  const advanceIdentityRecognition = (
    G: AvalonG,
    setPhase: (phase: string) => void,
    nextDeadlineAt?: number,
  ) => {
    const currentStep = G.identityRecognition?.step
    const currentIndex = currentStep === undefined
      ? -1
      : IDENTITY_RECOGNITION_STEPS.indexOf(currentStep)
    const nextStep = IDENTITY_RECOGNITION_STEPS[currentIndex + 1]

    if (nextStep !== undefined) {
      enterIdentityRecognitionStep(G, nextStep, nextDeadlineAt)
      return
    }

    G.secret.identityRecognitionConfirmedPlayerIDs = []
    G.secret.identityRecognitionServerInstanceID = null
    G.identityRecognition = null
    setPhase('teamProposal')
  }
  const refreshIdentityRecognitionForServerInstance = (
    G: AvalonG,
    currentNow: number,
  ) => {
    const recognition = G.identityRecognition
    if (
      recognition === null ||
      G.secret.identityRecognitionServerInstanceID === serverInstanceID
    ) {
      return false
    }

    G.secret.identityRecognitionServerInstanceID = serverInstanceID
    G.secret.identityRecognitionConfirmedPlayerIDs = []
    recognition.confirmedCount = 0
    recognition.deadlineAt = currentNow + identityRecognitionStepMs
    return true
  }

  return {
  name: 'avalon',
  minPlayers: 5,
  maxPlayers: 10,
  disableUndo: true,
  plugins: [identityRecognitionLogPrivacyPlugin],
  validateSetupData,
  setup: ({ ctx }, setupData) =>
    createInitialGame(ctx.playOrder, setupData),
  playerView: ({ G, playerID }) =>
    getAvalonPlayerView(
      G,
      playerID,
      serverInstanceID,
      now(),
      identityRecognitionDeadlineEnabled,
    ),
  phases: {
    lobby: {
      start: true,
      turn: {
        order: {
          first: () => 0,
          next: () => undefined,
        },
        activePlayers: {
          currentPlayer: { stage: 'start', minMoves: 1, maxMoves: 1 },
        },
        stages: {
          start: {
            moves: {
              startGame: {
                client: false,
                move: ({ G, ctx, events, random, playerID }) => {
                  if (playerID !== '0' || G.status !== 'lobby') {
                    return INVALID_MOVE
                  }

                  const roles = random.Shuffle(buildRoleDeck(ctx.numPlayers))
                  G.secret.roleByPlayer = assignRoles(ctx.playOrder, roles)
                  G.secret.identityRecognitionConfirmedPlayerIDs = []
                  G.secret.identityRecognitionServerInstanceID =
                    serverInstanceID
                  G.status = 'playing'
                  G.leaderID = ctx.playOrder[random.Die(ctx.numPlayers) - 1]
                  enterIdentityRecognitionStep(G, 'roleReveal')
                  events.setPhase('identityRecognition')
                },
              },
            },
          },
        },
      },
    },
    identityRecognition: {
      turn: {
        activePlayers: {
          all: { stage: 'identityRecognition' },
        },
        stages: {
          identityRecognition: {
            moves: {
              confirmIdentityRecognition: {
                client: false,
                move: ({ G, events, playerID }) => {
                  const recognition = G.identityRecognition
                  if (recognition === null) return INVALID_MOVE
                  const currentNow = now()

                  if (
                    identityRecognitionDeadlineEnabled &&
                    refreshIdentityRecognitionForServerInstance(G, currentNow)
                  ) {
                    return
                  }

                  if (
                    identityRecognitionDeadlineEnabled &&
                    currentNow >= recognition.deadlineAt
                  ) {
                    advanceIdentityRecognition(
                      G,
                      events.setPhase,
                      recognition.deadlineAt + identityRecognitionStepMs,
                    )
                    return
                  }

                  const participantIDs = getIdentityRecognitionParticipantIDs(
                    recognition.step,
                    G.secret.roleByPlayer,
                  )
                  const confirmedPlayerIDs =
                    G.secret.identityRecognitionConfirmedPlayerIDs
                  if (
                    !participantIDs.includes(playerID) ||
                    confirmedPlayerIDs.includes(playerID)
                  ) {
                    return INVALID_MOVE
                  }

                  confirmedPlayerIDs.push(playerID)
                  recognition.confirmedCount = confirmedPlayerIDs.length
                  if (confirmedPlayerIDs.length === participantIDs.length) {
                    advanceIdentityRecognition(G, events.setPhase)
                  }
                },
              },
              advanceIdentityRecognition: {
                client: false,
                ignoreStaleStateID: true,
                move: (
                  { G, events },
                  expectedStep: IdentityRecognitionStep,
                  expectedDeadlineAt: number,
                ) => {
                  const recognition = G.identityRecognition
                  if (recognition === null) return INVALID_MOVE
                  if (!identityRecognitionDeadlineEnabled) return INVALID_MOVE
                  const currentNow = now()

                  if (
                    refreshIdentityRecognitionForServerInstance(G, currentNow)
                  ) {
                    return
                  }

                  if (
                    recognition.step !== expectedStep ||
                    recognition.deadlineAt !== expectedDeadlineAt
                  ) {
                    return
                  }

                  if (currentNow < recognition.deadlineAt) return INVALID_MOVE
                  advanceIdentityRecognition(
                    G,
                    events.setPhase,
                    recognition.deadlineAt + identityRecognitionStepMs,
                  )
                },
              },
            },
          },
        },
      },
    },
    teamProposal: {
      turn: {
        order: {
          first: ({ G, ctx }) => {
            const leaderIndex = G.leaderID
              ? ctx.playOrder.indexOf(G.leaderID)
              : -1
            return leaderIndex >= 0 ? leaderIndex : 0
          },
          next: ({ G, ctx }) => {
            const leaderIndex = G.leaderID
              ? ctx.playOrder.indexOf(G.leaderID)
              : -1
            return leaderIndex >= 0 ? leaderIndex : 0
          },
        },
        activePlayers: {
          currentPlayer: { stage: 'leader', minMoves: 1, maxMoves: 1 },
        },
        stages: {
          leader: {
            moves: {
              proposeTeam: {
                client: false,
                move: ({ G, ctx, events, playerID }, team: PlayerID[]) => {
                  if (G.leaderID !== playerID || G.proposedTeam !== null) {
                    return INVALID_MOVE
                  }

                  const { questTeamSizes } = getPlayerCountConfig(ctx.numPlayers)
                  const requiredTeamSize = questTeamSizes[G.questIndex]
                  const seatedPlayerIDs = new Set(ctx.playOrder)

                  if (
                    !Array.isArray(team) ||
                    team.length !== requiredTeamSize ||
                    new Set(team).size !== team.length ||
                    team.some((memberID) => !seatedPlayerIDs.has(memberID))
                  ) {
                    return INVALID_MOVE
                  }

                  G.proposedTeam = [...team]
                  G.secret.pendingVotes = {}
                  events.setPhase('teamVote')
                },
              },
            },
          },
        },
      },
    },
    teamVote: {
      turn: {
        activePlayers: {
          all: { stage: 'vote', minMoves: 1, maxMoves: 1 },
        },
        stages: {
          vote: {
            moves: {
              castTeamVote: {
                client: false,
                move: ({ G, ctx, events, playerID }, vote: TeamVote) => {
                  if (
                    (vote !== 'approve' && vote !== 'reject') ||
                    G.proposedTeam === null ||
                    G.secret.pendingVotes[playerID] !== undefined
                  ) {
                    return INVALID_MOVE
                  }

                  G.secret.pendingVotes[playerID] = vote
                  if (Object.keys(G.secret.pendingVotes).length !== ctx.numPlayers) {
                    return
                  }

                  const votes = {
                    ...G.secret.pendingVotes,
                  } as Record<PlayerID, TeamVote>
                  const approvalCount = Object.values(votes).filter(
                    (currentVote) => currentVote === 'approve',
                  ).length
                  const approved = approvalCount > ctx.numPlayers / 2

                  G.voteHistory.push({
                    questIndex: G.questIndex,
                    team: [...G.proposedTeam],
                    votes,
                    approved,
                  })
                  G.secret.pendingVotes = {}

                  if (approved) {
                    G.consecutiveRejectedTeams = 0
                    events.setPhase('quest')
                    return
                  }

                  G.consecutiveRejectedTeams += 1
                  G.proposedTeam = null

                  if (G.consecutiveRejectedTeams >= 5) {
                    finishGame(
                      G,
                      { winner: 'evil', reason: 'five_rejections' },
                      events.endGame,
                    )
                    return
                  }

                  G.leaderID = nextPlayerID(ctx.playOrder, G.leaderID)
                  events.setPhase('teamProposal')
                },
              },
            },
          },
        },
      },
    },
    quest: {
      turn: {
        activePlayers: {
          all: { stage: 'quest', minMoves: 1, maxMoves: 1 },
        },
        onBegin: ({ G, events }) => {
          const team = G.proposedTeam ?? []
          events.setActivePlayers({
            value: Object.fromEntries(
              team.map((playerID) => [
                playerID,
                { stage: 'quest', minMoves: 1, maxMoves: 1 },
              ]),
            ),
          })
        },
        stages: {
          quest: {
            moves: {
              playQuestCard: {
                client: false,
                move: ({
                  G,
                  ctx,
                  events,
                  random,
                  playerID,
                }, card: QuestCard) => {
                  const team = G.proposedTeam
                  const role = G.secret.roleByPlayer[playerID]

                  if (
                    (card !== 'success' && card !== 'fail') ||
                    team === null ||
                    !team.includes(playerID) ||
                    role === undefined ||
                    G.secret.pendingQuestCards[playerID] !== undefined ||
                    (loyaltyForRole(role) === 'good' && card === 'fail')
                  ) {
                    return INVALID_MOVE
                  }

                  G.secret.pendingQuestCards[playerID] = card
                  if (
                    Object.keys(G.secret.pendingQuestCards).length !==
                    team.length
                  ) {
                    return
                  }

                  const submittedCards = team
                    .map((memberID) => G.secret.pendingQuestCards[memberID])
                    .filter((submittedCard): submittedCard is QuestCard =>
                      submittedCard !== undefined,
                    )
                  const shuffledCards = random.Shuffle(submittedCards)
                  const failCount = shuffledCards.filter(
                    (submittedCard) => submittedCard === 'fail',
                  ).length
                  const successCount = shuffledCards.length - failCount
                  const failThreshold = getPlayerCountConfig(
                    ctx.numPlayers,
                  ).questFailThresholds[G.questIndex]
                  const succeeded = failCount < failThreshold
                  const resolvedQuestIndex = G.questIndex

                  G.questHistory.push({
                    questIndex: resolvedQuestIndex,
                    team: [...team],
                    successCount,
                    failCount,
                    succeeded,
                  })
                  G.secret.pendingQuestCards = {}
                  G.proposedTeam = null
                  G.questIndex += 1

                  if (succeeded) {
                    G.goodSuccesses += 1
                  } else {
                    G.evilFailures += 1
                  }

                  if (G.evilFailures >= 3) {
                    finishGame(
                      G,
                      { winner: 'evil', reason: 'three_quests' },
                      events.endGame,
                    )
                    return
                  }

                  if (G.goodSuccesses >= 3) {
                    events.setPhase('assassination')
                    return
                  }

                  G.leaderID = nextPlayerID(ctx.playOrder, G.leaderID)
                  events.setPhase('teamProposal')
                },
              },
            },
          },
        },
      },
    },
    assassination: {
      turn: {
        activePlayers: {
          all: { stage: 'assassin', minMoves: 1, maxMoves: 1 },
        },
        onBegin: ({ G, events }) => {
          const assassinID = Object.entries(G.secret.roleByPlayer).find(
            ([, role]) => role === 'assassin',
          )?.[0]
          events.setActivePlayers({
            value:
              assassinID === undefined
                ? {}
                : {
                    [assassinID]: {
                      stage: 'assassin',
                      minMoves: 1,
                      maxMoves: 1,
                    },
                  },
          })
        },
        stages: {
          assassin: {
            moves: {
              assassinate: {
                client: false,
                move: ({ G, ctx, events, playerID }, targetID: PlayerID) => {
                  const assassinRole = G.secret.roleByPlayer[playerID]
                  const targetRole = G.secret.roleByPlayer[targetID]

                  if (
                    assassinRole !== 'assassin' ||
                    !ctx.playOrder.includes(targetID) ||
                    targetRole === undefined ||
                    loyaltyForRole(targetRole) === 'evil'
                  ) {
                    return INVALID_MOVE
                  }

                  finishGame(
                    G,
                    {
                      winner: targetRole === 'merlin' ? 'evil' : 'good',
                      reason: 'assassination',
                      targetID,
                    },
                    events.endGame,
                  )
                },
              },
            },
          },
        },
      },
    },
    },
  }
}

export interface AvalonGameOptions {
  identityRecognitionDeadlineEnabled?: boolean
  identityRecognitionStepMs?: number
  now?: () => number
  seed?: string | number
  serverInstanceID?: string
}

export function createAvalonGame(options: AvalonGameOptions = {}) {
  return {
    ...createAvalonGameDefinition(options),
    seed: options.seed,
  }
}

export const AvalonGame = createAvalonGame()
