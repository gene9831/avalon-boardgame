---
status: accepted
---

# Use pnpm workspace package boundaries

The repository uses one pnpm workspace with separate packages for the browser client, Node game server, and shared Avalon game definition:

- `apps/web` owns React, Vite, Tailwind, and browser-only code.
- `apps/server` owns the boardgame.io/Socket.IO server entrypoint, lobby flow, and server-only persistence integration.
- `packages/game` owns the shared game definition and public types that are safe to import from both sides.
- `infra/postgres` owns database deployment artifacts and stays outside the application packages.

This keeps the server-authoritative secret state and PostgreSQL dependencies out of the browser bundle while allowing the server and client to share one game contract. The root package remains orchestration-only so `pnpm build` and `pnpm lint` provide stable repository-level commands.

The trade-off is a small amount of workspace configuration before the game implementation exists. That cost is accepted because moving package boundaries after Socket.IO, storage, and shared types have been implemented would be more disruptive.
