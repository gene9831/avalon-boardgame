# Avalon Online Board Game Design

Status: accepted for implementation  
Date: 2026-08-14
Last revised: 2026-08-31

## Goal

Build a LAN-hosted online version of the base rules of The Resistance: Avalon for 5–10 browser clients in one room, while supporting multiple independent rooms on the same service. The server is authoritative for rules and hidden information. PostgreSQL provides durable room storage; the first deployment uses one Node game-server process.

## Scope

### Included

- React + TypeScript + Vite browser client.
- boardgame.io 0.50.2 phases, stages, activePlayers, playerView, and Socket.IO.
- Multiple rooms represented by independent boardgame.io matches.
- Atomic room create-and-enter, room listing, server-assigned joining, and waiting-room seat changes.
- Five-player through ten-player room sizes.
- Merlin, Assassin, Loyal Servant of Arthur, Minion of Mordred, Percival, and Morgana. New rooms enable Percival and Morgana as a pair by default and may disable the pair at creation.
- Server-side role assignment and role visibility.
- Server-authoritative opening identity recognition before the first team proposal.
- Simultaneous team votes and quest-card submissions.
- PostgreSQL persistence through a custom boardgame.io asynchronous storage adapter.
- Seat-bound reconnect using boardgame.io player credentials.
- Read-only web Debug mode.
- Tailwind v4 through the Vite plugin, with small amounts of custom CSS retained for theme and card visuals.

### Explicitly excluded

- Mordred, Oberon, Lady of the Lake, and other expansions.
- Accounts, dedicated administrators, room-admin powers, arbitrary state editing, and game rewind.
- Automatic timeout advancement for team proposals, votes, quest cards, or assassination in the first implementation.
- Voice, text chat, AI, ranking, and persistent player profiles.
- Multiple game-server instances, distributed Socket.IO, Pub/Sub, and distributed locks.
- In-memory persistence in the deployed server.

## Domain model

The canonical terms are recorded in [`CONTEXT.md`](../../../CONTEXT.md). A room is one independent match. A seat is the stable position used for player binding; a player is the person occupying that seat. Initial seat assignment chooses the lowest-numbered unoccupied seat, while a seat change immediately moves an existing player to an empty seat before play. The room owner is the player who created the room; ownership follows that player across seat changes and is never inferred from seat 0. A role is the exact character identity, while loyalty is the Good/Evil faction. A team proposal is voted on before its quest cards are collected.

## Runtime architecture

```text
LAN browser
  ├── Vite frontend (:5173 during development)
  ├── Lobby API (:8001)
  └── Socket.IO game transport (:8000)
          │
          └── boardgame.io Server
                  │
                  └── PostgresStorage → PostgreSQL
```

The browser uses strict Avalon room endpoints to create-and-enter, list, join, leave, dissolve, and change seats. It then creates a boardgame.io client with the room's `matchID`, `playerID`, credentials, and Socket.IO transport. Lobby mutations are serialized by match and atomically update authoritative lobby state with boardgame.io metadata. The game server registers the Avalon game once and serves any number of independent matches.

The first deployment uses one Node process. The server's per-match action ordering prevents concurrent actions in one room from corrupting state. PostgreSQL makes room state durable across a game-server restart, but does not by itself make multiple game-server processes safe to run.

## Workspace layout

The pnpm workspace keeps browser, server, shared game, and deployment concerns separate:

```text
apps/web/
  src/                 React browser client
  vite.config.ts       Vite and Tailwind configuration
apps/server/           Node boardgame.io and Socket.IO entrypoint
packages/game/         Shared Avalon game definition and public types
infra/postgres/        Database-only Docker Compose deployment files
docs/                  Rules, architecture decisions, and design records
```

The root package delegates web development, server development, lint, and preview commands to the workspace packages; root `build` and `typecheck` validate both `@avalon/game` and `@avalon/server`. `packages/game` contains the shared boardgame.io rule core and filtered player-view projection. `apps/server` owns the boardgame.io Socket.IO/Lobby runtime and selects PostgreSQL persistence when `DATABASE_URL` is configured, while retaining process-local memory storage only for tests or explicit ephemeral local development. `apps/web` remains the browser client.

## Room lifecycle

1. A player creates an `avalon` room with `numPlayers` from 5 to 10 and a public role configuration. One atomic server operation creates the match, occupies initial seat 0, records that player as owner, and returns the seat credential.
2. Other players list waiting rooms or join with a room code/match ID and their public profile. Join requests do not select a seat; the server assigns the lowest-numbered unoccupied seat at request time.
3. While the room is waiting, a player may click any empty seat to move there immediately. The server atomically rebinds the same credential and public profile to the destination, clears the source, and moves the owner identity when the mover owns the room. Occupied-seat swaps are not supported.
4. Credentials are stored locally by the browser under the room identity. Reload reconnects to the current seat, and all tabs in one browser adopt a successful seat change.
5. The room owner may start only after every seat is occupied. The owner may dissolve the waiting room but cannot leave or transfer ownership; ordinary players may leave only while waiting.
6. `startGame` verifies the current owner and authoritative occupancy, assigns roles and the initial leader on the server using the boardgame.io random plugin, freezes the seating, and enters identity recognition.
7. Identity recognition reveals each player's own role, Evil seats to Evil players, Evil seats to Merlin, and Merlin/Morgana candidate seats to Percival. The Percival step is skipped when the paired role configuration is disabled.
8. Once play begins, joining, leaving, changing seats, dissolving, and owner administration are rejected. A finished room is hidden from the default open-room list but remains in PostgreSQL.

If a player loses their credentials, the seat cannot be reclaimed in the MVP. The owner must remain seated, so losing the owner's credential before starting leaves the room unrecoverable and requires deleting or replacing the room rather than transferring ownership. This is an intentional consequence of account-free seat binding.

## Authoritative game state

The following is the logical shape of `G`; the implementation may split the types into focused modules.

```ts
type AvalonG = {
  status: 'lobby' | 'playing' | 'finished'

  lobby: {
    authorityVersion: 1
    ownerPlayerID: PlayerID
    occupiedPlayerIDs: PlayerID[]
  }

  players: Record<PlayerID, {
    name: string
  }>

  secret: {
    roleByPlayer: Record<PlayerID, Role>
    identityRecognitionConfirmedPlayerIDs: PlayerID[]
    identityRecognitionServerInstanceID: string | null
    pendingVotes: Partial<Record<PlayerID, TeamVote>>
    pendingQuestCards: Partial<Record<PlayerID, QuestCard>>
  }

  leaderID: PlayerID | null
  identityRecognition: {
    step: 'roleReveal' | 'evilRecognition' | 'merlinRecognition' | 'percivalRecognition'
    deadlineAt: number
    confirmedCount: number
    participantCount: number
  } | null
  questIndex: number
  proposedTeam: PlayerID[] | null

  voteHistory: TeamVoteResult[]
  questHistory: QuestResult[]

  consecutiveRejectedTeams: number
  goodSuccesses: number
  evilFailures: number

  rules: {
    roleConfiguration: {
      percivalMorgana: boolean
    }
    timeouts: {
      enabled: boolean
      proposalMs?: number
      voteMs?: number
      questMs?: number
      assassinationMs?: number
    }
  }

  result?: {
    winner: 'good' | 'evil'
    reason: 'three_quests' | 'five_rejections' | 'assassination'
    targetID?: PlayerID
  }
}
```

The server-instance marker and confirmed player IDs never cross `playerView`.
Deadline metadata remains in the state shape for the disabled optional deadline
architecture and is not rendered by the first-release web client.

Lobby authority, occupancy, and role configuration are public authoritative state. Seat credentials remain only in server-side boardgame.io metadata. New rooms use authority version 1 and enable the Percival/Morgana pair by default. A persisted room without role configuration retains the original base roles. A persisted room without lobby authority derives its owner from the current seat 0 occupant and its occupancy from populated metadata; an old waiting room with empty seat 0 is ownerless and not joinable.

The role map and pending choices are server secrets. Before a team vote settles, the filtered player view may expose the player IDs that have submitted as public status metadata, but not their vote choices; each player may still receive their own submitted choice. After a vote is settled, the complete player-to-vote mapping moves atomically into public vote history. After a quest is settled, only the team, Success count, Fail count, and quest result are retained publicly; the mapping from a quest card to a player is discarded.

## Phases, stages, and moves

| Phase | Active players and stage | Move | Completion |
| --- | --- | --- | --- |
| `lobby` | Waiting-room players; only the recorded owner may start | `startGame` | Owner credential valid and every seat occupied; roles and leader assigned; seating freezes; enter `identityRecognition` |
| `identityRecognition` | All players in `identityRecognition`; only the current step's participants may confirm | `confirmIdentityRecognition` | All participants confirm; advance through role, Evil, Merlin, and optional Percival recognition, then enter `teamProposal` |
| `teamProposal` | Current leader in `leader` | `proposeTeam(playerIDs)` | Exact team size, seated players, and no duplicates; enter `teamVote` |
| `teamVote` | All players in `vote` | `castTeamVote(approve)` | One vote per player; settle after all votes |
| `quest` | Proposed team in `quest` | `playQuestCard(result)` | One card per team member; settle after all cards |
| `assassination` | Assassin in `assassin` | `assassinate(targetID)` | Target must be Good; resolve victory |
| `gameOver` | None | None | Read-only result |

Each active player has at most one strategic move in the relevant stage. Identity recognition separately permits a private confirmation. Boardgame.io validates the acting player before the move reaches the game logic; the game logic additionally validates role, phase, and step participation. Private recognition moves use `noLimit` so public active-player move counters remain neutral, and they are removed from client-visible and persisted game logs because either framework metadata channel would otherwise retain the acting player ID. The dormant deadline move retains server-side step/deadline validation and the same metadata and log protection.

### Team vote settlement

- Approval requires a strict majority of all room players.
- A tie rejects the proposal.
- A rejected proposal increments the rejection streak and moves leadership clockwise.
- The fifth consecutive rejection ends the game for Evil.
- An approved proposal clears the rejection streak and enters the quest phase.
- After all votes are collected, each player's vote is public in the resolved vote history.

### Quest settlement

- Good roles can submit only Success.
- Evil roles can submit Success or Fail.
- The submitted cards are shuffled by the server before counting.
- One Fail normally fails a quest.
- For the fourth quest in a room with seven or more players, at least two Fails are required.
- A failed quest increments Evil's score; a successful quest increments Good's score.
- Three failed quests end the game for Evil. Three successful quests enter assassination.
- After a non-terminal quest, leadership moves clockwise and the next quest begins.

### Assassination settlement

- Only the Assassin role can submit the target.
- The target must be a Good player.
- If the target is Merlin, Evil wins; otherwise Good wins.
- Game-over views reveal all roles for post-game verification.

## Player views and hidden information

`playerView` returns a player-specific view rather than the complete `AvalonG`:

- During role reveal, the current player sees their own exact role and no other role knowledge.
- During Evil recognition, Evil players begin seeing the player IDs of other Evil players.
- During Merlin recognition, Merlin begins seeing the player IDs of all Evil players.
- During Percival recognition, Percival receives the two indistinguishable Merlin-candidate player IDs: Merlin and Morgana. No other viewer receives that candidate collection.
- Known faction seats do not expose the exact Assassin, Morgana, or Minion role during play.
- Identity-recognition views expose only whether the current player participates or has confirmed, plus anonymous aggregate progress; they never expose confirmed seat IDs.
- Before a team vote is complete, every player sees which players have submitted and the aggregate submission count, while only the current player sees their own submitted vote choice.
- Before a quest is complete, a player sees only their own submitted card and safe progress information.
- Public team proposals, settled vote history, quest history, score, leader, phase, and result remain visible.
- In `gameOver`, the complete role assignment is exposed.

The Debug mode consumes only this filtered client state and safe context fields. It may show match ID, player ID, connection status, current phase/stage, active players, public history, and submission progress. It never bypasses `playerView` and never renders the complete secret state.

## Reconnect and simultaneous submission behavior

The Socket.IO client reconnects with the same match ID, current player ID, and credentials. The server sends the current player view after synchronization. No move is replayed from the browser's local UI; the server state is authoritative.

Seat changes use the current seat credential and atomically rebind that credential to the empty destination. The source rejects it immediately and the destination accepts it immediately. If a response is lost, the browser probes the source and requested destination to recover the valid player ID. A repeated source-to-destination request is idempotently successful when the destination already holds the same credential. Before the request, a browser-global transition marker pauses other tabs; after settlement, every tab adopts the final room session, and a stale tab may clear storage only when the stored value still exactly matches its invalid session.

Team votes and quest cards are accepted independently while their players are active. The per-match server queue serializes arrival, and `maxMoves: 1` makes a repeated action invalid. A disconnected player leaves these strategic stages incomplete until reconnecting because automatic strategic timeout is disabled.

Identity recognition is non-strategic, but the first release still waits for all step participants to confirm. It shows no countdown and sends no automatic wake-up. Ordinary reconnects preserve the current confirmations. The server retains an internal, default-off deadline option with its original timeline and restart handling for future room configuration.

The role-reveal step first lowers an opaque curtain over the entire round-table stage, then reveals the player's role card and confirmation controls after the curtain settles. Evil, Merlin, and Percival recognition instead raise the curtain for authorized participants so they can inspect the relevant seats; nonparticipants remain behind a continuously opaque, static curtain. The room header stays above the curtain so navigation and connection recovery remain visible and operable.

## In-game information presentation

During an unresolved team vote, each submitted player has a neutral, borderless Lucide `BadgeCheck` outside their nameplate, and the center shows `x/n 已投票`. The current player also retains confirmation of their own approval or rejection. No player sees another vote choice before settlement.

When the last vote arrives, the outside-nameplate markers change simultaneously to green Lucide `CircleCheck` or red Lucide `CircleX` results with one shared subtle transition. The center shows the approval outcome and total approval/rejection counts; individual choices remain visible at the corresponding seats instead of requiring the operation log. An approved vote remains visible while quest cards are pending and disappears when the quest settles. A rejected vote remains visible through the next team-proposal phase and disappears when the next team vote begins. The fifth rejection remains visible on the final result screen. During quest or proposal interaction, the previous result is a compact summary above the active controls and never blocks them.

During active play, the current player's role is not a permanent line in their nameplate. The eye control privately replaces only the current player's decorative avatar with their role artwork, places the role name immediately below the nameplate without affecting layout, and shows any faction knowledge authorized by `playerView`. This reveal never replaces the central quest board, pauses interaction, clears selections, or handles `Escape`; clicking the eye again closes it. A versioned browser-global client setting persists the eye state across refreshes, rooms, phases, and same-browser tabs without storing role data. Identity recognition continues to show its complete role card automatically. At game over, the eye control and private faction markers disappear while every seat automatically reveals its role avatar and role name.

The room owner has a neutral house marker at the avatar's upper-left; ownership remains visible after start but grants no active-game authority. Known Evil information keeps its dark-red lower-right emblem. Percival's two Merlin candidates instead receive identical neutral amber or silver question-mark emblems in that same lower-right knowledge position, and the accessible seat label says `Merlin 候选`. A given viewer cannot receive both knowledge emblems for one seat. Empty seats are immediate-action buttons only while waiting and expose `移至 X 号空座位` as their accessible name.

## Timeout configuration

Room setup accepts a timeout shape so later versions can enable server-authoritative deadlines:

```ts
type TimeoutConfig = {
  enabled: boolean
  proposalMs?: number
  voteMs?: number
  questMs?: number
  assassinationMs?: number
}
```

The default is `{ enabled: false }`. The first implementation does not add a wall-clock timer, timeout move, or automatic default choice to any strategic phase. Enabling those timeouts later requires a separate design decision covering default choices, server-side deadline validation, and recovery when all clients disconnect.

The internal identity-recognition deadline is also disabled by default. A future change may expose it as a separate room-creation option because it ends only a private information display and never creates a game choice. ADR-0006 records the retained server-side architecture.

## PostgreSQL storage

boardgame.io 0.50.2 provides an asynchronous `StorageAPI` but no PostgreSQL adapter. The project implements a small `PostgresStorage` backed by `pg.Pool`.

The logical schema is:

```text
matches
  match_id       text primary key
  game_name      text not null
  metadata       jsonb not null
  state          jsonb not null
  initial_state  jsonb not null
  created_at     timestamptz not null
  updated_at     timestamptz not null

match_logs
  match_id       text references matches(match_id) on delete cascade
  sequence_no    bigint not null
  entry          jsonb not null
  primary key (match_id, sequence_no)
```

The adapter implements `connect`, `createMatch`, `fetch`, `setState`, `setMetadata`, `wipe`, and `listMatches`. `setState` updates the state and appends any delta log entries in one transaction. The server also owns a focused internal lobby mutation that locks one match row and updates authoritative state plus metadata in the same transaction; process-memory test storage provides the same match-queue atomicity. `listMatches` supports boardgame.io's game-name, game-over, and updated-time filters. Room metadata, including reconnect credentials used by boardgame.io, remains server/database data and is never exposed through the normal player view.

The deployment artifact will be a database-only Docker Compose file with a pinned PostgreSQL major version, a named persistent volume, a health check, and configurable database credentials. The game server will receive the connection through `DATABASE_URL`.

## Styling

Tailwind v4 is integrated in `apps/web` through the official `@tailwindcss/vite` plugin. Future layout, status panels, buttons, and responsive structure can use utility classes. Global color variables, game-card visuals, and complex animations may remain in focused CSS files. No component library is required for the MVP.

## Testing strategy

The important permanent tests will cover:

- Base and Percival/Morgana role counts for every player count from 5 through 10.
- Merlin, Percival, Evil, and ordinary Good player views.
- No complete secret state in any player view.
- Team size, duplicate member, and seated-player validation.
- Strict-majority approval and tie rejection.
- Five consecutive rejected proposals.
- Duplicate and non-active-player submissions.
- Pending team-vote submission status without pending vote-choice leakage.
- Simultaneous settled-vote disclosure, seat-level result retention, and phase-specific clearing.
- On-demand current-player role-card presentation without changing role visibility or game state.
- Good cannot submit Fail; Evil can submit either result.
- The seven-or-more-player fourth-quest two-Fail rule.
- Three Good successes, three Evil failures, and assassination outcomes.
- Quest-result aggregation without player/card correspondence.
- PostgreSQL storage round trips for metadata, state, initial state, logs, listing filters, and deletion.
- Multiple match IDs remaining isolated in storage and Socket.IO flows.
- Atomic create-and-enter, lowest-empty-seat joining, owner-following seat changes, concurrency rollback, response-loss recovery, and multi-tab session adoption.
- A Socket.IO smoke test with 5–10 clients connected to one room.

## Acceptance criteria

The design is considered implemented when:

1. Two or more rooms can be created and played independently by different browser groups.
2. A room with 5–10 browser clients can complete the base game flow.
3. A server restart preserves rooms and allows the same seat credentials to reconnect.
4. No browser receives another player's hidden role or pending secret choice.
5. Duplicate submissions and invalid moves do not mutate the authoritative state.
6. The default room list hides finished rooms while PostgreSQL retains them.
7. The read-only Debug mode provides diagnostics without adding game authority.
8. The database-only Docker Compose file can be deployed independently by the user.
9. Tests, build, and lint pass against the final source tree.
10. Team voting shows public per-seat submission status, then direct per-seat settled choices and a central result without requiring the operation log.
11. During play, the current player can reveal their complete role card and authorized faction knowledge on demand without a permanent role label in their nameplate.
12. Creating a room immediately seats and authenticates its owner; joining requires no seat choice and assigns the lowest-numbered unoccupied seat at request time.
13. Any waiting-room player can move immediately to an empty seat; failure preserves the source, and ownership follows the creator rather than seat 0.
14. Only the current room owner may start a completely occupied room or dissolve it, and no owner authority changes active game state.
15. New rooms enable Percival/Morgana by default, old rooms retain base roles, and Percival alone receives two indistinguishable candidate markers without leaking exact roles.
