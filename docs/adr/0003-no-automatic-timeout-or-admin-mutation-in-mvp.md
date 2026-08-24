---
status: accepted
---

# Do not auto-advance or mutate rooms through administration in the MVP

Timeout configuration is part of the room setup shape but is disabled by default, and the MVP has no automatic timeout move for a strategic game decision. The web Debug mode is read-only, and there is no room administrator or system administrator who can alter a game. A disconnected player therefore blocks team proposals, votes, quest cards, and assassination until the original seat reconnects; no settled event can be reset or rewritten.

This preserves the original game's decision integrity and keeps the first implementation focused on server authority, reconnect behavior, and rule correctness. Safe recovery commands may be considered later as a separate design decision with explicit audit and rule tests.

The opening identity-recognition ceremony also waits for every current participant and exposes no countdown in the first release. [ADR-0006](0006-server-authoritative-identity-recognition-deadlines.md) retains a disabled server-authoritative deadline design for a later, explicit room-creation option.
