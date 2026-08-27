# Avalon Board Game Project Instructions

## Project goal

Build a LAN-hosted online implementation of the base rules of
*The Resistance: Avalon* for 5–10 players.

The MVP must support:

- Multiple isolated rooms.
- Merlin, Assassin, Loyal Servant, and Minion.
- Team proposal, team voting, quest cards, assassination, and final results.
- Server-authoritative hidden information.
- PostgreSQL persistence and seat-bound reconnection.

Do not add expansion roles, accounts, chat, AI players, automatic timeouts,
or multi-server coordination unless the requested work explicitly expands
the MVP scope.

## Sources of truth

Before changing game behavior, consult the relevant documents:

- `docs/PROJECT_STATUS.md` — current progress, priorities, and acceptance status.
- `CONTEXT.md` — canonical domain terminology.
- `docs/rules/` — game rules and role visibility.
- `docs/adr/` — architectural decisions.
- `docs/superpowers/specs/2026-08-14-avalon-boardgame-design.md` — accepted MVP design.
- `docs/ENGINEERING_STANDARDS.md` — implementation, testing, and AI change standards.

Before changing code, read the sections of `docs/ENGINEERING_STANDARDS.md` that
apply to the task. Keep this file as the concise project-policy entry point and
the engineering standards document as the detailed implementation guide.

Treat `docs/PROJECT_STATUS.md` as the sole project-progress tracker.
Do not create competing status documents.

If code, tests, and documentation disagree:

1. Do not silently choose one interpretation.
2. Check the rule sources and accepted ADRs.
3. Report the discrepancy.
4. Update all affected sources when implementing an approved behavior change.

## Workspace boundaries

This is a pnpm workspace.

- `packages/game`
  - Owns the shared Avalon rule core and public types.
  - Must remain browser-safe.
  - Must not import PostgreSQL, Socket.IO, server configuration, or UI code.

- `apps/server`
  - Owns the boardgame.io server, Lobby API, session validation, room lifecycle,
    and persistence integration.
  - Is authoritative for rules, credentials, hidden state, and game mutations.

- `apps/web`
  - Owns the React UI, routing, browser identity, and local reconnect state.
  - May consume only public game exports and player-filtered state.
  - Must not reproduce authoritative game rules as a security boundary.

- `infra/postgres`
  - Owns database-only deployment configuration.

The root package is orchestration-only. Avoid placing runtime application
dependencies in the root package.

## Game and security invariants

Preserve these invariants in every change:

- Browsers must never receive another player's hidden role or pending secret choice.
- `playerView` is the visibility boundary; UI hiding alone is not security.
- Good players cannot submit a Fail quest card.
- Pending votes and quest cards remain private until their event settles.
- Public quest results must not associate individual players with submitted cards.
- Settled votes, quests, and victory results are immutable.
- Rooms must remain isolated from one another.
- Deleted rooms must not be recreated by stale or anonymous synchronization.
- Stale metadata writes must not restore removed players or credentials.
- A public client ID or session ID must never be treated as authentication.
- Seat access requires the boardgame.io player credential.
- Development administration tokens must remain server-side secrets and must not
  be committed, embedded in web configuration, logged, or persisted by the browser.
- Do not add automatic timeout advancement or administrative game-state mutation
  without a new accepted architectural decision.

## Package management and commands

Use pnpm. Do not use npm or yarn.

Common commands from the repository root:

```bash
pnpm dev
pnpm dev:server
pnpm test
pnpm build
pnpm lint
pnpm typecheck
```

Prefer package-scoped checks during implementation:

```bash
pnpm --filter @avalon/game test
pnpm --filter @avalon/server test
pnpm --filter @avalon/server typecheck
pnpm --filter @avalon/web test
pnpm --filter @avalon/web build
```

Commands that install, resolve, or update dependencies require network access.
Do not add a production dependency without explaining why it is necessary.

Long-running LAN development servers should normally be started by the user in
persistent terminals. Do not describe a short-lived tool process as a completed
multiplayer acceptance test.

## Development workflow

- Inspect the working tree before editing.
- Preserve unrelated and pre-existing user changes.
- Make the smallest coherent change that satisfies the requested behavior.
- Optimize for rapid prototype iteration. Do not require a full TDD cycle for
  every change.
- Use behavior-focused TDD when a change affects core or high-risk behavior:
  shared game rules, hidden-information and authorization boundaries,
  server-authoritative validation, credentials and sessions, room isolation or
  lifecycle, persistence and reconnection, or an important production regression.
- For low-risk UI styling, layout, copy, temporary prototype interactions,
  mechanical refactors, and other easily inspected changes, implementation may
  come first. Validate them with the narrowest useful combination of focused
  tests, type checking, builds, and manual checks.
- Add permanent tests for stable acceptance behavior, security boundaries,
  public contracts, and important regressions.
- Do not add tests merely to increase coverage or to lock down private
  implementation details. Every permanent test should identify an important
  production regression that it prevents.
- Remove temporary diagnostics and implementation-only tests before completion.
- Do not weaken an existing valuable test unless expected behavior has changed.
- Do not change production code merely to manufacture a failing test.
- Avoid duplicating game rules across server and web code.
- Prefer existing project vocabulary from `CONTEXT.md`.

## Branch-based development workflow

This workflow applies to tasks that modify project files. Read-only analysis,
status inspection, and advisory work do not require a branch.

Before implementation:

1. State the concrete goal, modification scope, acceptance criteria, and planned
   validation.
2. Resolve material ambiguity and obtain user approval for the proposed change.
3. Confirm the working tree is clean or preserve unrelated existing changes.
4. Start from `main` and create a focused branch named `codex/<short-topic>`.

During implementation:

- Keep all implementation work on the feature branch.
- Use focused checkpoint commits when they improve recovery or review.
- Do not create a commit for every minor edit.
- Keep unrelated changes out of the branch.
- Do not merge partially implemented or failing work into `main`.

Before integration:

1. Run focused tests during development.
2. Run all validation required by the final scope.
3. Report the actual test, build, lint, typecheck, and manual-validation results.
4. Confirm that generated or temporary artifacts have been removed.
5. Ask for user confirmation before integrating into `main`.

After approval, squash the feature branch into one coherent commit on `main`.
The squashed commit must include the implementation, permanent regression tests,
and required documentation updates. Do not squash unrelated features together.

If validation fails, the working tree is not clean, or `main` has moved in a way
that creates conflicts, stop integration and report the condition instead of
forcing the merge.

## Validation

During implementation, run the narrowest relevant checks first.

Validation must be proportional to the risk and scope of the change. Documentation,
copy, and similarly non-executable changes require content and diff review, not an
unrelated application test suite. Low-risk prototype UI changes may use focused
build, type-check, or manual verification instead of adding automated tests.

Before declaring a completed code change, run validation proportional to its scope.
For changes spanning the application, run:

```bash
pnpm test
pnpm build
pnpm lint
pnpm typecheck
```

Report actual results, including warnings and skipped integration or manual tests.

Automated tests do not replace:

- Real 5–10 browser LAN acceptance testing.
- Multi-room manual isolation testing.
- PostgreSQL restart and credential-reconnect testing.

Do not claim those acceptance criteria passed unless they were actually exercised.

## Documentation

After completing an independent module:

- Update the applicable milestone and next steps in `docs/PROJECT_STATUS.md`.
- Record the actual validation results.
- Update README files when setup, commands, ports, or environment variables change.
- Add or update an ADR when changing an architectural or security boundary.

Do not commit generated plans or temporary specifications unless explicitly asked.
Remove temporary planning artifacts after the related work is complete.

## Environment and secrets

- Never commit `.env`, `.env.local`, credentials, database passwords, or admin tokens.
- Use the checked-in `.env.example` files for documented variable names.
- Do not print secret values in command output or final reports.
- Production-like server startup requires PostgreSQL unless explicitly using
  ephemeral memory storage for tests or local development.

## Git and change hygiene

- Do not overwrite or revert unrelated working-tree changes.
- A user-approved implementation task authorizes creating its feature branch and
  making local checkpoint commits under the branch workflow above.
- Do not push, open pull requests, or integrate into `main` without explicit user
  approval.
- When commits are requested, keep them focused on one coherent change.
- Before handoff, summarize changed files, validation performed, and remaining
  manual verification.

## Code review rules

When reviewing changes, prioritize correctness and regressions involving:

- Hidden-role or pending-choice leakage.
- Client-side authority replacing server validation.
- Cross-room state contamination.
- Deleted-room resurrection.
- Stale metadata or delayed-write races.
- Credential/session confusion.
- Duplicate move submission.
- Incorrect quest thresholds, rejection victory, or assassination resolution.
- Loss of reconnect behavior after refresh or server restart.

Avoid reporting formatting preferences already enforced by automated tooling
unless they cause a real correctness or maintainability problem.
