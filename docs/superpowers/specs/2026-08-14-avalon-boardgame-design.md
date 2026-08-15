# Avalon Online Board Game Design

Status: accepted for implementation  
Date: 2026-08-14

## Goal

Build a LAN-hosted online version of the base rules of The Resistance: Avalon for 5–10 browser clients in one room, while supporting multiple independent rooms on the same service. The server is authoritative for rules and hidden information. PostgreSQL provides durable room storage; the first deployment uses one Node game-server process.

## Scope

### Included

- React + TypeScript + Vite browser client.
- boardgame.io 0.50.2 phases, stages, activePlayers, playerView, and Socket.IO.
- Multiple rooms represented by independent boardgame.io matches.
- Lobby create/list/join flow.
- Five-player through ten-player room sizes.
- Merlin, Assassin, Loyal Servant of Arthur, and Minion of Mordred.
- Server-side role assignment and role visibility.
- Simultaneous team votes and quest-card submissions.
- PostgreSQL persistence through a custom boardgame.io asynchronous storage adapter.
- Seat-bound reconnect using boardgame.io player credentials.
- Read-only web Debug mode.
- Tailwind v4 through the Vite plugin, with small amounts of custom CSS retained for theme and card visuals.

### Explicitly excluded

- Percival, Morgana, Mordred, Oberon, Lady of the Lake, and other expansions.
- Accounts, dedicated administrators, room-admin powers, arbitrary state editing, and game rewind.
- Automatic timeout advancement in the first implementation.
- Voice, text chat, AI, ranking, and persistent player profiles.
- Multiple game-server instances, distributed Socket.IO, Pub/Sub, and distributed locks.
- In-memory persistence in the deployed server.

## Domain model

The canonical terms are recorded in [`CONTEXT.md`](../../../CONTEXT.md). A room is one independent match. A seat is the stable position used for player binding; a player is the person occupying that seat. A role is the exact character identity, while loyalty is the Good/Evil faction. A team proposal is voted on before its quest cards are collected.

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

The browser uses `LobbyClient` to create, list, and join rooms. It then creates a boardgame.io client with the room's `matchID`, `playerID`, credentials, and Socket.IO transport. The game server registers the Avalon game once and serves any number of independent matches.

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

The root package delegates development, lint, and preview commands to `@avalon/web`; root `build` and `typecheck` also validate `@avalon/game`. `packages/game` now contains the shared boardgame.io rule core and filtered player-view projection. `apps/server` remains the boundary for the future Socket.IO/lobby/persistence runtime, while `apps/web` remains the browser client.

## Room lifecycle

1. A room creator creates an `avalon` match with `numPlayers` from 5 to 10.
2. Other players list open rooms or join with a room code/match ID and a player name.
3. The Lobby API binds each joined player to a seat and returns credentials.
4. Credentials are stored locally by the browser under the room identity so a reload can reconnect to the same seat.
5. Seat 0 may start the room only after all seats are occupied. Seat 0 has no administrative authority once the game starts.
6. `startGame` assigns roles and the initial leader on the server using the boardgame.io random plugin, then enters the team-proposal phase.
7. A finished room is hidden from the default open-room list but remains in PostgreSQL. The MVP has no automatic room deletion.

If a player loses their credentials, the seat cannot be reclaimed in the MVP. If seat 0 loses its credentials before starting, the room is not recoverable through a replacement seat; a new room must be created. This is an intentional consequence of account-free seat binding.

## Authoritative game state

The following is the logical shape of `G`; the implementation may split the types into focused modules.

```ts
type AvalonG = {
  status: 'lobby' | 'playing' | 'finished'

  players: Record<PlayerID, {
    name: string
  }>

  secret: {
    roleByPlayer: Record<PlayerID, Role>
    pendingVotes: Partial<Record<PlayerID, TeamVote>>
    pendingQuestCards: Partial<Record<PlayerID, QuestCard>>
  }

  leaderID: PlayerID | null
  questIndex: number
  proposedTeam: PlayerID[] | null

  voteHistory: TeamVoteResult[]
  questHistory: QuestResult[]

  consecutiveRejectedTeams: number
  goodSuccesses: number
  evilFailures: number

  rules: {
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

The role map and pending choices are server secrets. After a vote is settled, the individual vote choices may be moved into public vote history. After a quest is settled, only the team, Success count, Fail count, and quest result are retained publicly; the mapping from a quest card to a player is discarded.

## Phases, stages, and moves

| Phase | Active players and stage | Move | Completion |
| --- | --- | --- | --- |
| `lobby` | Seat 0 in `start` | `startGame` | All seats occupied; roles and leader assigned; enter `teamProposal` |
| `teamProposal` | Current leader in `leader` | `proposeTeam(playerIDs)` | Exact team size, seated players, and no duplicates; enter `teamVote` |
| `teamVote` | All players in `vote` | `castTeamVote(approve)` | One vote per player; settle after all votes |
| `quest` | Proposed team in `quest` | `playQuestCard(result)` | One card per team member; settle after all cards |
| `assassination` | Assassin in `assassin` | `assassinate(targetID)` | Target must be Good; resolve victory |
| `gameOver` | None | None | Read-only result |

Each active player has at most one move in the relevant stage. Boardgame.io validates the acting player before the move reaches the game logic; the game logic additionally validates role, phase, team membership, and payload shape.

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

- The current player sees their own exact role.
- Merlin sees the player IDs of all Evil players.
- Evil players see the player IDs of other Evil players.
- Known faction seats do not expose the exact Assassin or Minion role during play.
- Before a team vote is complete, a player sees only their own submitted vote and safe progress information.
- Before a quest is complete, a player sees only their own submitted card and safe progress information.
- Public team proposals, settled vote history, quest history, score, leader, phase, and result remain visible.
- In `gameOver`, the complete role assignment is exposed.

The Debug mode consumes only this filtered client state and safe context fields. It may show match ID, player ID, connection status, current phase/stage, active players, public history, and submission progress. It never bypasses `playerView` and never renders the complete secret state.

## Reconnect and simultaneous submission behavior

The Socket.IO client reconnects with the same match ID, player ID, and credentials. The server sends the current player view after synchronization. No move is replayed from the browser's local UI; the server state is authoritative.

Team votes and quest cards are accepted independently while their players are active. The per-match server queue serializes arrival, and `maxMoves: 1` makes a repeated action invalid. A disconnected player leaves the stage incomplete until reconnecting because automatic timeout is disabled.

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

The default is `{ enabled: false }`. The first implementation does not add a wall-clock timer, timeout move, or automatic default choice. Enabling timeout later requires a separate design decision covering default choices, server-side deadline validation, and recovery when all clients disconnect.

## PostgreSQL storage

boardgame.io 0.50.2 provides an asynchronous `StorageAPI` but no PostgreSQL adapter. The project will implement a small `PostgresStorage` backed by `pg.Pool`.

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

The adapter implements `connect`, `createMatch`, `fetch`, `setState`, `setMetadata`, `wipe`, and `listMatches`. `setState` updates the state and appends any delta log entries in one transaction. `listMatches` supports boardgame.io's game-name, game-over, and updated-time filters. Room metadata, including reconnect credentials used by boardgame.io, remains server/database data and is never exposed through the normal player view.

The deployment artifact will be a database-only Docker Compose file with a pinned PostgreSQL major version, a named persistent volume, a health check, and configurable database credentials. The game server will receive the connection through `DATABASE_URL`.

## Styling

Tailwind v4 is integrated in `apps/web` through the official `@tailwindcss/vite` plugin. Future layout, status panels, buttons, and responsive structure can use utility classes. Global color variables, game-card visuals, and complex animations may remain in focused CSS files. No component library is required for the MVP.

## Testing strategy

The important permanent tests will cover:

- Role counts for every player count from 5 through 10.
- Merlin, Evil, and ordinary Good player views.
- No complete secret state in any player view.
- Team size, duplicate member, and seated-player validation.
- Strict-majority approval and tie rejection.
- Five consecutive rejected proposals.
- Duplicate and non-active-player submissions.
- Good cannot submit Fail; Evil can submit either result.
- The seven-or-more-player fourth-quest two-Fail rule.
- Three Good successes, three Evil failures, and assassination outcomes.
- Quest-result aggregation without player/card correspondence.
- PostgreSQL storage round trips for metadata, state, initial state, logs, listing filters, and deletion.
- Multiple match IDs remaining isolated in storage and Socket.IO flows.
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
