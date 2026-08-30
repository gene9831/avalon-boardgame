---
status: accepted
---

# Keep roles and pending secret choices server-authoritative

Role assignments, role visibility, pending team-vote choices, and pending quest cards remain in the authoritative boardgame.io state on the server. Every browser receives only a player-specific `playerView`; the client is never trusted to hide fields from a complete game state. This protects hidden information across multiple rooms and keeps simultaneous submissions authoritative.

Before a team vote settles, `playerView` may expose which players have submitted as public status metadata, but it exposes no other player's approval or rejection. The current player may still receive their own submitted choice. After every vote is collected, the complete player-to-vote mapping moves atomically into public resolved-vote history. Quest-card submission status remains anonymous because a completed quest must never associate a player with a Success or Fail card.
