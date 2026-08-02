# Sample-gap fixes — Phase 3: joinability and GriefLogger (design)

**Date:** 2026-08-02  
**Status:** Approved for planning  
**Research:** [`docs/superpowers/research-runs/2026-08-02-new-samples/`](../research-runs/2026-08-02-new-samples/)  
**Backlog:** FB-11, FB-12, FB-13  
**Depends on:** Phase 2 helpful for log coverage; Phase 3 can ship alone if patterns appear in `latest.log` / rotates already scanned

## Goal

Surface three underweighted operational signals from the Jul 29 sample: login disconnect storm (server up but unplayable), MariaDB ACL / GLRA DB-addon failures, and GriefLogger × Create mounted-storage NPE.

## Scope

| In | Out |
| -- | --- |
| FB-12 Jul 29 login disconnect storm | Crash intel (Phase 1) |
| FB-11 GriefLogger MariaDB ACL / GLRA | Jade/KubeJS ingestion (Phase 2) |
| FB-13 GriefLogger × Create mounted-storage NPE | Auto-fixing DB configs |

## Current behavior (facts)

- Join clinic (`JoinRejectionSignatures` → `JoinClinicAnalyzer` → `IssuesLiveEvaluators.fromJoinClinic`) focuses on pack-sync / missing mod / channel mismatch disconnects. Ordinary timeouts ignored.
- `LogScanner` emits `disconnect_storm` on ≥5 **player leave** events in 60s — not login-listener disconnects (`ServerLoginPacketListenerImpl` / “Disconnected” during login with almost no joins).
- GriefLogger MariaDB / GLRA failures land as generic `LOGGER_ERROR` when ERROR + resolvable logger; no ACL (1130) narrative; GLRA often flattened to `grieflogger`.
- GL×Create `ContainerHandler` NPE on `contraption_interact` / menuProvider null is FATAL-task-without-crash-report; may be generic logger/create.

## Target behavior

| FB | Behavior |
| -- | -------- |
| FB-12 | Detect high login-path disconnect count vs successful joins in a window; Issues / join-clinic-adjacent signal: server up but unjoinable (`signal_login_storm` / joinability posture) |
| FB-11 | Dedicated DB-addon signal: MariaDB host ACL (1130) disabling core GriefLogger; persistent GLRA (`griefloggerrollbackaddon`) connection fail with config-oriented Fix |
| FB-13 | Compat signal: GriefLogger ContainerHandler + Create mounted storage / `contraption_interact` + menuProvider null; distinct from FB-11 |

## Architecture

1. **Login storm:** In `LogScanner` (and optionally join clinic feed), count lines matching login disconnect (`ServerLoginPacketListenerImpl` + Disconnected / similar) vs successful join patterns over a rolling window or per-scan aggregate. Emit event or IssuesLive key when disconnects ≫ joins (thresholds from fixture: ~199 disconnects, ~0–1 joins over ~4h session → use ratio or absolute floor, e.g. ≥20 login disconnects and join_success ≤ 10% of disconnects in scan window).
2. **DB addon:** Extend `ModErrorCategory` or a small `DbAddonSignatures` matcher for MariaDB ACL 1130 + `Database connection failed` with logger `grieflogger` / `griefloggerrollbackaddon`. Prefer attributing persistent post-recovery fails to GLRA when evidence names the addon.
3. **GL×Create NPE:** Signature on `ContainerHandler` + `menuProvider` + Create contraption/mounted storage frames → dedicated hit category or silent-fail kind `grieflogger_create_compat`.

Wire into `IssuesLiveEvaluators` with plain-English titles and config/compat Fix hints. Caps apply (max Issues entries).

## Testing

- `samples/fixtures/log-intelligence/login-storm-0729/` — excerpt from `2026-07-29-7.log.gz` or synthetic lines
- `samples/fixtures/log-intelligence/grieflogger-db-addon/` — ACL 1130 + GLRA fail lines
- `samples/fixtures/log-intelligence/grieflogger-create-npe-0729/` — ContainerHandler NPE excerpt
- Unit tests for signatures + IssuesLive emission; assert FB-11 and FB-13 do not collapse into one issue id

## Constraints

- Advisory only; never rewrite MariaDB grants or disable mods automatically.
- Plain English; distinguish boot-config DB fail from runtime Create compat NPE.
- Do not treat login storm as a crash/outage without login evidence.

## Plain English

After Phase 3, WatchTower says when nobody can get in despite the process running, when GriefLogger’s database setup is broken (and which addon), and when GriefLogger trips over Create contraptions — instead of burying those as generic logger noise.
