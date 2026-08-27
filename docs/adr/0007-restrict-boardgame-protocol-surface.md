---
status: accepted
---

# Restrict the boardgame.io protocol surface

Avalon exposes only the boardgame.io HTTP and Socket capabilities required by the current Web client. The Lobby API permits Avalon create, join, and Room detail lookup. Project-owned `/rooms/avalon/**` lifecycle routes and enabled `/dev/**` routes remain available. Generic game and match listing plus leave, playAgain, rename, and player-update routes return 404 without executing the dependency handlers.

Create and join use strict shared Zod schemas at the Server boundary. HTTP mutation bodies are limited to 16 KiB. Room detail responses are rebuilt from an explicit public allowlist and exclude Client IDs, Seat credentials, unknown player metadata, and hidden game state. Stable JSON error codes prevent the Web client from depending on boardgame.io error text.

Socket sync, update, and disconnect remain delegated to boardgame.io. Chat is removed from each game namespace and closes the sending connection; client messages are limited to 64 KiB. Avalon requires the pinned dependency to install exactly one expected namespace connection hook and fails closed when that contract is absent. Seat credentials and development tokens share one bounded, constant-time comparison path and are never included in boundary logs.

This keeps the server-authoritative boundary small without forking boardgame.io, at the cost of pinning all workspace uses of boardgame.io to `0.50.2` and integration-testing the dependency hooks used by the adapters. Upgrading boardgame.io requires explicitly revalidating the HTTP registration and Socket listener contracts before changing the pin.
