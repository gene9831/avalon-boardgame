---
status: accepted
---

# Serialize identity confirmation before concurrent clue recognition

Identity recognition has two globally ordered, server-authoritative stages. First, every seated player independently confirms their own role. A player who finishes early waits and may review only their own role; no role-specific seat knowledge is released until all players cross this barrier. Second, Evil players, Merlin, and enabled Percival recognize their authorized clues concurrently, while roles without clues wait. The ceremony advances to team proposal only after every clue participant completes; it has no deadline or administrative skip.

Public state exposes the current ceremony stage and only its anonymous completed/participant counts. `playerView` exposes only the current viewer's personal stage and releases authorized knowledge at the global clue barrier. This replaces both the former global Evil–Merlin–Percival role queue and the later model that let one player enter clue recognition while another was still viewing their identity. There is no observer curtain. Confirmation moves and their logs remain server-authoritative and privacy-redacted.

Existing persisted rooms are intentionally incompatible and must be removed before rollout. The implementation contains no legacy-state adapter, old-flow fallback, or automatic destructive startup migration.
