# PostgreSQL deployment

This directory is reserved for the database-only Docker Compose deployment used by the Avalon server. The Compose file will be added when the PostgreSQL storage adapter is implemented; it will be deployable independently from the web and server packages and will expose connection details through `DATABASE_URL`.
