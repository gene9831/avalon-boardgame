---
status: accepted
---

# Keep room ownership independent from seat 0

The player who creates a room remains its owner while the room is waiting, even after moving to another empty seat. The authoritative lobby state records the owner's current player ID, and the credential bound to that current seat authorizes starting or dissolving the room; seat 0 has no inherent authority. Creating and initially seating the owner, joining, leaving, and changing seats update authoritative lobby state and boardgame.io metadata atomically under the match queue so ownership, occupancy, public player data, and credentials cannot diverge.

The owner must remain seated, cannot transfer ownership, and must dissolve the waiting room instead of leaving it. Seat changes are limited to unoccupied seats before play, preserve the player's existing credential by rebinding it to the destination, and leave the source unchanged on failure. Existing rooms without explicit ownership treat the current seat 0 occupant as owner; an old waiting room with an empty seat 0 is considered ownerless and cannot accept new joins. Because older servers would restore seat-0 authority after an owner has moved, rollback requires confirming that no such waiting room exists or disabling affected rooms before downgrade.
