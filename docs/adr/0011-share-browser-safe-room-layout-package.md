---
status: accepted
---

# Share browser-safe room layout through a workspace package

The round-table stage solver and three-mode room-shell resolver live in the browser-safe `@avalon/ui-layout` workspace package. Its root export is the stable application contract: `solveRoundTableStageLayout`, `resolveRoomShellMetrics`, and their public geometry types. Mathematical diagnostics remain available only through the explicit `@avalon/ui-layout/diagnostics` subpath for the layout Lab.

Both `apps/ui-layout-lab` and `apps/web` consume this package. Neither application may copy the solver or maintain a direction-specific implementation. The room shell selects vertical, compact-landscape, or normal-landscape from the measured business canvas. The Web game page then measures the final stage content box with `ResizeObserver` and calls the stage solver using only that measured width, height, and player count; stage direction therefore remains independent from the business-shell mode.

This decision applies to the active game page. The waiting-room `RoundTable` remains a separate presentation so this migration does not silently change `RoomLobbyPanel`. If the waiting room later adopts the shared solver, that is an explicit migration with its own responsive regressions.

The additional package boundary prevents prototype and production geometry from drifting and keeps DOM, React, game state, server code, and secrets out of the pure layout module. The trade-off is another workspace build and API surface that must remain browser-safe and backwards-compatible for both consumers.
