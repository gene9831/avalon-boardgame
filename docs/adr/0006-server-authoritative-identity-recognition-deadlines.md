---
status: accepted
---

# Use server-authoritative deadlines for opening identity recognition

The three opening identity-recognition steps advance when all current participants confirm or their server-owned 10-second deadline expires. Browsers may wake the server at a deadline, but the server validates its own clock; no browser can choose or shorten the deadline, and the deadline never supplies a strategic game choice. This keeps an online ceremony from being blocked by a hidden or disconnected participant without weakening ADR-0003's ban on automatic team, vote, quest-card, and assassination decisions.

The current step and deadline persist through ordinary reconnects so an expired ceremony can catch up along its original timeline. After a game-server restart, completed steps remain complete, while the current step clears its anonymous confirmations and receives a fresh 10-second deadline because process-local clock continuity is not assumed.

Each filtered player view includes a server-time snapshot. Browsers derive the
remaining duration from that snapshot and local elapsed time, retrying the same
step/deadline wake-up until the authoritative state changes. Browser wall-clock
skew therefore cannot shorten a deadline or permanently suppress a wake-up.
Late confirmations first advance the expired step on its original timeline and
are never counted as confirmations for the next step.

Confirmation and wake-up moves are omitted entirely from both live client logs
and persisted game logs. Argument redaction alone is insufficient because
boardgame.io retains the acting player ID, which would reveal Evil or Merlin
seats during their private recognition steps.

The persisted secret state records a server-instance marker alongside the
confirmed player IDs. A new process must replace that marker, clear current-step
confirmations, and establish the fresh deadline before it accepts a confirmation.
