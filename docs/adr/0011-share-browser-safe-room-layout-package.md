---
status: superseded by ADR 0012
---

# Share browser-safe room layout through a workspace package

The round-table stage solver and three-mode room-shell resolver live in the browser-safe `@avalon/ui-layout` workspace package. Its root export is the stable application contract: `solveRoundTableStageLayout`, `resolveRoomShellMetrics`, and their public geometry types. Mathematical diagnostics remain available only through the explicit `@avalon/ui-layout/diagnostics` subpath for the layout Lab.

Both `apps/ui-layout-lab` and `apps/web` consume this package. Neither application may copy the solver or maintain a direction-specific implementation. The room shell selects vertical, compact-landscape, or normal-landscape from the measured business canvas. The Web game page then measures the final stage content box with `ResizeObserver` and calls the stage solver using only that measured width, height, and player count; stage direction therefore remains independent from the business-shell mode.

This decision originally applied only to the active game page. [ADR 0012](./0012-unify-room-screen-layout-contract.md) supersedes that transitional scope by adopting the same structural contract for the complete room lifecycle, including the waiting lobby.

The additional package boundary prevents prototype and production geometry from drifting and keeps DOM, React, game state, server code, and secrets out of the pure layout module. The trade-off is another workspace build and API surface that must remain browser-safe and backwards-compatible for both consumers.
