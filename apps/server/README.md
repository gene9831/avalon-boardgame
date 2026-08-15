# `@avalon/server`

This package runs the Node.js boardgame.io server for the Avalon rule core.

The current runtime provides:

- the boardgame.io Lobby API on port `8001`;
- the Socket.IO game transport on port `8000`;
- multiple independent `avalon` matches;
- server-authoritative state through `@avalon/game`'s `playerView`;
- PostgreSQL persistence when `DATABASE_URL` is configured;
- process-local memory storage when no database URL is configured or a storage is injected by tests.

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
- `AVALON_ORIGINS` — comma-separated browser origins, default `http://localhost:5173`;
- `DATABASE_URL` — PostgreSQL connection URL; when set, the server uses `PostgresStorage`;
- `AVALON_STORAGE` — optional explicit `postgres` or `memory` mode. `memory` is intended only for tests or ephemeral local development.

For local development, copy `.env.example` to `.env.local` and set the deployed database URL:

```env
DATABASE_URL=postgresql://avalon:<password>@192.168.100.13:5432/avalon
```

`pnpm dev:server` loads `.env.local` automatically on Node.js 22. The file is ignored by Git and must never be committed. Outside tests, startup fails without `DATABASE_URL` unless `AVALON_STORAGE=memory` is explicitly set.

The PostgreSQL adapter stores boardgame.io state, metadata, initial state, and delta logs in the `matches` and `match_logs` tables. The full state stays server-side; browser clients still receive only the filtered `playerView`. Finished matches remain in PostgreSQL while the Lobby API can filter them from the open-room list.
