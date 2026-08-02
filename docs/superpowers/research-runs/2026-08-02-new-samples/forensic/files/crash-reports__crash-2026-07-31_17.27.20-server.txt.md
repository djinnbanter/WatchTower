# Forensic file note — crash-reports/crash-2026-07-31_17.27.20-server.txt

**rel:** `crash-reports/crash-2026-07-31_17.27.20-server.txt`  
**kind:** crash  
**line_count:** 298  
**read_complete:** true  

## Time span
- First useful timestamp: 2026-07-31 17:27:20 (`Time:` field)
- Last useful timestamp: same (single crash snapshot)

## Session phases
- Boot: not represented (report is stop-path only)
- Runtime: Shtreimel snapshot shows **no active Sable dimensions**, 0 sub-levels — idle physics at stop
- Stop / crash / restart: **Server stopping** — `ServerLifecycleHooks.handleServerStopping` → `NeoForgeServerSparkPlugin.onDisable` → `AsyncProfilerJob.stop` throws while closing sampler

## Notable events
- Exception: `java.lang.IllegalStateException: Profiler job no longer active!` (spark 1.10.124)
- Description: Exception in server tick loop (misleading — stack is stop hook, not mid-tick gameplay)
- `Server Running: false`; `Player Count: 0 / 100`
- Memory: ~13.3 GiB committed / ~19 GiB max; swap used ~2904 MiB (host memory pressure visible, separate from spark exception)
- Watchtower present: `watchtower-neoforge-1.1.2+mc1.21.jar`
- NeoForge 21.1.247 / MC 1.21.1; Crash UUID `a98473a7-7de9-4d9e-8615-582d5e02b9e4`
- Sable/Shtreimel banner wraps all crashes in this corpus — does not imply Sable caused this one

## Player / ops impact
- Hurt vs quiet: **Quiet for players** — empty server at stop; no mid-session kick. Still creates a crash-report inbox item that can look like instability.

## Noise vs hurt
- Dominant spam patterns: none (single exception + system/mod list)
- Real incidents: shutdown-path Spark sampler hygiene only

## Surprises / script-blind candidates
- Framing as tick-loop exception + WT `mod_runtime` makes stop-path noise look like gameplay crash
- Swap nearly full (~2.9/4.1 GiB) in System Details — host pressure signal separate from spark

## WT relevance / Prior pass
- Related gap-matrix ids / FB-*: `crash-0731-spark` / **FB-06** (wrong_kind, bad_advice P2)
- Replay today: `failure_kind=mod_runtime`, primary `spark`, Fix "update or remove spark"
- Expected: `shutdown_noise`, non-issue / stop-path advice
- Ingestion: seen
