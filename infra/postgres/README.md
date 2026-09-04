# Development PostgreSQL service

This directory contains the database-only Docker Compose service for local and split-process development. It runs PostgreSQL 16 with a named persistent volume and no extra admin service.

For deployment of the complete application, use the root `compose.yml` and the [integrated deployment guide](../../docs/deployment/docker-compose.md). The root stack keeps PostgreSQL private to the container network; this development stack intentionally publishes its database port.

## Start for development

```bash
cd infra/postgres
cp .env.example .env
# Edit .env and replace POSTGRES_PASSWORD.
docker compose up -d
docker compose ps
```

The service publishes PostgreSQL on `${POSTGRES_PORT}` (5432 by default) on the deployment host. Keep that port reachable only from the Avalon server and trusted LAN hosts; do not expose it to the public internet.

The persistent volume is `avalon-postgres-data`. Stop the service without deleting data with:

```bash
docker compose down
```

The server connection string has this shape:

```text
postgresql://POSTGRES_USER:POSTGRES_PASSWORD@DATABASE_HOST:POSTGRES_PORT/POSTGRES_DB
```

After deployment, provide the database host IP, published port, database name, and username. Keep the password out of chat; it can be supplied through the server's private environment configuration.
