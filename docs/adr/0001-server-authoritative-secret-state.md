---
status: proposed
---

# Keep role and pending secret state server-authoritative

Role assignments, role visibility, pending team votes, and pending quest cards remain in the authoritative boardgame.io state on the server. Every browser receives only a player-specific `playerView`; the client is never trusted to hide fields from a complete game state. This protects hidden information across multiple rooms and keeps simultaneous submissions authoritative.

The consequence is that the client view is intentionally not a complete representation of `G`: it may contain the current player's own secret choice and safe submission progress, while omitting other players' choices and role data.
