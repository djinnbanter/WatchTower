# Gap matrix — 2026-08-02-new-samples

Sample root: `samples/new samples 02.08.2026`  
Sources: `timeline.md`, `crash-replay.json`, `census.json`, `code-map.md`, `ingestion-checklist.md`

| id | ground_truth | wt_failure_kind | wt_primary | wt_fix_summary | tags | severity | notes |
| -- | ------------ | --------------- | ---------- | -------------- | ---- | -------- | ----- |
| crash-0731-spark | Spark shutdown crash Jul 31 17:27: `IllegalStateException: Profiler job no longer active!` during `ServerLifecycleHooks.handleServerStopping` — stop-path hygiene, not mid-session gameplay instability | `mod_runtime` | `spark` | Update or temporarily remove mod `spark`, then restart | `wrong_kind`, `bad_advice` | P2 | **Seed 1 confirmed.** Census `spark_profiler_inactive` (`should_be_issue: false`). Replay treats shutdown noise as gameplay mod crash; Fix implies instability. Should be shutdown-noise / non-issue, not generic mod_runtime. |
| crash-0801-opac-cmd | Aug 1 19:24 OPAC API mismatch: `NoSuchMethodError` on `IServerData.getPlayerConfigs()` via party chat **command** (`opac_better_commands` 1.5 vs `openpartiesandclaims` 0.29.3) | `mod_runtime` | `opac_better_commands` | Update or temporarily remove mod `opac_better_commands`, then restart | `wrong_kind`, `bad_advice` | P1 | **Seed 2 confirmed.** Primary mod correct; `failure_kind` is generic `mod_runtime` with no API/version-mismatch signal. Fix should name OPAC version alignment or remove Better Commands until compatible — not vague jar/conflict advice. |
| crash-0801-opac-listener | Aug 1 20:42 same OPAC `NoSuchMethodError` via party chat **listener** (`PartyChatListener.onServerChat`) — same root cause, chat path | `mod_runtime` | `opac_better_commands` | Update or temporarily remove mod `opac_better_commands`, then restart | `wrong_kind`, `bad_advice` | P1 | **Seed 2 confirmed** (second entry point). Immediate precursor to watchdog at 20:43. Same classification/advice gap as command crash. |
| crash-0801-watchdog-2043 | Aug 1 20:43 watchdog ~60 s after OPAC listener crash #3 — follow-up hang, not independent root incident | `watchdog` | `c2me_base` | Read watchdog thread dump; pause Chunky/DH if in dump; reduce sim distance if MSPT high | `linkage`, `wrong_primary`, `bad_advice` | P1 | **Seed 3 confirmed.** Replay shows standalone `watchdog` / `host_resource` with `c2me_base` primary (63 s after OPAC crash). `IncidentChainBuilder` exists but replay harness does not emit `watchdog_followup` or `paired_primary_file`. Operator sees unrelated lag hang, not OPAC crash sequel. |
| crash-0801-sable | Aug 1 21:49 Sable `RuntimeException: Body has been removed` during `SubLevelSerializer` / world save; active Create `CarriageContraptionEntity` + two Sable sublevels | `mod_runtime` | `sable_rapier` | Update or temporarily remove mod `sable_rapier`, then restart | `bad_advice` | P1 | **Seed 4 partial.** Primary mod correct (`sable_rapier`). Fix is generic update/remove — misses sublevel save / stale physics body / Create contraption context operators need. |
| crash-0801-watchdog-2150 | Aug 1 21:50 watchdog ~60 s after Sable body-removed crash #5 — second follow-up, not independent root | `watchdog` | `c2me_base` | Read watchdog thread dump; pause Chunky/DH if in dump; reduce sim distance if MSPT high | `linkage`, `wrong_primary`, `bad_advice` | P1 | **Seed 3 confirmed** (second pair). 64 s after Sable crash. Same linkage and wrong-primary pattern as 20:43 watchdog. |
| signal-jade-sidecar | `logs/JadeErrorOutput.txt`: 67 `InvWrapper.getInv()` NPEs; 1,173 corpus-wide (incl. scattered `latest.log` hits) — Jade addon compat, non-fatal | *(none)* | *(none)* | *(none)* | `blind` | P2 | **Seed 5 confirmed.** Ingestion checklist: `jade` unread; no WT reader. Sidecar never ingested; scattered log hits lack dedicated issue. |
| signal-recipe-flood | createfood ~51,694 + KubeJS recipe parse ~56,080 lines — boot/recipe WARN flood, not crash drivers | partial (`ModLogAnalyzer` caps: 25 mods, 5 recipes, 3 samples) | varies per mod | Recipe/logger errors attributed per mod with caps | `noise_drown` | P2 | **Seed 6 confirmed.** Census `createfood_recipe` `should_be_issue: false`; volume risks drowning actionable recipe errors in Issues/mod peek. Dedicated `logs/kubejs/*.log` partial (ingestion checklist) — sidecar WARN flood census-visible only. Census regex `Failed to parse recipe` ≠ `ModErrorCategory` trigger (`Parsing error loading recipe`) — partial pattern mismatch. |
| signal-distxform-loot | DISTXFORM client-on-server ~1,896 lines + loot-table missing-dep ~27,272 — boot/datapack noise | partial (`ModLogAnalyzer` / `StartupProfileScanner`) | offending mod per line | Generic logger/recipe/loot attribution with caps | `noise_drown` | P3 | **Seed 7 confirmed.** `distxform_client` `should_be_issue: false`; many DISTXFORM lines may land as `logger_error` not `client_on_server` (code-map heuristic). `loot_parse` captured but high volume competes with actionable signals. Acceptable detection; poor signal-to-noise for operators. |
| signal-tick-lag | Chronic `Can't keep up`: 3,226 corpus-wide (2,254 Aug 1 + 947 Aug 2) — symptom/amplifier of crash evening | `tick_lag` (partial via `LogScanner` ≤5 evidence + `OpsLogTailScanner` throttle + `IssuesLiveEvaluators`) | *(n/a)* | MSPT / sim-distance guidance via live issues | — | — | **No gap / acceptable.** Detected and surfaced on live path; dedupe/throttle means raw line count underrepresented — by design. Correlates with watchdog pairs but not a blind spot. |
| signal-db-addon | GriefLogger MariaDB `Database connection failed` ~70 lines — persistent addon config issue | partial (`ModErrorCategory.LOGGER_ERROR` when ERROR + resolvable logger) | `grieflogger` (when attributed) | Generic logger error | `no_surface` | P3 | **New miss.** No dedicated DB-addon category; may not surface as actionable config issue in Issues/brief. Low incident value vs Aug 1 hard crashes. |
| signal-kubejs-sidecar | `logs/kubejs/server.log`, `startup.log`, `client.log` inventoried but outside `GzipLineReader.iterLogFiles` | partial (latest.log tail only via `OpsLogTailScanner` / `SilentFailSignatures`) | *(n/a)* | KubeJS path capture when same-line in latest | `blind` | P2 | **New miss** (ingestion). Dedicated kubejs sidecars unread; recipe-parse volume in sidecars invisible to LogScanner. Overlaps seed 6 but distinct ingestion blind spot. |

## Seed verdicts

| # | Seed | Verdict |
| - | ---- | ------- |
| 1 | Spark shutdown advice quality | **Confirmed** — `wrong_kind`, `bad_advice` (P2) |
| 2 | OPAC NSM classification + Fix | **Confirmed** — primary OK; `wrong_kind`, `bad_advice` (P1) |
| 3 | Watchdog follow-up linkage (20:43, 21:50) | **Confirmed** — `linkage`, `wrong_primary`, `bad_advice` (P1) |
| 4 | Sable body-removed primary + advice | **Partial** — primary OK; `bad_advice` only (P1) |
| 5 | JadeErrorOutput blind | **Confirmed** — `blind` (P2) |
| 6 | createfood/KubeJS recipe flood noise_drown | **Confirmed** — `noise_drown` (P2) |
| 7 | DISTXFORM / loot-parse spam | **Confirmed** — `noise_drown` (P3) |

## Crash coverage

All six crash reports reviewed; each has a matrix row above.

| Crash file | Matrix id | Gap? |
| ---------- | --------- | ---- |
| `crash-2026-07-31_17.27.20-server.txt` | `crash-0731-spark` | yes |
| `crash-2026-08-01_19.24.51-server.txt` | `crash-0801-opac-cmd` | yes |
| `crash-2026-08-01_20.42.00-server.txt` | `crash-0801-opac-listener` | yes |
| `crash-2026-08-01_20.43.06-server.txt` | `crash-0801-watchdog-2043` | yes |
| `crash-2026-08-01_21.49.17-server.txt` | `crash-0801-sable` | yes |
| `crash-2026-08-01_21.50.21-server.txt` | `crash-0801-watchdog-2150` | yes |

## Severity rollup

| Severity | Count | ids |
| -------- | ----: | --- |
| P0 | 0 | — |
| P1 | 5 | `crash-0801-opac-cmd`, `crash-0801-opac-listener`, `crash-0801-watchdog-2043`, `crash-0801-sable`, `crash-0801-watchdog-2150` |
| P2 | 4 | `crash-0731-spark`, `signal-jade-sidecar`, `signal-recipe-flood`, `signal-kubejs-sidecar` |
| P3 | 2 | `signal-distxform-loot`, `signal-db-addon` |
| ok | 1 | `signal-tick-lag` |
