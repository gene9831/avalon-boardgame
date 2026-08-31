# Final whole-branch findings fix report

## Outcome

- Base: `6178a5e fix(web): prevent exit during seat recovery`.
- Target commit: `fix: close final automatic seating regressions`. The exact resulting hash is reported by the controller after this report and the implementation are committed together; a commit cannot embed its own final hash.
- Same-room seat moves now use the browser Web Locks API with an exclusive per-match lock and `ifAvailable`. Marker recheck, exact-source-session recheck, transition creation, request, and completion remain inside that lock. A second tab does not queue, and persisted `requesting`, `uncertain`, or legacy work rejects a new request.
- Completion and post-validation recovery mutations recheck both the opaque transition ID and source session. Late old success, failure, or recovery work adopts or preserves newer state instead of overwriting or clearing it.
- Storage events now rerender the persisted transition guard used by empty-seat actions as well as exit/dissolve controls. The real two-tab browser regression observes disabled empty-seat controls and exactly one seat request while the first tab owns the transition.
- Lobby failures preserve the server `{ error: { code, message } }` envelope, so stable join codes retain approved copy and room-directory refresh behavior.
- Percival candidate badges follow the same private-knowledge gate as other faction knowledge, disappear at game over, and add `Merlin 候选` to each marked parent seat's accessible name. Both marker visuals remain identical and derive only from `playerView`.
- Merlin keeps `knownEvilPlayerIDs` through paired `percivalRecognition`; the legacy three-step flow is unchanged. Ownerless legacy lobby rooms no longer expose a join action.
- The user-owned untracked `images/` directory was not staged, modified, or removed. No push, history rewrite, or integration was performed.

## RED/GREEN evidence

- Initial RED: `pnpm --filter @avalon/web test -- room-session.test.ts room-participation.test.ts join-error.test.ts room-directory.test.ts LobbyView.test.tsx RoomGamePanel.test.tsx` ran the Web suite and failed 12 intended regressions: two stale completion fences, two lock/marker exclusions, three real Lobby envelope classifications, ownerless join logic and UI, and three Percival presentation cases. Result: 6 failed / 22 passed files; 12 failed / 202 passed tests.
- Recovery-fence RED: `pnpm --filter @avalon/web test -- room-session.test.ts` failed the intended post-validation newer-marker race: 1 failed / 215 passed tests across the Web suite.
- Focused GREEN: the affected Web command passed 28 files / 216 tests; `pnpm --filter @avalon/game test -- setup-and-view.test.ts` passed 7 files / 88 tests. Vitest runs each package's complete suite even when filenames follow `--`.
- The first compile check exposed an incorrect nullable narrowing in the new recovery helper. After making null, mismatched-session, and exact-source branches explicit, the Web build and focused suites passed.
- The first sandboxed Playwright run could not bind `0.0.0.0:18001` (`EPERM`). The authorized outside-sandbox focused run then passed 4/4 in 36.9 seconds.

## Final verification

- `pnpm test` — exit 0: Game 7 files / 88 tests; test-support 5 files / 23 tests; Server 15 files / 83 tests; Web 28 files / 216 tests; 410 tests total.
- `pnpm build` — exit 0: Game and Server TypeScript plus Web TypeScript/Vite passed; 2,014 modules transformed. Vite retained one advisory warning for a 538.03 kB minified / 162.30 kB gzip JavaScript chunk.
- `pnpm lint` — exit 0, no diagnostics.
- `pnpm typecheck` — exit 0 for Game, test-support, Server, Web, and E2E.
- `pnpm --filter @avalon/e2e test:e2e refresh-and-privacy.spec.ts identity-recognition.spec.ts` — 4 passed in 36.9 seconds.
- `pnpm test:e2e` — 18 passed / 9 nightly skipped in 1.9 minutes.
- Playwright emitted only the existing Node warning that `NO_COLOR` is ignored while `FORCE_COLOR` is set; no business warning/error was observed.
- `git diff --check`, `git diff --cached --check`, and `jq empty docs/rules/base-config.json` — exit 0 before commit.
- Playwright's generated `tests/e2e/test-results/.last-run.json` was removed; no screenshot, video, trace, dump, environment file, or diagnostic artifact remains.

## Remaining concerns

- PostgreSQL restart/reconnect acceptance remains blocked by the unavailable/unauthorized real target. This round did not rerun the PostgreSQL suite and did not substitute memory storage.
- Real 5–10-device LAN, physical-device CORS/Socket.IO, multi-room manual isolation, and deployment PostgreSQL restart acceptance remain pending.
- The Web production bundle retains the greater-than-500-kB advisory warning.
- No current-commit CI run is claimed; earlier GitHub results remain historical only.
