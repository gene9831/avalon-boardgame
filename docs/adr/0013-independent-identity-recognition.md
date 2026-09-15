---
status: accepted
---

# Run identity recognition as independent private player workflows

Every seated player progresses independently through private identity confirmation and any role-specific clue recognition. Public state exposes only the anonymous number of fully completed players, while `playerView` exposes only the current viewer's personal stage and authorized knowledge. The ceremony advances to team proposal only after every player completes; it has no deadline or administrative skip.

This replaces the global Evil–Merlin–Percival sequence and its observer curtain. Independent progress better matches simultaneous in-person recognition without revealing which role group is active or making one role group wait for another. Confirmation moves and their logs remain server-authoritative and privacy-redacted.

Existing persisted rooms are intentionally incompatible and must be removed before rollout. The implementation contains no legacy-state adapter, old-flow fallback, or automatic destructive startup migration.
