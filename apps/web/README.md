# `@avalon/web`

This package provides the LAN Lobby and the current in-room Avalon UI slice.

The browser uses two routes:

- `/` is the lobby for creating and joining rooms.
- `/rooms/:matchID` is the room page for one match. It includes seat status,
  reconnect controls, role visibility, team proposal, and team voting. Quest
  card, assassination, and final-result panels are planned next. The room page
  has a `返回主页` button; returning home keeps this browser's seat credentials so
  the recent room can be reopened.

Each browser profile uses a stable local client ID when joining. The server
rejects that client ID (and duplicate player names) if it tries to occupy a
second seat in the same room. This is a seat-binding guard for the no-account
LAN MVP, not an account-level identity system.

Run it from the workspace root:

```bash
pnpm dev
```

The Vite server binds to `0.0.0.0` for LAN testing. By default, the browser derives the Lobby API and Socket.IO URLs from the hostname used to open the page:

- Lobby API: `http://<browser-host>:8001`
- Game transport: `http://<browser-host>:8000`

When the web client and game server run on different hosts, copy `.env.example` to `.env.local` and set `VITE_LOBBY_URL` and `VITE_GAME_URL` explicitly. The browser stores only its room ID, seat ID, player name, and boardgame.io reconnect credentials in local storage; game secrets remain server-side.
