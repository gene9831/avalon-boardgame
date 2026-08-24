---
status: accepted
---

# Retain optional server-authoritative identity-recognition deadlines

The first release does not display or use an identity-recognition countdown. Each opening step advances only after every current participant confirms. The server deadline option defaults to disabled, and the web client sends no deadline wake-up requests.

The server retains the previously designed deadline calculation, validation, persisted timeline, restart marker, and stale wake-up protection behind an internal option. Explicitly enabled tests continue to cover these paths so a later room-creation setting can use them without trusting a browser clock. Adding that room setting and its UI is a separate future change.

When the internal option is explicitly enabled, late confirmations first advance
the expired step on its original timeline and are never counted as confirmations
for the next step. A server restart resets the current step's anonymous
confirmations and grants it a fresh deadline before accepting a confirmation.

Confirmation and wake-up moves are omitted entirely from both live client logs
and persisted game logs. Argument redaction alone is insufficient because
boardgame.io retains the acting player ID, which would reveal Evil or Merlin
seats during their private recognition steps.

The persisted secret state records a server-instance marker alongside the
confirmed player IDs. It is dormant while deadlines are disabled.
