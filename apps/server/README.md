# `@avalon/server`

This package runs the Node.js boardgame.io server for the Avalon rule core.

The current runtime provides:

- the boardgame.io Lobby API on port `8001`;
- the Socket.IO game transport on port `8000`;
- multiple independent `avalon` matches;
- server-authoritative state through `@avalon/game`'s `playerView`;
- process-local memory storage for LAN development and tests.

Start it from the workspace root:

```bash
pnpm dev:server
```

Or run the package directly:

```bash
pnpm --filter @avalon/server test
pnpm --filter @avalon/server typecheck
```

Environment variables:

- `AVALON_GAME_PORT` — Socket.IO port, default `8000`;
- `AVALON_LOBBY_PORT` — Lobby API port, default `8001`;
- `AVALON_ORIGINS` — comma-separated browser origins, default `http://localhost:5173`.

PostgreSQL persistence is intentionally not part of this module; the later storage adapter will replace `MemoryStorage` without changing the boardgame.io transport boundary.
