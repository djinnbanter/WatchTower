# WatchTower code map — 2026-08-02 sample gap run

Signal → reader/classifier/advisor map for corpus `samples/new samples 02.08.2026`. Signal ids from `tools/sample-gap-research/lib/patterns.mjs`. Sources cited below are under `watchtower-core/src/main/java/dev/mcstatus/watchtower/core/`.

## Signal → component map

| signal_id | wt_component | captures? | notes |
|-----------|--------------|-----------|-------|
| `server_done` | `LogScanner` (`StartupProfileScanner.isDoneBootLine`, `LogPatterns.DONE_BOOT`) | yes | Sets `server_started`, emits `server_start` event, flips `ModLogAnalyzer` boot window off. |
| `server_stop` | `LogScanner` | yes | Sets `clean_shutdown_seen`; emits `clean_stop` event with evidence. |
| `tick_lag_cant_keep_up` | `LogScanner`, `OpsLogTailScanner`, `FactsBuilder` → `IssuesLiveEvaluators` (`TICK_LAG`) | partial | Both scanners match `Can't keep up` + `LogPatterns.TICK_LAG_MS`. LogScanner dedupes and keeps ≤5 evidence lines; OpsLogTail throttles (≥`tickLagThrottleMs` ms behind, 60 s between ledger events). Corpus had 2,254 lines on Aug 1 — counts are deduped, not raw line totals. |
| `watchdog_fatal` | `LogScanner` (`LogPatterns.WATCHDOG_FATAL_LOG`), `CrashReportScanner`, `CrashClassifier` (`FK_WATCHDOG` / `FK_WATCHDOG_PREGEN`), `CrashNarrator`, `IncidentChainBuilder` | partial | Log FATAL lines folded into tick-lag path in `LogScanner`. Crash files classified as watchdog. `IncidentChainBuilder` links a subsequent watchdog to a prior `mod_runtime` primary within 120 s (`FK_WATCHDOG_FOLLOWUP`) — relevant to Aug 1 20:43 and 21:50 pairs. Does not ingest watchdog from log lines alone as a crash row. |
| `oom_heap` | `LogScanner` (`LogPatterns.OOM_LOG`), `FactsBuilder` (`OOM` / `OOM_HEAP`) | yes | Sets `oom_in_logs`, collects `oom_evidence`, emits `oom` timeline events. |
| `nosuchmethod` | `CrashReportScanner`, `CrashMtimeScanner`, `CrashClassifier`, `CrashNarrator` | partial | Crash indexed and classified `mod_runtime` via `isModRelated`; no dedicated `NoSuchMethodError` / API-mismatch `failure_kind` or Fix hint. OPAC NSM crashes get generic mod-update advice. |
| `spark_profiler_inactive` | `CrashReportScanner`, `CrashMtimeScanner`, `CrashClassifier`, `CrashNarrator` | partial | Jul 31 shutdown crash indexed and narrated as `mod_runtime`; no shutdown-noise exemption (`should_be_issue: false` in census). |
| `sable_body_removed` | `CrashReportScanner`, `CrashMtimeScanner`, `CrashClassifier`, `CrashNarrator` | yes | Aug 1 21:49 crash indexed; `Body has been removed` stack → `mod_runtime` with primary mod from TRANSFORMER line. No Sable-specific advisor text. |
| `jade_invwrapper_npe` | — | no | `wt_readers: []` in patterns. `GzipLineReader.iterLogFiles` reads `latest.log`, `debug.log`, and `*.log.gz` only — not `logs/JadeErrorOutput.txt`. Sidecar has 67 NPE lines; 1,173 corpus-wide includes scattered latest.log hits. |
| `kubejs_recipe_parse` | `ModLogAnalyzer` (`ModErrorCategory`), `OpsLogTailScanner` (`LogPatterns.KUBEJS_ERROR`, `SilentFailSignatures`) | partial | Census pattern `Failed to parse recipe|KubeRecipe` ≠ `ModErrorCategory` trigger `Parsing error loading recipe`. Dedicated `logs/kubejs/server.log` not in `LogScanner` file set (ingestion checklist: partial). KubeJS ERROR lines in `latest.log` tail get `kubejsFailures` / silent-fail hits with path capture when same-line. |
| `createfood_recipe` | `ModLogAnalyzer` (`ModErrorCategory` recipe / `LOGGER_ERROR`) | partial | ~51k census lines are mostly WARN/recipe noise. Analyzer caps per mod (`MAX_MODS=25`, `MAX_RECIPES=5`, `MAX_SAMPLES=3`); only ERROR-classified lines attribute reliably. `should_be_issue: false` — noise, not crash driver. |
| `distxform_client` | `ModLogAnalyzer` (`ModErrorCategory.CLIENT_ON_SERVER` or `LOGGER_ERROR`) | partial | ~1,896 lines. `CLIENT_ON_SERVER` only on `Attempted to load class net/minecraft/client`; `RuntimeDistCleaner/DISTXFORM` lines often land as generic `logger_error` on the offending mod. Boot noise, rarely actionable alone. |
| `loot_parse` | `ModLogAnalyzer` (`ModErrorCategory.LOOT_PARSE`), `StartupProfileScanner`, `StartupPhaseMarkers` | yes | `Couldn't parse element ResourceKey` → `loot_parse` category. ~27k corpus lines; attributed per mod with same `ModLogAnalyzer` caps. |
| `db_addon_fail` | `ModLogAnalyzer` (`ModErrorCategory.LOGGER_ERROR`) | partial | GriefLogger `Database connection failed` (~70 lines) captured only when line is ERROR/FATAL with a resolvable mod logger — no dedicated DB-addon category. |
| `player_join` | `LogScanner` (`LogPatterns.PLAYER_JOIN*`), `OpsLogTailScanner` (activity ledger) | yes | Join patterns in both scanners; `PlayerTracker` replay in full scan. Activity ledger capped at `MAX_LEDGER_EVENTS` (1500). |
| `opac_better_commands` | `CrashReportScanner`, `CrashMtimeScanner`, `CrashClassifier`, `CrashNarrator` | partial | Mod id appears in every crash mod list (290 census hits); actionable only on Aug 1 NSM crashes. Classified `mod_runtime`; API/version mismatch between OPAC Better Commands 1.5 and OpenPartiesAndClaims 0.29.3 not surfaced in Fix text. |

## Source files (read for this map)

| Path | Role |
|------|------|
| `collect/GzipLineReader.java` | Log file enumeration (`latest.log`, `debug.log`, rotated `.log.gz`; no sidecars) |
| `collect/LogScanner.java` | Full-window log scan: lifecycle, tick lag, OOM, player events, `ModLogAnalyzer` pass |
| `ops/OpsLogTailScanner.java` | Incremental `latest.log` tail (4 MB cap); activity, tick lag, KubeJS, silent-fail |
| `collect/LogPatterns.java` | Shared regex: `DONE_BOOT`, `OOM_LOG`, `WATCHDOG_FATAL_LOG`, `PLAYER_JOIN`, `KUBEJS_ERROR`, tick lag |
| `collect/CrashReportScanner.java` | Filesystem crash-reports scan for staging / report |
| `collect/CrashMtimeScanner.java` | Ops-cache crash mtime poll + classify/narrate budget |
| `analyze/CrashClassifier.java` | `failure_kind` taxonomy (`watchdog`, `mod_runtime`, …) |
| `analyze/CrashNarrator.java` | Plain-English crash summaries and Fix hints |
| `collect/ModLogAnalyzer.java` | Per-mod ERROR attribution with caps |
| `collect/SilentFailSignatures.java` | KubeJS/CraftTweaker/datapack same-line path capture |
| `ops/IssuesLiveEvaluators.java` | Live `TICK_LAG` / MSPT issue surfacing |
| `analyze/IncidentChainBuilder.java` | Watchdog follow-up linkage (120 s window) |
| `analyze/ModErrorCategory.java` | Recipe, loot, client-on-server, logger_error classifiers |
| `analyze/FactsBuilder.java` | Staging → facts/issues bridge for tick lag, OOM, crashes |

## Known limits (this corpus)

### OpsLogTail 4 MB / scan

`OpsLogTailScanner.MAX_BYTES_PER_SCAN = 4 * 1024 * 1024`. Each incremental poll reads at most 4 MB of unread `latest.log` bytes; larger gaps set `truncated` on the offset and may defer to `ActivityGapBackfill`. Heavy Aug 1 tick-lag bursts can leave mid-gap lines unprocessed until subsequent polls catch up.

### Crash enrich budget

`CrashMtimeScanner.BACKGROUND_NARRATE_BUDGET = 20` classify/narrate operations per background poll when fingerprints are unchanged. First boot with an empty fingerprint ledger seeds up to `BOOT_SEED_UNREVIEWED_MAX = 25` unreviewed crashes. Manual dashboard Scan (`forceReenrich`) re-classifies the full folder. Kill-switch: `CRASH_ENRICH_ON_MTIME=false` skips head enrichment entirely. Six crash files in this corpus — all enriched on first poll, but large `crash-reports/` folders on other servers can lag.

### KubeJS sidecar partial

`logs/kubejs/server.log`, `startup.log`, and `client.log` are inventoried by census but **not** in `GzipLineReader.iterLogFiles`. KubeJS signals in `latest.log` are partially captured via `OpsLogTailScanner` (`KUBEJS_ERROR`, `SilentFailSignatures`) and `ModLogAnalyzer` when lines match `ModErrorCategory.KUBEJS_SCRIPT`. Recipe-parse WARN flood in kubejs sidecars is census-visible only.

### Jade unread

`logs/JadeErrorOutput.txt` is a dedicated sidecar (67 `InvWrapper.getInv()` NPEs). No WatchTower reader opens it today. Jade is listed in `ModSideScorer` client-mod hints and `SparkParser` mod filter only — not log ingestion.

### Recipe WARN flood risk

Corpus: ~51,694 `createfood` + ~56,080 `kubejs_recipe_parse` lines, mostly WARN-level recipe parse noise during boot/reload. `ModLogAnalyzer` keeps top 25 mods, 5 recipes, and 3 sample lines per mod — high volume can drown actionable recipe errors in Issues/mod peek and inflate boot-noise perception. Census `should_be_issue: false` for `createfood_recipe`; treat as hygiene, not outage.

### Watchdog follow-up linkage

`IncidentChainBuilder.link` pairs a `mod_runtime` (or `category=mod`) crash with a watchdog crash ≤120 s later, rewriting the follow-up `failure_kind` to `watchdog_followup` and setting shared `incident_id` + `paired_primary_file`. Applies to Aug 1 20:43 and 21:50 watchdogs after earlier tick-loop crashes. Requires both rows in the crash summaries array; log-only watchdog FATAL lines do not participate. UI surfacing of chains is data-only (G-11).
