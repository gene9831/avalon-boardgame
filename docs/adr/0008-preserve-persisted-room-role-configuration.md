---
status: accepted
---

# Preserve persisted room role configuration across default changes

Role configuration is captured when a room is created and remains fixed for that room. Persisted rooms created before role configuration existed are interpreted as using the original base roles, while newly created rooms use the current default configuration. This prevents a deployment, restart, or future default change from altering an existing room's rules, preserves rollback compatibility, and avoids destructive data deletion or backfilling.
