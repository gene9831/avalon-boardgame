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
    identityRecognition: null,
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
  lobbyPlayers = players,
  phase = 'quest',
  playerID = '0',
}: {
  activeStage?: string
  game?: AvalonPlayerView
  lobbyPlayers?: typeof players
  phase?: string
  playerID?: string
} = {}) {
  return renderToStaticMarkup(
    <RoomGamePanel
      activeStage={activeStage}
      connected
      game={game}
      manualReconnectAvailable={false}
      logEntries={[{ group: '游戏开始', id: 'game-start', kind: 'game-start', title: 'Alice（1号位）开始了游戏' }]}
      matchID="room-123"
      onAssassinate={vi.fn()}
      onBackHome={vi.fn()}
      onCastTeamVote={vi.fn()}
      onConfirmIdentityRecognition={vi.fn()}
      onPlayQuestCard={vi.fn<(card: QuestCard) => void>()}
      onProposeTeam={vi.fn()}
      onReconnect={vi.fn()}
      onSaveProfile={vi.fn()}
      phase={phase}
      playerID={playerID}
      players={lobbyPlayers}
      profile={{ avatarID: 'merlin', name: 'Alice' }}
    />,
  )
}

describe('RoomGamePanel operation log', () => {
  it('keeps a public operation-log control in the room header without a badge', () => {
    const html = renderPanel()

    expect(html).toContain('aria-label="查看对局记录"')
    expect(html).not.toContain('data-unread')
  })
})

describe('RoomGamePanel identity recognition', () => {
  it('lowers an opaque curtain before showing the first role card', () => {
    const html = renderPanel({
      activeStage: 'identityRecognition',
      game: gameView({
        identityRecognition: {
          step: 'roleReveal',
          deadlineAt: Date.now() + 10_000,
          confirmedCount: 0,
          participantCount: 5,
        },
        viewer: {
          role: 'merlin',
          loyalty: 'good',
          knownEvilPlayerIDs: [],
          identityRecognition: {
            isParticipant: true,
            confirmed: false,
            deadlineRefreshRequired: false,
            serverNow: 1_000,
          },
        },
      }),
      phase: 'identityRecognition',
    })

    expect(html).toContain('data-curtain-state="lowered"')
    expect(html).toContain('data-table-visibility="hidden"')
    expect(html).toContain('identity-role-reveal-curtain')
    expect(html).toContain('identity-role-reveal-content')
    expect(html).toContain('查看你的身份')
    expect(html).toContain('梅林')
    expect(html).toContain('正义阵营')
    expect(html).toContain('我已确认身份')
    expect(html).not.toContain('秒')
    expect(html).not.toContain('aria-label="显示已知角色信息"')
  })

  it('keeps non-participants behind an opaque curtain with anonymous progress', () => {
    const html = renderPanel({
      activeStage: 'identityRecognition',
      game: gameView({
        identityRecognition: {
          step: 'evilRecognition',
          deadlineAt: Date.now() + 10_000,
          confirmedCount: 1,
          participantCount: 2,
        },
        viewer: {
          role: 'loyal_servant',
          loyalty: 'good',
          knownEvilPlayerIDs: [],
          identityRecognition: {
            isParticipant: false,
            confirmed: false,
            deadlineRefreshRequired: false,
            serverNow: 1_000,
          },
        },
      }),
      phase: 'identityRecognition',
    })

    expect(html).toContain('data-curtain-state="closed"')
    expect(html).toContain('邪恶阵营，请睁眼并辨认同伴')
    expect(html).toContain('1/2 已确认')
    expect(html).not.toContain('秒')
    expect(html).not.toContain('我已辨认同伴')
  })

  it('does not shift the first role card with extra waiting copy', () => {
    const html = renderPanel({
      activeStage: 'identityRecognition',
      game: gameView({
        identityRecognition: {
          step: 'roleReveal',
          deadlineAt: Date.now() + 10_000,
          confirmedCount: 1,
          participantCount: 5,
        },
        viewer: {
          role: 'merlin',
          loyalty: 'good',
          knownEvilPlayerIDs: [],
          identityRecognition: {
            isParticipant: true,
            confirmed: true,
            deadlineRefreshRequired: false,
            serverNow: 1_000,
          },
        },
      }),
      phase: 'identityRecognition',
    })

    expect(html).toContain('>等待其他玩家确认<')
    expect(html).toContain('disabled=""')
    expect(html).not.toContain('等待其他玩家确认身份')
  })

  it('keeps recognition information visible with only a fixed waiting button', () => {
    const html = renderPanel({
      activeStage: 'identityRecognition',
      game: gameView({
        identityRecognition: {
          step: 'evilRecognition',
          deadlineAt: Date.now() + 10_000,
          confirmedCount: 1,
          participantCount: 2,
        },
        viewer: {
          role: 'assassin',
          loyalty: 'evil',
          knownEvilPlayerIDs: ['4'],
          identityRecognition: {
            isParticipant: true,
            confirmed: true,
            deadlineRefreshRequired: false,
            serverNow: 1_000,
          },
        },
      }),
      phase: 'identityRecognition',
      playerID: '3',
    })

    expect(html).toContain('data-curtain-state="raised"')
    expect(html).toContain('data-known-player-info="true"')
    expect(html).toContain('role="status"')
    expect(html).toContain('aria-live="polite"')
    expect(html).toContain('>等待其他玩家确认<')
    expect(html).toContain('disabled=""')
    expect(html).not.toContain('等待其他邪恶阵营玩家')
  })
})

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
    expect(html).toContain('data-visible-role="assassin"')
    expect(html.match(/data-player-avatar=/g)).toHaveLength(6)
    expect(html).toContain('>刺客<')
    expect(html).toContain('aria-label="显示已知角色信息"')
    expect(html).not.toContain('你知道的邪恶阵营：Eve')
    expect(html).not.toContain('data-visible-role="minion"')
    expect(html).not.toContain('<aside')
    expect(html).not.toContain('>重连<')
  })
})

describe('RoomGamePanel team selection', () => {
  it.each([
    ['teamProposal', 'leader', '组建任务队伍'],
    ['teamVote', 'vote', '队伍表决'],
    ['quest', 'quest', '执行任务'],
    ['assassination', 'assassin', '刺杀梅林'],
    ['identityRecognition', 'identityRecognition', '身份辨认'],
  ])('uses the canonical %s phase label', (phase, activeStage, expectedLabel) => {
    const html = renderPanel({ activeStage, phase })

    expect(html).toContain(expectedLabel)
    expect(html).not.toContain('Round table')
  })

  it('uses rulebook terminology for team selection and voting actions', () => {
    const proposalHtml = renderPanel({
      activeStage: 'leader',
      game: gameView({ proposedTeam: null }),
      phase: 'teamProposal',
    })
    const voteHtml = renderPanel({ activeStage: 'vote', phase: 'teamVote' })

    expect(proposalHtml).toContain('选择 2 名任务队员')
    expect(proposalHtml).toContain('选择圆桌上的玩家')
    expect(proposalHtml).toContain('确认队伍 0/2')
    expect(voteHtml).toContain('赞成队伍')
    expect(voteHtml).toContain('反对队伍')
  })

  it('names selectable seats as task-team controls', () => {
    const html = renderPanel({
      activeStage: 'leader',
      game: gameView({ proposedTeam: null }),
      phase: 'teamProposal',
    })

    expect(html.match(/aria-label="选择 Alice 加入任务队伍，队长"/g)).toHaveLength(1)
    expect(html.match(/aria-label="选择 Eve 加入任务队伍"/g)).toHaveLength(1)
    expect(html).not.toContain('♛ 队长')
  })

  it('keeps visual seat states available to assistive technology', () => {
    const html = renderPanel({
      activeStage: 'vote',
      game: gameView(),
      phase: 'teamVote',
    })

    expect(html).toContain('aria-label="Alice，你的身份：忠臣，队长，任务队员"')
    expect(html).toContain('aria-label="Dylan，任务队员"')

    const disconnectedHtml = renderPanel({
      activeStage: 'vote',
      game: gameView(),
      lobbyPlayers: players.map((player) => player.id === 2 ? { ...player, isConnected: false } : player),
      phase: 'teamVote',
    })
    expect(disconnectedHtml).toContain('aria-label="Claire，已断线"')
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

    expect(html).toContain('第 1 次任务失败 · 1 张成功 · 1 张失败')
    expect(html).not.toContain('Alice：成功')
    expect(html).not.toContain('Dylan：失败')
    expect(html).not.toContain('Quest tableau')
    expect(html).not.toContain('Success')
    expect(html).not.toContain('Fail')
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

    expect(html).toContain('aria-label="选择 Alice 作为刺杀目标，队长"')
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
    expect(html).toContain('对局结束')
    expect(html).toContain('目标 Bob')
    expect(html).not.toContain('目标 Player 2')
    expect(html).toContain('Alice · 梅林')
    expect(html).toContain('Dylan · 刺客')
    expect(html.match(/data-visible-role=/g)).toHaveLength(5)
  })
})

describe('RoomGamePanel connection recovery', () => {
  it('shows recovery progress before offering the manual reconnect action', () => {
    const html = renderToStaticMarkup(
      <RoomGamePanel
        activeStage="leader"
        connected={false}
        game={gameView({ proposedTeam: null })}
        manualReconnectAvailable={false}
        matchID="room-123"
        onAssassinate={vi.fn()}
        onBackHome={vi.fn()}
        onCastTeamVote={vi.fn()}
        onConfirmIdentityRecognition={vi.fn()}
        onPlayQuestCard={vi.fn()}
        onProposeTeam={vi.fn()}
        onReconnect={vi.fn()}
        onSaveProfile={vi.fn()}
        phase="teamProposal"
        playerID="0"
        players={players}
        profile={{ avatarID: 'merlin', name: 'Alice' }}
      />,
    )

    expect(html).toContain('正在重新连接')
    expect(html).not.toContain('>重连<')
  })

  it('offers manual reconnect in the header after automatic recovery has stalled', () => {
    const html = renderToStaticMarkup(
      <RoomGamePanel
        activeStage="leader"
        connected={false}
        game={gameView({ proposedTeam: null })}
        manualReconnectAvailable
        matchID="room-123"
        onAssassinate={vi.fn()}
        onBackHome={vi.fn()}
        onCastTeamVote={vi.fn()}
        onConfirmIdentityRecognition={vi.fn()}
        onPlayQuestCard={vi.fn()}
        onProposeTeam={vi.fn()}
        onReconnect={vi.fn()}
        onSaveProfile={vi.fn()}
        phase="teamProposal"
        playerID="0"
        players={players}
        profile={{ avatarID: 'merlin', name: 'Alice' }}
      />,
    )

    expect(html).toContain('>重连<')
    expect(html.indexOf('>重连<')).toBeLessThan(html.indexOf('aria-label="5 人游戏圆桌"'))
  })
})
