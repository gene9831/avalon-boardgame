import { INVALID_MOVE } from 'boardgame.io/core'
import type { Game } from 'boardgame.io'

import { getPlayerCountConfig } from './config'
import { buildRoleDeck, assignRoles, loyaltyForRole } from './roles'
import { getAvalonPlayerView } from './player-view'
import type {
  AvalonG,
  AvalonResult,
  AvalonSetupData,
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
      pendingVotes: {},
      pendingQuestCards: {},
    },
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

export const AvalonGame: Game<AvalonG, Record<string, never>, AvalonSetupData> = {
  name: 'avalon',
  minPlayers: 5,
  maxPlayers: 10,
  disableUndo: true,
  validateSetupData,
  setup: ({ ctx }, setupData) =>
    createInitialGame(ctx.playOrder, setupData),
  playerView: ({ G, playerID }) => getAvalonPlayerView(G, playerID),
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
              startGame: ({ G, ctx, events, random, playerID }) => {
                if (playerID !== '0' || G.status !== 'lobby') {
                  return INVALID_MOVE
                }

                const roles = random.Shuffle(buildRoleDeck(ctx.numPlayers))
                G.secret.roleByPlayer = assignRoles(ctx.playOrder, roles)
                G.status = 'playing'
                G.leaderID = ctx.playOrder[random.Die(ctx.numPlayers) - 1]
                events.setPhase('teamProposal')
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
              proposeTeam: ({ G, ctx, events, playerID }, team: PlayerID[]) => {
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
    teamVote: {
      turn: {
        activePlayers: {
          all: { stage: 'vote', minMoves: 1, maxMoves: 1 },
        },
        stages: {
          vote: {
            moves: {
              castTeamVote: ({ G, ctx, events, playerID }, vote: TeamVote) => {
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
              playQuestCard: ({
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
              assassinate: ({ G, ctx, events, playerID }, targetID: PlayerID) => {
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
}
