# Automated game-flow testing

Avalon's automated tests use one transcript format from the rule core through Socket.IO and the browser. Every randomized run has an explicit seed so a failure can be replayed without depending on timing or the machine that found it.

## Test layers

| Layer | What it protects | Command |
| --- | --- | --- |
| Rule replay and properties | 5–10-player base/paired-role rules, authoritative full-lobby fixtures, legal generated games, quest thresholds, victory paths, and `playerView` secrecy | `pnpm --filter @avalon/test-support test` |
| Socket.IO replay | The same transcript through real Lobby and Socket.IO clients, authoritative-state equivalence, and filtered client state | `pnpm --filter @avalon/server test` |
| PostgreSQL | Storage semantics, server restart reconnect, credential-bound state restoration, moved-owner persistence, seat-0 reuse, and persisted role configuration | `pnpm test:postgres` |
| PR browser gate | Atomic create-and-enter, lowest-empty automatic joins, seat-independent ownership, interrupted seat-change recovery across tabs, refresh reconnect, paired-role recognition/privacy, all four victory paths, and 5/7/10-player target-viewport operation | `pnpm test:e2e` |
| Nightly browser depth | Seeded 5–10-player complete games, the 7-player fourth-quest threshold, and two concurrently active isolated rooms | `pnpm test:e2e:matrix` |

The browser suite creates a separate Playwright context for each player. This is important because a single browser profile shares Avalon identity and credentials across tabs. E2E uses dedicated ports (`15183`, `18000`, and `18001`) and never reuses the developer's running LAN services. A runtime-generated test-only administration token enables the development panel without committing, logging, or exposing a token to Web configuration.

The automatic-seating acceptance creates the owner and session atomically, moves the owner away from seat 0, proves the next ordinary join reuses seat 0, and checks that concurrent joins receive the remaining lowest empty seats without client-selected seat IDs. It also covers the public full-room copy, moved-seat refresh reconnect, and keyboard operation of at least 44px empty-seat actions at 320×568. The route-lifecycle acceptance lets the server commit a seat change while delaying and replacing the browser response with a transient 503; the live requesting lease prevents stale-source invalidation, the uncertain marker recovers the credential at the target seat, and a second tab in the same browser adopts rather than clears the migrated session.

Paired-role coverage verifies exact Percival/Morgana decks, the fourth identity-recognition step, and that only Percival receives the indistinguishable Merlin/Morgana candidate set through `playerView`. The PostgreSQL restart scenario is meaningful only when `test:postgres` actually connects to PostgreSQL; an unavailable or unauthorized database must be reported as blocked instead of substituting memory storage.

## Seeds and replay

`masterSeed` is the public replay handle. `@avalon/test-support` derives separate boardgame.io and action-decision seeds with a versioned SHA-256 derivation. The replay artifact records the algorithm version, player count, seed, and commands, but never records credentials, admin tokens, or authoritative secret state.

Replay a generated game from the command line:

```bash
pnpm test:replay --seed nightly-2026-08-22-7p --players 7
```

Run the browser matrix with the same seed or a single player-count shard:

```bash
E2E_MASTER_SEED=nightly-2026-08-22-7p E2E_PLAYER_COUNT=7 pnpm test:e2e:matrix
```

fast-check prints its numeric seed and shrink path when a property fails. Replay that exact case with:

```bash
FAST_CHECK_SEED=<seed> FAST_CHECK_PATH='<path>' AVALON_PROPERTY_RUNS=1 pnpm --filter @avalon/test-support test
```

Keep the failing seed, player count, and transcript together in bug reports. A replay is tied to the recorded RNG algorithm version and code revision; if rules or the RNG algorithm change, retain the old version label when interpreting historical artifacts.

## GitHub Actions

`.github/workflows/ci.yml` runs on pull requests and pushes to `main`. Configure these job names as required branch-protection checks:

- `Quality`
- `Unit and Socket.IO replay`
- `PostgreSQL persistence and reconnect`
- `Browser smoke`

The PostgreSQL job creates a credential-bound game, stops the application, restarts the PostgreSQL service container, and reconnects with the original credential. Its temporary credential file is mode `0600`, stays inside the ephemeral runner, is not printed, and is deleted after verification.

`.github/workflows/nightly.yml` runs at 18:00 UTC (02:00 Asia/Shanghai) and can also be started manually. The scheduled master seed is `nightly-YYYY-MM-DD`; browser shards append `-<players>p`. The default property depth is 1,667 runs for each of the six player counts (10,002 generated games total). The property job logs the active player count, completed runs, percentage, and elapsed time at roughly 10% intervals. The 5-player browser shard also runs concurrent-room isolation; the 7-player shard runs both fourth-quest threshold outcomes. A manual run can provide a safe custom `master_seed` and 1–5,000 property runs per player count. Long property tests use a run-count-aware timeout, while each complete browser-matrix game has a 120-second timeout and the complete property job is capped at 20 minutes.

Browser-matrix replays report their completed and total command counts, current public phase and command type, player count, and elapsed time every 10 seconds. They never log command actors or payloads, so pending votes, quest cards, and assassination targets remain out of the diagnostic stream. CI records a Playwright trace only on the first retry; this removes trace overhead from the initial attempt while preserving a trace when a shard fails twice. Local runs keep trace-on-failure behavior because they do not retry. Failed property logs and Playwright traces/screenshots are retained as workflow artifacts for 30 days.

The nightly workflow runs entirely on GitHub-hosted runners. No scheduled process is installed on a developer computer.

## Scope boundary

Automation is the regression gate for application data and simulated browser viewports. The remaining [real-environment acceptance guide](lan-multiplayer-acceptance.md) covers only actual Node and PostgreSQL service restarts plus physical LAN devices, network paths, CORS, and Socket.IO behavior.
