# `@avalon/web`

This package provides the LAN Lobby and room waiting screen for Avalon.

The browser uses two routes:

- `/` is the lobby for creating and joining rooms.
- `/rooms/:matchID` is the waiting room for one match. The room page has a
  `返回主页` button; returning home keeps this browser's seat credentials so
  the recent room can be reopened.

Run it from the workspace root:

```bash
pnpm dev
```

The Vite server binds to `0.0.0.0` for LAN testing. By default, the browser derives the Lobby API and Socket.IO URLs from the hostname used to open the page:

- Lobby API: `http://<browser-host>:8001`
- Game transport: `http://<browser-host>:8000`

When the web client and game server run on different hosts, copy `.env.example` to `.env.local` and set `VITE_LOBBY_URL` and `VITE_GAME_URL` explicitly. The browser stores only its room ID, seat ID, player name, and boardgame.io reconnect credentials in local storage; game secrets remain server-side.
