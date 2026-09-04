# `@avalon/web`

This package provides the LAN Lobby and the complete in-room Avalon game flow.

The browser uses two routes:

- `/` is the lobby for creating and joining rooms.
- `/rooms/:matchID` is the room page for one match. The waiting lobby and active
  game share a responsive round-table layout. During play, a tabletop-inspired
  quest board stays at the center while the surrounding seats handle team
  selection and assassination targets. The page supports role visibility, team
  proposal, voting, secret quest cards, public quest results, assassination,
  final role reveal, reconnect, and returning home. Returning home keeps this
  browser's seat credentials so the room can be reopened.

Each browser has a local cosmetic profile with a random default name and avatar,
plus a stable client ID used when joining. The profile can be edited outside a
room and is locked while seated. Duplicate display names are allowed because
seat numbers remain the stable public identity; the server rejects a client ID
if the same browser tries to occupy a second seat in one room. This is a
seat-binding guard for the no-account LAN MVP, not an account-level identity
system.

Run it from the workspace root:

```bash
pnpm dev
```

## Role image conversion

Lossless PNG role masters live in `images/source/roles/`. Generate deployable WebP
variants in `apps/web/public/images/roles/` with:

```bash
# Convert every PNG master.
pnpm --filter @avalon/web images:roles

# Convert one role by filename, case-insensitively.
pnpm --filter @avalon/web images:roles -- Merlin
```

The converter preserves aspect ratio and transparency, strips nonessential
metadata, and writes `320w`, `480w`, and native-width variants without enlarging
a source that is narrower than a requested output. For example, a 752px-wide
master produces a `752w` maximum while a 674px-wide master produces a `674w`
maximum. Generated files use lowercase names such as `merlin-320.webp`. The
command is explicit and is not part of the normal Web build. Prefix a PNG master
filename with `_` to retain it in the source directory without including it in
default or explicitly requested conversion.

The Vite server binds to `0.0.0.0` for LAN testing. By default, the browser derives the Lobby API and Socket.IO URLs from the hostname used to open the page:

- Lobby API: `http://<browser-host>:8001`
- Game transport: `http://<browser-host>:8000`

When the web client and game server run on different hosts, copy `.env.example` to `.env.local` and set `VITE_LOBBY_URL` and `VITE_GAME_URL` explicitly. Local storage holds the browser profile (name and avatar), client and public session IDs, preferred player count, room and seat IDs, and the boardgame.io seat credential needed for reconnecting. Game secrets and other players' credentials remain server-side.
