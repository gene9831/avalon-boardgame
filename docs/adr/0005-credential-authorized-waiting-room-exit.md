---
status: superseded by ADR-0009
---

# Allow credential-authorized departure from waiting rooms

An occupied player may leave only while an Avalon match is still in the lobby. A non-host player can release only their own seat, authenticated by that seat's boardgame.io player credential. Seat 0 cannot be released through the ordinary leave operation; its player may instead dissolve the waiting room. Public client IDs and join session IDs are not authentication, and development administration tokens are not used by these player-facing operations.

Leaving clears the player's public name and data, marks the seat disconnected, rotates its credential, and uses the same versioned metadata write path that prevents stale writes from restoring removed players. Dissolving marks the match unavailable before wiping it so delayed synchronization cannot recreate it. Both operations run through the match queue and recheck that the game is still waiting; once play begins they return a conflict and preserve the seat credentials.

Returning to the homepage remains a non-destructive navigation action. Host transfer, leaving an active game, automatic forfeits, replacement players, and administrative game-state advancement remain outside the MVP.
