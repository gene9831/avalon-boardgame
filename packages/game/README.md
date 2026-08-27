# `@avalon/game`

This package contains the shared, server-authoritative Avalon rule core:

- role distribution for 5–10 players;
- boardgame.io phases, stages, active players, and moves;
- simultaneous team votes and quest-card submissions;
- victory and assassination resolution;
- filtered player views that never expose the authoritative `secret` state during play.
- browser-safe Zod schemas and inferred types for the public room directory contract.

It is browser-safe and does not contain Socket.IO, PostgreSQL, or UI code. The server and web packages consume the public exports from `src/index.ts`.

Run its checks from the workspace root:

```bash
pnpm --filter @avalon/game test
pnpm --filter @avalon/game typecheck
```
