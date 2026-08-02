# Gap matrix — 2026-08-02-new-samples

> **Forensic reconciliation (F5):** Updated in place from [`forensic/cross-check.md`](forensic/cross-check.md) §3 Prior-pass reconciliation, §4 net-new candidates, and §5 recommended F5 edits. Status markers in notes: **Forensic status: confirmed** | **revised** | **new**. No prior ids rejected or superseded; revisions update facts in place (no duplicate active rows for the same signal).

Sample root: `samples/new samples 02.08.2026`  
Sources: `timeline.md`, `crash-replay.json`, `census.json`, `code-map.md`, `ingestion-checklist.md`, `forensic/cross-check.md`

| id | ground_truth | wt_failure_kind | wt_primary | wt_fix_summary | tags | severity | notes |
| -- | ------------ | --------------- | ---------- | -------------- | ---- | -------- | ----- |
| crash-0731-spark | Spark shutdown crash Jul 31 17:27: `IllegalStateException: Profiler job no longer active!` during `ServerLifecycleHooks.handleServerStopping` — stop-path hygiene, not mid-session gameplay instability. ISE is **crash-report-only** (absent from all Jul 31 rotate bodies; clean Spark stops never log it) | `mod_runtime` | `spark` | Update or temporarily remove mod `spark`, then restart | `wrong_kind`, `bad_advice` | P2 | **Forensic status: revised.** Seed 1 still real WT wrong_kind/bad_advice. Census `spark_profiler_inactive` (`should_be_issue: false`) in crash file only. Replay treats shutdown noise as gameplay mod crash; Fix implies instability. Should be shutdown-noise / non-issue. Evidence quality: rotate-session gap before `-2`; crash report remains source of truth. |
| crash-0801-opac-cmd | Aug 1 19:24 OPAC API mismatch: `NoSuchMethodError` on `IServerData.getPlayerConfigs()` via party chat **command** (`opac_better_commands` 1.5 vs `openpartiesandclaims` 0.29.3) | `mod_runtime` | `opac_better_commands` | Update or temporarily remove mod `opac_better_commands`, then restart | `wrong_kind`, `bad_advice` | P1 | **Forensic status: confirmed.** Seed 2. Primary mod correct; `failure_kind` is generic `mod_runtime` with no API/version-mismatch signal. Fix should name OPAC version alignment or remove Better Commands until compatible — not vague jar/conflict advice. |
| crash-0801-opac-listener | Aug 1 20:42 same OPAC `NoSuchMethodError` via party chat **listener** (`PartyChatListener.onServerChat`) — same root cause, chat path | `mod_runtime` | `opac_better_commands` | Update or temporarily remove mod `opac_better_commands`, then restart | `wrong_kind`, `bad_advice` | P1 | **Forensic status: confirmed.** Seed 2 (second entry point). Log narrative (party invite → chat → NSM) reinforces. Immediate precursor to watchdog at 20:43. Same classification/advice gap as command crash. |
| crash-0801-watchdog-2043 | Aug 1 20:43 watchdog ~63 s after OPAC listener crash #3 — follow-up hang after tick-loop death, not independent root. Dump: **249** named threads, **no `"Server thread"`** | `watchdog` | `c2me_base` | Read watchdog thread dump; pause Chunky/DH if in dump; reduce sim distance if MSPT high | `linkage`, `wrong_primary`, `bad_advice` | P1 | **Forensic status: revised.** Seed 3. Replay shows standalone `watchdog` / `host_resource` with `c2me_base` primary. Missing Server thread proves follow-up after tick death, not stuck lag stack — strengthens chain vs c2me/Chunky MSPT-only advice. `IncidentChainBuilder` exists but replay harness does not emit `watchdog_followup` or `paired_primary_file`. |
| crash-0801-sable | Aug 1 21:49 Sable `RuntimeException: Body has been removed` during `SubLevelSerializer` / world save; active Create `CarriageContraptionEntity` + two Sable sublevels | `mod_runtime` | `sable_rapier` | Update or temporarily remove mod `sable_rapier`, then restart | `bad_advice` | P1 | **Forensic status: confirmed.** Seed 4 partial. Primary mod correct (`sable_rapier`). Fix is generic update/remove — misses sublevel save / stale physics body / Create contraption context operators need. |
| crash-0801-watchdog-2150 | Aug 1 21:50 watchdog ~64 s after Sable body-removed crash #5 — second follow-up, not independent root. Dump: **288** named threads, **no `"Server thread"`** | `watchdog` | `c2me_base` | Read watchdog thread dump; pause Chunky/DH if in dump; reduce sim distance if MSPT high | `linkage`, `wrong_primary`, `bad_advice` | P1 | **Forensic status: revised.** Seed 3 (second pair). Same linkage / wrong-primary / bad-advice pattern as 20:43; missing Server thread is the same chain signal. |
| signal-jade-sidecar | `logs/JadeErrorOutput.txt`: **8 INSTANCE** events (5 InvWrapper NPE + Lectern NPE + cauldron ISE + Create LecternController ClassCast); InvWrapper text lines = **5**. Census sidecar `jade_invwrapper_npe: 67` / corpus **1,173** are overcount (stack frames + plugin-load / DEBUG false matches). Non-fatal Jade addon compat | *(none)* | *(none)* | *(none)* | `blind` | P2 | **Forensic status: revised.** Seed 5 blind still valid. Not “67 InvWrapper NPEs”. Ingestion checklist: `jade` unread; no WT reader. Sidecar never ingested; expect multi-exception signal, not InvWrapper-only. |
| signal-recipe-flood | createfood ~51,694 + KubeJS recipe parse ~56,080 lines — boot/recipe WARN flood, not crash drivers; dense WARN set also in `kubejs/server.log` | partial (`ModLogAnalyzer` caps: 25 mods, 5 recipes, 3 samples) | varies per mod | Recipe/logger errors attributed per mod with caps | `noise_drown` | P2 | **Forensic status: confirmed.** Seed 6. Census `createfood_recipe` `should_be_issue: false`; volume risks drowning actionable recipe errors. Pattern-mismatch risk vs ModErrorCategory unchanged (`Failed to parse recipe` ≠ `Parsing error loading recipe`). |
| signal-distxform-loot | DISTXFORM client-on-server ~1,896 lines + loot-table missing-dep ~27,272 — boot/datapack noise | partial (`ModLogAnalyzer` / `StartupProfileScanner`) | offending mod per line | Generic logger/recipe/loot attribution with caps | `noise_drown` | P3 | **Forensic status: confirmed.** Seed 7. Boot noise volumes hold; still noise_drown P3. Acceptable detection; poor signal-to-noise for operators. |
| signal-tick-lag | Chronic `Can't keep up`: 3,226 corpus-wide (2,254 Aug 1 + 947 Aug 2) — symptom/amplifier of crash evening | `tick_lag` (partial via `LogScanner` ≤5 evidence + `OpsLogTailScanner` throttle + `IssuesLiveEvaluators`) | *(n/a)* | MSPT / sim-distance guidance via live issues | — | — | **Forensic status: confirmed.** No gap / acceptable. Detected and surfaced on live path; Aug 1 volume matches hurt amplifier role. Not promoted. |
| signal-db-addon | GriefLogger MariaDB / GLRA fail ~70 lines. Strongest story Jul 29 `-2`: MariaDB **1130 host ACL** disables core GriefLogger (+ LuckPerms SQL); later boots recover core while **GLRA** (`griefloggerrollbackaddon`) keeps failing | partial (`ModErrorCategory.LOGGER_ERROR` when ERROR + resolvable logger) | often `grieflogger` (flattens recoveries; underweights GLRA) | Generic logger error | `no_surface` | P3 | **Forensic status: revised.** Still no dedicated DB-addon surface. Census volume OK but underweights ACL narrative. Attribute persistent fail to `griefloggerrollbackaddon` when core recovers; Jul 29 `-2` is best exemplar for core disable. |
| signal-kubejs-sidecar | `logs/kubejs/server.log` holds recipe WARN flood (~1402 on Aug 2 boot, mirrored in latest); `startup.log` clean; `client.log` **empty** (no signal). Sidecars outside `GzipLineReader.iterLogFiles` | partial (latest.log tail only via `OpsLogTailScanner` / `SilentFailSignatures`) | *(n/a)* | KubeJS path capture when same-line in latest | `blind` | P2 | **Forensic status: revised.** Blind still valid. Empty `client.log` is no-op; prioritize `server.log` (+ startup). Overlaps seed 6 but distinct ingestion blind spot. |
| signal-login-storm-0729 | Jul 29 `2026-07-29-7`: ~199 `ServerLoginPacketListenerImpl` Disconnected with almost no successful joins — server “up” ~4 h but unplayable | *(none / underweight)* | *(n/a)* | *(none dedicated)* | `underweight`, `joinability` | P2 | **Forensic status: new.** Prior pass had no dedicated row. Census underweights vs joins; join-clinic / disconnect patterns may miss login-listener-only failures. Not an Aug 1 crash driver. |
| signal-gl-create-npe-0729 | Jul 29 `2026-07-29-8` ~21:31: GriefLogger `ContainerHandler` NPE (`menuProvider is null`) on Create `contraption_interact` / mounted storage — FATAL task, process continues (no crash-report) | partial (generic `logger_error` / create) | may flatten to `grieflogger` or create | Generic logger/create attribution | `no_surface`, `compat` | P3 | **Forensic status: new.** Prior pass had no dedicated row. Separate from boot-config DB-addon (`signal-db-addon`) — runtime Create mounted-storage compat NPE, not MariaDB ACL. |

## Seed verdicts

| # | Seed | Verdict |
| - | ---- | ------- |
| 1 | Spark shutdown advice quality | **Confirmed / revised (forensic)** — `wrong_kind`, `bad_advice` (P2); crash-report-only ISE |
| 2 | OPAC NSM classification + Fix | **Confirmed** — primary OK; `wrong_kind`, `bad_advice` (P1) |
| 3 | Watchdog follow-up linkage (20:43, 21:50) | **Confirmed / revised (forensic)** — `linkage`, `wrong_primary`, `bad_advice` (P1); missing Server thread |
| 4 | Sable body-removed primary + advice | **Partial** — primary OK; `bad_advice` only (P1) |
| 5 | JadeErrorOutput blind | **Confirmed / revised (forensic)** — `blind` (P2); 8 INSTANCE / multi-exception |
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
| P2 | 5 | `crash-0731-spark`, `signal-jade-sidecar`, `signal-recipe-flood`, `signal-kubejs-sidecar`, `signal-login-storm-0729` |
| P3 | 3 | `signal-distxform-loot`, `signal-db-addon`, `signal-gl-create-npe-0729` |
| ok | 1 | `signal-tick-lag` |

## Forensic reconcile counts

| Status | Count | ids |
| ------ | ----: | --- |
| confirmed | 5 | `crash-0801-opac-cmd`, `crash-0801-opac-listener`, `crash-0801-sable`, `signal-recipe-flood`, `signal-distxform-loot` (+ `signal-tick-lag` ok) |
| revised | 6 | `crash-0731-spark`, `crash-0801-watchdog-2043`, `crash-0801-watchdog-2150`, `signal-jade-sidecar`, `signal-db-addon`, `signal-kubejs-sidecar` |
| new | 2 | `signal-login-storm-0729`, `signal-gl-create-npe-0729` |
| rejected | 0 | — |
| superseded | 0 | — |
