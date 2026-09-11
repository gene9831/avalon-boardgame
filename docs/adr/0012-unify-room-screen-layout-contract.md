---
status: accepted
---

# Unify the complete room lifecycle behind one layout contract

The browser-safe `@avalon/ui-layout` workspace package owns the DOM-free room metrics and round-table solver, plus the framework-independent room-shell class names, CSS variables, and structural stylesheet. Its public root exposes the production geometry and shell contract; detailed mathematical diagnostics remain behind `@avalon/ui-layout/diagnostics`. The shared structural stylesheet is imported from `@avalon/ui-layout/room-shell.css`.

`apps/web` renders loading, waiting lobby, identity recognition, team proposal, team vote, quest play, assassination, and final results through one React `RoomScreen`. Each state supplies presentation models and actions to the same room header, measured stage, player seats, quest track, utilities, and phase panel. `ResizeObserver` measures the final stage content box before calling `solveRoundTableStageLayout`; the solver receives only that width, height, and player count. If a landscape stage is infeasible, only the stage shows the unavailable state and the landscape business shell remains selected.

The Lab and Web are equal consumers of the shared package. The Lab owns preview controls, simulated data, and geometry inspection, but does not own a second solver or structural shell. The Web owns React composition, theme, real game state and actions, accessibility, reconnect behavior, logs, help, identity masking, and development-only DOM diagnostics.

The package must remain browser-safe and must not import React, DOM APIs, game state, server code, credentials, or secrets. Development diagnostics may expose rendered viewport, safe-area, canvas, stage, player-count, avatar-size, table-shape, and solver geometry, but never hidden game state or credentials.

This decision supersedes the game-only migration boundary in [ADR 0011](./0011-share-browser-safe-room-layout-package.md). The trade-off is that lobby and gameplay can no longer evolve independent structural layouts; lifecycle differences belong in presentation models and phase content instead.
