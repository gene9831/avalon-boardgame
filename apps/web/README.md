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

The Vite server binds to `0.0.0.0` for LAN testing. By default, the browser derives the Lobby API and Socket.IO URLs from the hostname used to open the page:

- Lobby API: `http://<browser-host>:8001`
- Game transport: `http://<browser-host>:8000`

When the web client and game server run on different hosts, copy `.env.example` to `.env.local` and set `VITE_LOBBY_URL` and `VITE_GAME_URL` explicitly. The browser stores only its room ID, seat ID, player name, and boardgame.io reconnect credentials in local storage; game secrets remain server-side.
