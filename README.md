# Avalon Board Game

An online implementation of the base rules of *The Resistance: Avalon* for 5–10 players on a local network. The runtime uses React, TypeScript, Vite, boardgame.io, Socket.IO, and PostgreSQL.

The repository is a pnpm workspace. The shared Avalon rule core, multiplayer transport, Lobby flow, PostgreSQL persistence, seat-bound reconnect, and the complete in-room Web flow are implemented. Real 5–10-client LAN acceptance testing remains in progress.

## Workspace layout

```text
apps/
  web/          React + Vite browser client
  server/       Node + boardgame.io server boundary
packages/
  game/         Shared Avalon game definition and public types
infra/
  postgres/     PostgreSQL deployment boundary
docs/
  rules/        Rule references and visibility constraints
  adr/          Architecture decisions
  testing/      Manual multiplayer acceptance procedures
```

The root package is orchestration-only. Browser dependencies and Vite/Oxlint configuration live in `apps/web`; server-only dependencies must not be imported by the browser or shared game package.

## Development

Install workspace dependencies:

```bash
pnpm install
```

Run the web package:

```bash
pnpm dev
```

Run the boardgame.io server and Lobby API:

```bash
pnpm dev:server
```

The server listens on game port `8000` and Lobby API port `8001` by default. Configure them with `AVALON_GAME_PORT`, `AVALON_LOBBY_PORT`, and `AVALON_ORIGINS`. When `DATABASE_URL` is configured, the server uses the PostgreSQL storage adapter; process-local memory storage is retained for tests and explicitly ephemeral development.

Validate the current workspace:

```bash
pnpm build
pnpm lint
pnpm test
pnpm typecheck
```

`pnpm test` runs the rule-core tests and the server's Lobby/Socket.IO integration tests. The web package can also be addressed directly with `pnpm --filter @avalon/web <command>`. Tailwind CSS v4 is integrated through `@tailwindcss/vite`; the starter's focused CSS remains available for the future board and card visuals.

## Design references

- [Confirmed game design](docs/superpowers/specs/2026-08-14-avalon-boardgame-design.md)
- [Project status and next steps](docs/PROJECT_STATUS.md)
- [LAN multiplayer manual acceptance](docs/testing/lan-multiplayer-acceptance.md)
- [Domain glossary](CONTEXT.md)
- [Rule summary](docs/rules/rulebook-summary.md)
- [Role visibility rules](docs/rules/role-visibility.md)
- [Architecture decisions](docs/adr/)
