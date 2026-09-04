---
status: accepted
---

# Separate development database Compose from integrated deployment Compose

The database-only Compose configuration remains a development artifact for running PostgreSQL independently. Deployment instead uses an integrated Compose stack that builds a lightweight Nginx gateway, one Node game-server process, and PostgreSQL from source. Only the gateway's LAN HTTP port is published; it serves the Web build and routes Lobby API and Socket.IO traffic over the internal Compose network, while an existing host-level reverse proxy may remain responsible for domains and TLS.

The production Web client uses the gateway's origin for Lobby and game traffic while retaining explicit URL overrides for split-host development. An optional host-level reverse proxy owns any external path prefix: it strips that prefix before forwarding and sends a validated `X-Forwarded-Prefix` value so the gateway can adapt browser-visible asset, router, Lobby, and Socket.IO paths at runtime. The image and Compose environment do not contain a deployment-specific base path. External scheme, host, and port remain covered by the server's explicit origin allowlist.

The Node service is built to JavaScript rather than executing TypeScript in production, starts only after PostgreSQL is healthy, and exposes a health contract for Compose. PostgreSQL data may use either a Docker-managed named volume or an operator-selected host data directory. Services restart unless explicitly stopped; published application images and built-in TLS are outside the first deployment scope.
