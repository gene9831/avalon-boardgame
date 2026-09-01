import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { AvalonPlayerView, QuestCard } from '@avalon/game'

import { RoleCard } from '../src/RoleCard'
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
    submittedTeamVotePlayerIDs: [],
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
      knownMerlinCandidatePlayerIDs: [],
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
      onOpenHelp={vi.fn()}
      onPlayQuestCard={vi.fn<(card: QuestCard) => void>()}
      onProposeTeam={vi.fn()}
      onReconnect={vi.fn()}
      onSaveProfile={vi.fn()}
      phase={phase}
      playerID={playerID}
      players={lobbyPlayers}
      profile={{ avatarID: 'merlin', name: 'Alice' }}
      ownerPlayerID="3"
    />,
  )
}

describe('RoomGamePanel operation log', () => {
  it('keeps a public operation-log control in the room header without a badge', () => {
    const html = renderPanel()

    expect(html).toContain('aria-label="打开帮助说明"')
    expect(html).toContain('aria-label="查看对局记录"')
    expect(html).not.toContain('data-unread')
  })
})

describe('RoomGamePanel owner marker', () => {
  it('keeps the neutral owner marker visible after play starts', () => {
    const html = renderPanel()

    expect(html).toMatch(/data-player-id="3"[^>]*[\s\S]*aria-label="房间拥有者"|aria-label="房间拥有者"[\s\S]*data-player-id="3"/)
    expect(html).not.toContain('>解散房间<')
  })
})

describe('RoomGamePanel identity recognition', () => {
  it.each([
    ['percival', '帕西维尔', '正义阵营', '两名梅林候选'],
    ['morgana', '莫甘娜', '邪恶阵营', '帕西维尔眼中伪装成梅林'],
  ] as const)('presents %s with formal role art and Chinese guidance', (role, name, loyalty, guidance) => {
    const html = renderToStaticMarkup(<RoleCard role={role} />)

    expect(html).toContain(`data-role-card="${role}"`)
    expect(html).toContain(`data-role-avatar="${role}"`)
    expect(html).toContain(`${role}.png`)
    expect(html).toContain(name)
    expect(html).toContain(loyalty)
    expect(html).toContain(guidance)
  })

  it('renders two indistinguishable Merlin-candidate badges for Percival', () => {
    const html = renderPanel({
      activeStage: 'identityRecognition',
      game: gameView({
        identityRecognition: {
          step: 'percivalRecognition',
          deadlineAt: Date.now() + 10_000,
          confirmedCount: 0,
          participantCount: 1,
        },
        viewer: {
          role: 'percival',
          loyalty: 'good',
          knownEvilPlayerIDs: [],
          knownMerlinCandidatePlayerIDs: ['0', '4'],
          identityRecognition: {
            isParticipant: true,
            confirmed: false,
            deadlineRefreshRequired: false,
            serverNow: 1_000,
          },
        },
      }),
      phase: 'identityRecognition',
      playerID: '1',
    })
    const badgeClasses = Array.from(
      html.matchAll(/<span aria-label="Merlin 候选" class="([^"]+)">/g),
      (match) => match[1],
    )

    expect(badgeClasses).toHaveLength(2)
    expect(new Set(badgeClasses).size).toBe(1)
    expect(html).toMatch(/data-player-id="0"[^>]*>[\s\S]*?aria-label="Merlin 候选"[\s\S]*?<\/button>/)
    expect(html).toMatch(/data-player-id="4"[^>]*>[\s\S]*?aria-label="Merlin 候选"[\s\S]*?<\/button>/)
    expect(html).toContain('帕西维尔，请睁眼并辨认梅林候选')
    expect(html).toContain('我已辨认梅林候选')
  })

  it('keeps candidate badges private until Percival opens the knowledge control', () => {
    const percivalHtml = renderPanel({
      game: gameView({
        viewer: {
          role: 'percival',
          loyalty: 'good',
          knownEvilPlayerIDs: [],
          knownMerlinCandidatePlayerIDs: ['0', '4'],
        },
      }),
      phase: 'teamProposal',
      playerID: '1',
    })
    const loyalServantHtml = renderPanel({
      game: gameView({
        viewer: {
          role: 'loyal_servant',
          loyalty: 'good',
          knownEvilPlayerIDs: [],
          knownMerlinCandidatePlayerIDs: [],
        },
      }),
      phase: 'teamProposal',
      playerID: '1',
    })

    expect(percivalHtml).not.toContain('aria-label="Merlin 候选"')
    expect(loyalServantHtml).not.toContain('aria-label="Merlin 候选"')
  })

  it('includes candidate knowledge in the marked parent seat accessible names', () => {
    const html = renderPanel({
      activeStage: 'identityRecognition',
      game: gameView({
        identityRecognition: {
          step: 'percivalRecognition',
          deadlineAt: Date.now() + 10_000,
          confirmedCount: 0,
          participantCount: 1,
        },
        viewer: {
          role: 'percival',
          loyalty: 'good',
          knownEvilPlayerIDs: [],
          knownMerlinCandidatePlayerIDs: ['0', '4'],
          identityRecognition: {
            isParticipant: true,
            confirmed: false,
            deadlineRefreshRequired: false,
            serverNow: 1_000,
          },
        },
      }),
      phase: 'identityRecognition',
      playerID: '1',
    })

    expect(html).toContain('aria-label="Alice，队长，任务队员，Merlin 候选"')
    expect(html).toContain('aria-label="Eve，Merlin 候选"')
  })

  it('removes private candidate badges at game over', () => {
    const html = renderPanel({
      activeStage: undefined,
      game: gameView({
        status: 'finished',
        result: { winner: 'good', reason: 'assassination', targetID: '1' },
        revealedRoles: {
          '0': 'merlin',
          '1': 'percival',
          '2': 'loyal_servant',
          '3': 'assassin',
          '4': 'morgana',
        },
        viewer: {
          role: 'percival',
          loyalty: 'good',
          knownEvilPlayerIDs: [],
          knownMerlinCandidatePlayerIDs: ['0', '4'],
        },
      }),
      phase: 'assassination',
      playerID: '1',
    })

    expect(html).not.toContain('aria-label="Merlin 候选"')
  })

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
    expect(html).not.toContain('aria-label="查看我的身份与已知信息"')
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

  it('leaves the phase action area empty during identity recognition', () => {
    const html = renderPanel({
      activeStage: 'identityRecognition',
      game: gameView({
        identityRecognition: {
          step: 'evilRecognition',
          deadlineAt: Date.now() + 10_000,
          confirmedCount: 0,
          participantCount: 2,
        },
      }),
      phase: 'identityRecognition',
    })

    expect(html).not.toContain('正在同步游戏状态')
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
    expect(html).not.toContain('data-visible-role="assassin"')
    expect(html.match(/data-player-avatar=/g)).toHaveLength(6)
    expect(html).not.toContain('你的身份：刺客')
    expect(html).toContain('aria-label="查看我的身份与已知信息"')
    expect(html).toContain('aria-controls="current-player-avatar"')
    expect(html).not.toContain('current-player-role-card')
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

    expect(html).toContain('aria-label="Alice，队长，任务队员"')
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

describe('RoomGamePanel team vote presentation', () => {
  it('shows public submitters and aggregate progress without other choices', () => {
    const html = renderPanel({
      activeStage: 'vote',
      game: gameView({
        submittedTeamVotePlayerIDs: ['0', '3'],
        viewer: {
          role: 'loyal_servant',
          loyalty: 'good',
          knownEvilPlayerIDs: [],
          submittedVote: 'approve',
        },
      }),
      phase: 'teamVote',
    })

    expect(html).toContain('2/5 已投票')
    expect(html.match(/data-team-vote-status="pending"/g)).toHaveLength(2)
    expect(html.match(/lucide-badge-check/g)).toHaveLength(2)
    expect(html.match(/title="已投票"/g)).toHaveLength(2)
    expect(html).not.toContain('team-vote-seat-status')
    expect(html).toContain('你已选择：赞成')
    expect(html).toContain('Dylan，任务队员，已投票')
    expect(html).not.toContain('Dylan，反对')
  })

  it('shows every settled choice at its seat and totals above quest controls', () => {
    const html = renderPanel({
      game: gameView({
        voteHistory: [{
          proposerID: '0',
          questIndex: 0,
          team: ['0', '3'],
          votes: {
            '0': 'approve',
            '1': 'approve',
            '2': 'approve',
            '3': 'reject',
            '4': 'reject',
          },
          approved: true,
        }],
      }),
      phase: 'quest',
    })

    expect(html.match(/data-team-vote-status="approve"/g)).toHaveLength(3)
    expect(html.match(/data-team-vote-status="reject"/g)).toHaveLength(2)
    expect(html.match(/lucide-circle-check/g)).toHaveLength(3)
    expect(html.match(/lucide-circle-x/g)).toHaveLength(2)
    expect(html.match(/title="赞成"/g)).toHaveLength(3)
    expect(html.match(/title="反对"/g)).toHaveLength(2)
    expect(html).not.toContain('team-vote-seat-status')
    expect(html).toContain('队伍通过 · 3 赞成 / 2 反对')
    expect(html).toContain('Bob，赞成')
    expect(html).toContain('Dylan，任务队员，反对')
    expect(html).toContain('让任务成功')
  })

  it('keeps the fifth rejection totals on the result screen', () => {
    const html = renderPanel({
      activeStage: undefined,
      game: gameView({
        status: 'finished',
        result: { winner: 'evil', reason: 'five_rejections' },
        voteHistory: [{
          proposerID: '0',
          questIndex: 0,
          team: ['0', '3'],
          votes: {
            '0': 'approve',
            '1': 'approve',
            '2': 'reject',
            '3': 'reject',
            '4': 'reject',
          },
          approved: false,
        }],
      }),
      phase: 'teamVote',
    })

    expect(html).toContain('队伍否决 · 2 赞成 / 3 反对')
    expect(html.match(/data-team-vote-status="reject"/g)).toHaveLength(3)
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
    expect(html.match(/data-role-avatar=/g)).toHaveLength(5)
    expect(html).not.toContain('aria-label="查看我的身份与已知信息"')
    expect(html).not.toContain('aria-label="隐藏我的身份与已知信息"')
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
