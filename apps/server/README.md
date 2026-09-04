# `@avalon/server`

This package runs the Node.js boardgame.io server for the Avalon rule core.

The current runtime provides:

- the boardgame.io Lobby API on port `8001`;
- the Socket.IO game transport on port `8000`;
- a storage-aware readiness endpoint at `/healthz` on the Lobby port;
- multiple independent `avalon` matches;
- server-authoritative state through `@avalon/game`'s `playerView`;
- PostgreSQL persistence through `DATABASE_URL` or the standard `PG*` fields used by the integrated Compose stack;
- process-local memory storage only when explicitly selected or injected by tests.

Start it from the workspace root:

```bash
pnpm dev:server
```

Or run the package directly:

```bash
pnpm --filter @avalon/server build
pnpm --filter @avalon/server start
pnpm --filter @avalon/server test
pnpm --filter @avalon/server typecheck
```

Environment variables:

- `AVALON_GAME_PORT` — Socket.IO port, default `8000`;
- `AVALON_LOBBY_PORT` — Lobby API port, default `8001`;
- `AVALON_ORIGINS` — comma-separated browser origins, default `http://localhost:5183`;
- `DATABASE_URL` — PostgreSQL connection URL; when set, the server uses `PostgresStorage`;
- `AVALON_STORAGE` — optional explicit `postgres` or `memory` mode. With `postgres` and no `DATABASE_URL`, `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, and `PGPASSWORD` are required. `memory` is intended only for tests or ephemeral local development;
- `AVALON_DEV_TOOLS` — set to the exact value `true` to enable the development-only room deletion and lobby seat-kick APIs and their web controls;
- `AVALON_DEV_ADMIN_TOKEN` — a non-empty, server-side bearer token required with `AVALON_DEV_TOOLS=true`; keep the real value in ignored `.env.local` or a secret manager. For local testing only, an operator enters a copy manually in the page; that browser copy must not be committed, embedded in web configuration, or persisted.

For local development, copy `.env.example` to `.env.local` and set the deployed database URL:

```env
DATABASE_URL=postgresql://avalon:<password>@192.168.100.13:5432/avalon
```

To enable the development room controls locally, add both settings to `.env.local`:

```env
AVALON_DEV_TOOLS=true
AVALON_DEV_ADMIN_TOKEN=<long-random-local-token>
```

The public `/dev/status` endpoint reports whether the pair is enabled. The homepage only shows the token details panel after that response is enabled; the browser does not read the env file or persist the manually entered token. This manual entry flow is for local testing only; outside it the server-side env value remains secret. When the tools are disabled or the token is not configured, mutation routes return `404`; an invalid token returns `401` while the tools are enabled.

`pnpm dev:server` loads `.env.local` automatically. The file is ignored by Git and must never be committed. Outside tests, startup fails without PostgreSQL configuration unless `AVALON_STORAGE=memory` is explicitly set.

The production build emits `dist/index.js` and `dist/schema.sql`; `pnpm --filter @avalon/server start` runs that JavaScript directly without `tsx`. The root Docker Compose deployment owns the production environment contract; see the [deployment guide](../../docs/deployment/docker-compose.md).

The PostgreSQL adapter stores boardgame.io state, metadata, initial state, and delta logs in the `matches` and `match_logs` tables. The full state stays server-side; browser clients still receive only the filtered `playerView`. Finished matches remain in PostgreSQL while the Lobby API can filter them from the open-room list.
