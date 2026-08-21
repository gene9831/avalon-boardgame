import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { AvalonPlayerView, QuestCard } from '@avalon/game'

import { RoomGamePanel } from '../src/RoomGamePanel'

const players = [
  { id: 0, name: 'Alice', isConnected: true },
  { id: 1, name: 'Bob', isConnected: true },
  { id: 2, name: 'Claire', isConnected: true },
  { id: 3, name: 'Dylan', isConnected: true },
  { id: 4, name: 'Eve', isConnected: true },
]

function gameView(overrides: Partial<AvalonPlayerView> = {}): AvalonPlayerView {
  return {
    status: 'playing',
    players: Object.fromEntries(players.map((player) => [String(player.id), { name: `Player ${player.id + 1}` }])),
    leaderID: '0',
    questIndex: 0,
    proposedTeam: ['0', '3'],
    voteHistory: [],
    questHistory: [],
    consecutiveRejectedTeams: 0,
    goodSuccesses: 0,
    evilFailures: 0,
    rules: { timeouts: { enabled: false } },
    viewer: {
      role: 'loyal_servant',
      loyalty: 'good',
      knownEvilPlayerIDs: [],
    },
    ...overrides,
  }
}

function renderPanel({
  activeStage = 'quest',
  game = gameView(),
  phase = 'quest',
  playerID = '0',
}: {
  activeStage?: string
  game?: AvalonPlayerView
  phase?: string
  playerID?: string
} = {}) {
  return renderToStaticMarkup(
    <RoomGamePanel
      activeStage={activeStage}
      connected
      game={game}
      matchID="room-123"
      onAssassinate={vi.fn()}
      onBackHome={vi.fn()}
      onCastTeamVote={vi.fn()}
      onPlayQuestCard={vi.fn<(card: QuestCard) => void>()}
      onProposeTeam={vi.fn()}
      onReconnect={vi.fn()}
      phase={phase}
      playerID={playerID}
      players={players}
    />,
  )
}

describe('RoomGamePanel quest hand', () => {
  it('gives a Good quest member only the Success action', () => {
    const html = renderPanel()

    expect(html).toContain('让任务成功')
    expect(html).not.toContain('让任务失败')
  })

  it('gives an Evil quest member both quest card actions', () => {
    const html = renderPanel({
      game: gameView({
        viewer: {
          role: 'assassin',
          loyalty: 'evil',
          knownEvilPlayerIDs: ['4'],
        },
      }),
      playerID: '3',
    })

    expect(html).toContain('让任务成功')
    expect(html).toContain('让任务失败')
    expect(html).toContain('你知道的邪恶阵营：Eve')
  })
})

describe('RoomGamePanel public quest history', () => {
  it('shows settled card totals without associating them with players', () => {
    const html = renderPanel({
      activeStage: 'leader',
      game: gameView({
        questIndex: 1,
        proposedTeam: null,
        questHistory: [{
          questIndex: 0,
          team: ['0', '3'],
          successCount: 1,
          failCount: 1,
          succeeded: false,
        }],
      }),
      phase: 'teamProposal',
    })

    expect(html).toContain('第 1 次任务失败 · 1 Success / 1 Fail')
    expect(html).not.toContain('Alice：Success')
    expect(html).not.toContain('Dylan：Fail')
  })
})

describe('RoomGamePanel assassination', () => {
  it('offers the Assassin only players they know are not Evil as targets', () => {
    const html = renderPanel({
      activeStage: 'assassin',
      game: gameView({
        proposedTeam: null,
        viewer: {
          role: 'assassin',
          loyalty: 'evil',
          knownEvilPlayerIDs: ['4'],
        },
      }),
      phase: 'assassination',
      playerID: '3',
    })

    expect(html).toContain('aria-label="选择 Alice 作为刺杀目标"')
    expect(html).toContain('aria-label="选择 Claire 作为刺杀目标"')
    expect(html).not.toContain('aria-label="选择 Dylan 作为刺杀目标"')
    expect(html).not.toContain('aria-label="选择 Eve 作为刺杀目标"')
  })
})

describe('RoomGamePanel result', () => {
  it('shows the winner, assassination outcome, and revealed roles', () => {
    const html = renderPanel({
      activeStage: undefined,
      game: gameView({
        status: 'finished',
        result: { winner: 'good', reason: 'assassination', targetID: '1' },
        revealedRoles: {
          '0': 'merlin',
          '1': 'loyal_servant',
          '2': 'loyal_servant',
          '3': 'assassin',
          '4': 'minion',
        },
      }),
      phase: 'assassination',
    })

    expect(html).toContain('正义阵营获胜')
    expect(html).toContain('刺杀未命中梅林')
    expect(html).toContain('游戏结束')
    expect(html).toContain('目标 Bob')
    expect(html).not.toContain('目标 Player 2')
    expect(html).toContain('Alice · 梅林')
    expect(html).toContain('Dylan · 刺客')
  })
})
