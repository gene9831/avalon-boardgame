# PostgreSQL deployment

This directory contains the database-only Docker Compose deployment for the Avalon server. It runs PostgreSQL 16 with a named persistent volume and no extra admin service.

## Deploy

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

The future server connection string will have this shape:

```text
postgresql://POSTGRES_USER:POSTGRES_PASSWORD@DATABASE_HOST:POSTGRES_PORT/POSTGRES_DB
```

After deployment, provide the database host IP, published port, database name, and username. Keep the password out of chat; it can be supplied through the server's private environment configuration.
