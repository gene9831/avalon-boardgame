---
status: accepted
---

# Unify the complete room lifecycle behind one layout contract

`@avalon/ui-layout` remains browser-safe and owns the DOM-free round-table solver and the production `room-layout.css` structural contract. It must not import React, DOM APIs, game state, server code, credentials, or secrets.

Production Web composes loading, waiting lobby, identity recognition, every game phase, and final results through one `RoomScreen` and `RoomLayout`. `RoomLayout` supplies semantic chrome, stage, and phase-panel slots. CSS container queries in `@avalon/ui-layout/room-layout.css`—not `ROOM_SHELL_CLASSES` or JavaScript mode selection—select vertical, compact-landscape, and normal-landscape shapes. The stage region may be larger than the solver boundary; its centered measured stage content box is capped at 744×800 before `ResizeObserver` passes it to `solveRoundTableStageLayout`. `ResizeObserver` never chooses a business layout.

The old `room-shell.css` export remains exclusively for the existing layout Lab until a separately approved Lab migration. It is not imported by production Web.

The Web owns real public presentation state, interaction, accessibility, reconnect feedback, logs, help, identity masking, and development-only geometry diagnostics. Diagnostics may contain viewport, safe area, canvas, stage, player count, avatar size, and table shape only; they must never contain hidden game state, roles, credentials, or pending secret choices. `playerView` remains the hidden-information boundary.

The common phase panel has semantic heading, middle, and bottom-action slots. The bottom action is the sole state-changing phase action; reconnect recovery is the infrastructure exception. Lifecycle differences belong in presentation models and slot content, not separate structural shells. Identity recognition uses the same public round-table stage and may overlay private content only when the current player explicitly views it, as decided by [ADR-0013](./0013-independent-identity-recognition.md).

This supersedes the game-only migration boundary in [ADR 0011](./0011-share-browser-safe-room-layout-package.md). The trade-off is that lobby and gameplay share one structural contract, while their presentation remains independently modeled.
