[English](README.md) | [简体中文](README.zh-CN.md)

# Avalon Board Game

A LAN-hosted online implementation of the base rules of *The Resistance: Avalon* for 5–10 players. The stack is React, TypeScript, Vite, boardgame.io, Socket.IO, and PostgreSQL.

The shared rule core, multiplayer transport, Lobby flow, PostgreSQL persistence, seat-bound reconnect, complete in-room Web flow, deterministic replay, and automated game-flow testing are implemented. The main remaining acceptance work is testing complete games on 5–10 physical devices over a real LAN and exercising reconnect after a PostgreSQL restart in the deployment environment.

## Workspace layout

```text
apps/
  web/          React + Vite browser client
  server/       Node + boardgame.io server boundary
packages/
  game/         Browser-safe Avalon rule core and public types
  test-support/ Deterministic seeds, transcripts, and replay drivers
tests/
  e2e/          Playwright multi-context browser flows
infra/
  postgres/     Development-only PostgreSQL Compose stack
docs/
  deployment/   Integrated Docker Compose deployment guide
  rules/        Rule references and visibility constraints
  adr/          Architecture decisions
  testing/      Automated and manual acceptance procedures
```

The root package is orchestration-only. Server-only dependencies must not be imported by the browser or shared game package. The server is authoritative for rules, credentials, hidden state, and game mutations; browsers receive player-filtered state through `playerView`.

## Prerequisites

The CI-tested toolchain uses:

- Node.js 24;
- pnpm 11.21.0;
- Git LFS 3.x for fetching or updating lossless role-image masters;
- PostgreSQL 16 for persistent development and PostgreSQL integration tests;
- Chromium installed through Playwright for browser tests.

## Quick start

Install dependencies from the repository root:

```bash
pnpm install
```

Configure the server with one storage mode:

- For persistent development, copy `apps/server/.env.example` to `apps/server/.env.local` and set a valid `DATABASE_URL`.
- For explicitly ephemeral development, create `apps/server/.env.local` with `AVALON_STORAGE=memory`. All rooms are lost when the server stops.

Start the server and web client in separate terminals:

```bash
pnpm dev:server
```

```bash
pnpm dev
```

Open `http://localhost:5183`. The server listens on game port `8000` and Lobby API port `8001` by default.

For LAN development, the browser derives both server URLs from the hostname used to open the page. If the web client and server run on different hosts, configure `VITE_LOBBY_URL` and `VITE_GAME_URL` in `apps/web/.env.local`. See the [server](apps/server/README.md), [web](apps/web/README.md), and [development PostgreSQL](infra/postgres/README.md) guides for detailed configuration.

For an integrated deployment, copy the root `.env.example` to `.env` and run `docker compose up -d --build`. The stack publishes one configurable gateway port and keeps the Node and PostgreSQL ports internal. It supports both Docker-managed and bind-mounted database volumes, plus runtime nested-path deployment behind an existing reverse proxy. See the [Docker Compose deployment guide](docs/deployment/docker-compose.md).

## Root scripts

The following table covers every script declared in the root `package.json`.

| Script | Purpose |
| --- | --- |
| `pnpm assets:pull` | Hydrates all Git LFS role-artwork and role-avatar PNG masters in the current worktree. |
| `pnpm assets:pull:avatars` | Hydrates only the role-avatar PNG masters. |
| `pnpm assets:pull:roles` | Hydrates only the role-artwork PNG masters. |
| `pnpm assets:setup` | Configures the clone once so its normal worktrees keep LFS source masters as pointers. |
| `pnpm assets:verify` | Runs the source-dependent role-asset checks after the required masters have been hydrated. |
| `pnpm dev` | Starts the `@avalon/web` Vite development server on all network interfaces. |
| `pnpm dev:server` | Starts the `@avalon/server` Lobby API and Socket.IO game server, loading `apps/server/.env.local` when present. |
| `pnpm build` | Type-checks `@avalon/game` and `@avalon/server`, creates the production server JavaScript artifact, then creates the production Web bundle. |
| `pnpm lint` | Runs Oxlint for `@avalon/web`. |
| `pnpm preview` | Serves the built Web bundle with Vite preview. Run `pnpm build` first. |
| `pnpm test` | Runs every workspace package that declares a `test` script: rule core, replay/property, server, and Web unit tests. It does not run Playwright or required-PostgreSQL suites. |
| `pnpm test:e2e` | Runs the default Playwright browser suite. The normal run executes the five-player smoke flow and skips matrix-only cases. |
| `pnpm test:e2e:matrix` | Runs the seeded complete-game Playwright matrix for 5, 6, 7, 8, 9, and 10 players. |
| `pnpm test:postgres` | Runs the server PostgreSQL storage and credential-reconnect integration tests. Requires a reachable `DATABASE_URL`. |
| `pnpm test:replay --seed <seed> --players <5-10>` | Replays one deterministic generated game through the rule driver. |
| `pnpm typecheck` | Type-checks the game, test-support, server, Web, and E2E workspaces. |

## Workspace scripts

Run a package script from the repository root with `pnpm --filter <package> <script>`. This table covers every script declared by the workspace packages.

| Package | Script | Purpose |
| --- | --- | --- |
| `@avalon/game` | `test` | Runs rule-core tests. |
| `@avalon/game` | `typecheck` | Type-checks the browser-safe game package without emitting files. |
| `@avalon/test-support` | `replay` | Runs the deterministic replay CLI; accepts `--seed` and `--players`. |
| `@avalon/test-support` | `test` | Runs generated-game, transcript, replay, and property tests. |
| `@avalon/test-support` | `typecheck` | Type-checks replay and test-support code. |
| `@avalon/server` | `dev` | Starts the server directly and loads `.env.local` when present. |
| `@avalon/server` | `build` | Bundles the production Node ESM artifact and copies the PostgreSQL schema beside it. |
| `@avalon/server` | `start` | Starts the previously built production JavaScript artifact. |
| `@avalon/server` | `test` | Runs Lobby, Socket.IO replay, configuration, lifecycle, and server unit/integration tests that do not require PostgreSQL. |
| `@avalon/server` | `test:postgres` | Requires PostgreSQL and runs storage plus restart-reconnect tests. |
| `@avalon/server` | `test:postgres:restart-probe` | Internal CI probe with `prepare` and `verify` modes around a PostgreSQL service restart. |
| `@avalon/server` | `typecheck` | Type-checks server code without emitting files. |
| `@avalon/web` | `dev` | Starts Vite on `0.0.0.0` for LAN development. |
| `@avalon/web` | `test` | Runs source-independent Web component, browser-state, and deployable-asset unit tests. |
| `@avalon/web` | `test:assets` | Validates hydrated PNG masters, the role-artwork converter, and deployable role avatars. |
| `@avalon/web` | `build` | Type-checks and creates the production Vite bundle. |
| `@avalon/web` | `lint` | Runs Oxlint for Web code. |
| `@avalon/web` | `preview` | Serves the previously built Web bundle locally. |
| `@avalon/e2e` | `test:e2e` | Runs Playwright with the default smoke configuration. |
| `@avalon/e2e` | `test:e2e:matrix` | Sets matrix mode and runs all configured complete-game browser cases. |
| `@avalon/e2e` | `typecheck` | Type-checks Playwright specs and browser replay support. |

Examples:

```bash
pnpm --filter @avalon/game test
pnpm --filter @avalon/server typecheck
pnpm --filter @avalon/web build
pnpm --filter @avalon/test-support replay --seed example-seed --players 7
```

## Testing and replay

Run the normal local validation set with:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Install Chromium before the first local Playwright run:

```bash
pnpm --filter @avalon/e2e exec playwright install chromium
```

Every randomized game-flow run has an explicit seed. Reuse a failing seed to reproduce the same generated decisions:

```bash
pnpm test:replay --seed nightly-2026-08-22-7p --players 7
E2E_MASTER_SEED=nightly-2026-08-22-7p E2E_PLAYER_COUNT=7 pnpm test:e2e:matrix
```

GitHub Actions runs quality checks, unit and Socket.IO replay tests, PostgreSQL restart/reconnect tests, a browser smoke flow, and a non-publishing Docker Compose smoke test for pull requests and pushes to `main`. A nightly workflow runs deeper property tests and seeded 5–10-player browser shards entirely on GitHub-hosted runners. See [automated game-flow testing](docs/testing/automated-game-flow.md) for replay controls, CI job names, and failure artifacts.

Automation is not a substitute for real-device LAN acceptance. Use the [LAN multiplayer acceptance guide](docs/testing/lan-multiplayer-acceptance.md) for physical-device, network interruption, multi-room, and deployment restart checks.

## Design references

- [Confirmed game design](docs/superpowers/specs/2026-08-14-avalon-boardgame-design.md)
- [Project status and next steps](docs/PROJECT_STATUS.md)
- [Domain glossary](CONTEXT.md)
- [Rule summary](docs/rules/rulebook-summary.md)
- [Role visibility rules](docs/rules/role-visibility.md)
- [Architecture decisions](docs/adr/)
