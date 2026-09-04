# Docker Compose deployment

The root `compose.yml` builds and runs the complete Avalon service from source:

- `gateway` serves the Web build and proxies application traffic;
- `server` runs the game transport on internal port 8000 and the Lobby API on internal port 8001;
- `postgres` persists rooms and games on internal port 5432.

Only the gateway publishes a host port. TLS and public-domain routing belong to an upstream reverse proxy when one is present.

## Start the stack

Copy the deployment environment example and replace the password before the first start:

```bash
cp .env.example .env
docker compose up -d --build
docker compose ps
docker compose logs --tail=100 gateway server postgres
```

The image is built locally. This deployment does not pull or publish an Avalon application image.

The default endpoint is `http://127.0.0.1:8080`. This loopback-only binding is appropriate when a reverse proxy runs on the same host. For direct LAN access, set:

```dotenv
AVALON_BIND_ADDRESS=0.0.0.0
AVALON_PORT=8080
AVALON_ORIGINS=http://192.0.2.20:8080
```

`AVALON_ORIGINS` is a comma-separated allowlist of browser origins. An origin contains the scheme, hostname, and optional port; it never contains a URL path. For example, a browser URL of `https://games.example/boardgames/avalon/` has the origin `https://games.example`.

Stop the stack without deleting its data:

```bash
docker compose down
```

Do not add `-v` unless the named database volume is intentionally disposable.

## PostgreSQL data volume

The default setting uses a Docker-managed named volume:

```dotenv
AVALON_POSTGRES_DATA=avalon-postgres-data
```

Because the value does not begin with `.` or `/`, Compose treats it as a named volume. Compose prefixes the physical volume name with the project name so separate deployments do not share a database accidentally. Find it with:

```bash
docker volume ls --filter label=com.docker.compose.volume=avalon-postgres-data
```

To keep data in a directory beside `compose.yml`, use:

```dotenv
AVALON_POSTGRES_DATA=./data
```

Relative bind paths are resolved from the Compose project directory. An absolute path is also accepted:

```dotenv
AVALON_POSTGRES_DATA=/srv/avalon/postgres
```

The target inside the PostgreSQL container remains `/var/lib/postgresql/data` in all cases. Ensure a bind-mounted host directory is writable by the PostgreSQL container and include it in the host backup policy.

## Upstream reverse proxy and nested paths

Avalon does not have an `AVALON_BASE_PATH` setting. A host reverse proxy owns the public domain, TLS, and optional external path prefix.

For a public path such as `/boardgames/avalon/`, the upstream proxy must:

1. strip `/boardgames/avalon` before forwarding the request to the gateway;
2. overwrite `X-Forwarded-Prefix` with `/boardgames/avalon`;
3. preserve the original Host and forwarded scheme;
4. forward WebSocket upgrade headers.

The gateway validates the prefix and injects it into the HTML `<base>` element for each request. The browser then uses the same prefix for React routes, Lobby requests, static assets, and the Socket.IO handshake. When the header is absent, Avalon runs at `/`.

Example host Nginx configuration:

```nginx
map $http_upgrade $connection_upgrade {
    default upgrade;
    '' close;
}

location /boardgames/avalon/ {
    proxy_pass http://127.0.0.1:8080/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-Prefix /boardgames/avalon;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $connection_upgrade;
}
```

The trailing slash on `proxy_pass` is significant: it replaces the matching location prefix with `/`. Configure:

```dotenv
AVALON_ORIGINS=https://games.example
```

Do not include `/boardgames/avalon` in `AVALON_ORIGINS`. Test and reload the host proxy using that host's normal administration procedure; the Avalon Compose stack does not modify it.

## Health and failure handling

Compose starts PostgreSQL first, then the Node service after PostgreSQL is healthy, then the gateway after the Node health check succeeds. All services use `restart: unless-stopped`.

Check readiness through the only published endpoint:

```bash
curl --fail http://127.0.0.1:8080/healthz
docker compose ps
```

The response is either `{"status":"ok"}` or a generic unavailable response. Database addresses, credentials, and error details are not returned to browsers. Temporary application database failures continue to use the structured `service_unavailable` response, and Socket.IO clients reconnect after a failed transport.

The Node process handles `SIGTERM` and closes listeners and storage before exit. Use normal Compose stop/restart commands rather than killing the process inside the container:

```bash
docker compose restart server
docker compose restart postgres
docker compose stop
```

## Backup and upgrades

Create a logical backup before changing application or PostgreSQL versions:

```bash
docker compose exec -T postgres \
  sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' \
  > avalon-backup.sql
```

Keep the backup outside the database volume and verify that it is non-empty. Restore only into an intentionally selected empty database:

```bash
docker compose exec -T postgres \
  sh -c 'psql -U "$POSTGRES_USER" "$POSTGRES_DB"' \
  < avalon-backup.sql
```

The current schema is initialized idempotently but has no migration framework. Same-version container restarts are supported. Before the first release that changes an existing database schema, add and review a versioned migration design; do not rely on startup SQL for a destructive or incompatible upgrade.

## Rebuild after source changes

```bash
docker compose up -d --build
docker compose ps
docker compose logs --tail=100 server gateway
```

Confirm `/healthz`, room creation, and credential-bound reconnect after an upgrade. Real 5–10-device LAN play remains a separate manual acceptance activity.
