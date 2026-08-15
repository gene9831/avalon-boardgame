---
status: proposed
---

# Persist independent rooms in PostgreSQL

The service supports multiple independent boardgame.io matches and stores their state, metadata, initial state, and logs in PostgreSQL through a custom implementation of boardgame.io 0.50.2's asynchronous `StorageAPI`. PostgreSQL is preferred over the built-in in-memory store because rooms must survive a game-server restart; the in-memory store remains a test-only option.

The LAN MVP runs one Node game-server process. Socket.IO's per-match ordering remains process-local, while PostgreSQL provides durable room storage. Horizontal game-server scaling, cross-process Socket.IO adapters, and distributed match locking are explicitly outside this design.
