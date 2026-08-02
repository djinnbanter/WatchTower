# Fixture backlog — 2026-08-02-new-samples

Sample root: `samples/new samples 02.08.2026`  
Sources: `gap-matrix.md`, `crash-replay.json`, `timeline.md`

Ranked P0 → P3 in recommended implementation order. All six crash reports and eight corpus-signal gaps from the matrix are covered below (tick-lag excluded — acceptable).

---

## P1 — crash intelligence (Aug 1 hard crashes)

### FB-01 — OPAC Better Commands API mismatch (party chat command)
- id: FB-01
- title: OPAC Better Commands API mismatch — party chat command
- source_files: [`samples/new samples 02.08.2026/crash-reports/crash-2026-08-01_19.24.51-server.txt`]
- ground_truth: `NoSuchMethodError` on `xaero.pac.common.server.IServerData.getPlayerConfigs()` via `PartyMessenger.sendPartyMessage` ← `PartyChatCommand` — version mismatch between `opac_better_commands` 1.5 and `openpartiesandclaims` 0.29.3
- expected.failure_kind: `api_version_mismatch`
- expected.issue_id: `crash_opac_nsm_command`
- expected.primary_mod: `opac_better_commands`
- expected.fix_must_include: ["align OPAC Better Commands with installed OpenPartiesAndClaims version", "remove opac_better_commands until compatible with OPAC 0.29.3"]
- expected.fix_must_not: ["generic corrupt jar or mixin conflict advice only", "update or remove openpartiesandclaims without naming version mismatch"]
- proposed_fixture_dir: `samples/fixtures/crash-intelligence/opac-nsm-command/`
- wt_gap_tags: [wrong_kind, bad_advice]
- severity: P1
- suggested_code_touch: CrashClassifier, CrashNarrator
- acceptance: Golden test fails today on `failure_kind=mod_runtime` and generic update/remove Fix; passes after `api_version_mismatch` kind and OPAC version-alignment advice.

### FB-02 — OPAC Better Commands API mismatch (party chat listener)
- id: FB-02
- title: OPAC Better Commands API mismatch — party chat listener
- source_files: [`samples/new samples 02.08.2026/crash-reports/crash-2026-08-01_20.42.00-server.txt`]
- ground_truth: Same `NoSuchMethodError` on `getPlayerConfigs()` via `PartyChatListener.onServerChat` ← `CommonHooks.onServerChatSubmittedEvent` — same API mismatch, chat-event entry point; immediate precursor to watchdog at 20:43
- expected.failure_kind: `api_version_mismatch`
- expected.issue_id: `crash_opac_nsm_listener`
- expected.primary_mod: `opac_better_commands`
- expected.fix_must_include: ["align OPAC Better Commands with installed OpenPartiesAndClaims version", "remove opac_better_commands until compatible with OPAC 0.29.3"]
- expected.fix_must_not: ["generic corrupt jar or mixin conflict advice only", "treat as independent incident unrelated to command-path crash"]
- proposed_fixture_dir: `samples/fixtures/crash-intelligence/opac-nsm-listener/`
- wt_gap_tags: [wrong_kind, bad_advice]
- severity: P1
- suggested_code_touch: CrashClassifier, CrashNarrator
- acceptance: Golden test fails today on `failure_kind=mod_runtime` and generic Fix; passes after same api-mismatch classification and version-alignment advice as FB-01.

### FB-03 — Watchdog follow-up after OPAC listener crash (20:43)
- id: FB-03
- title: Watchdog follow-up after OPAC listener crash (20:43)
- source_files: [`samples/new samples 02.08.2026/crash-reports/crash-2026-08-01_20.43.06-server.txt`, `samples/new samples 02.08.2026/crash-reports/crash-2026-08-01_20.42.00-server.txt`]
- ground_truth: `ServerHangWatchdog` ~60 s tick hang 63 s after OPAC listener crash — follow-up hang after tick-loop death, not independent root incident; `c2me_base` in dump is not the root cause
- expected.failure_kind: `watchdog_followup`
- expected.issue_id: `crash_watchdog_opac_followup`
- expected.primary_mod: `opac_better_commands`
- expected.fix_must_include: ["link to preceding OPAC crash", "paired_primary_file points to crash-2026-08-01_20.42.00-server.txt", "advice references prior mod_runtime crash not generic MSPT tuning alone"]
- expected.fix_must_not: ["standalone watchdog with c2me_base as root primary", "Chunky/DH pause advice without mentioning prior crash"]
- proposed_fixture_dir: `samples/fixtures/crash-intelligence/watchdog-opac-followup-2043/`
- wt_gap_tags: [linkage, wrong_primary, bad_advice]
- severity: P1
- suggested_code_touch: IncidentChainBuilder, CrashClassifier, CrashNarrator
- acceptance: Golden test fails today on `failure_kind=watchdog`, `primary_mod=c2me_base`, no `paired_primary_file`; passes after `watchdog_followup` kind, OPAC primary from chain, and linked incident_id.

### FB-04 — Sable body removed on sublevel save
- id: FB-04
- title: Sable body removed on sublevel save
- source_files: [`samples/new samples 02.08.2026/crash-reports/crash-2026-08-01_21.49.17-server.txt`]
- ground_truth: `RuntimeException: Body has been removed` during `SubLevelSerializer.serialize` / world save with active Create `CarriageContraptionEntity` and two Sable sublevels — stale physics body on save path
- expected.failure_kind: `mod_runtime`
- expected.issue_id: `crash_sable_body_removed`
- expected.primary_mod: `sable_rapier`
- expected.fix_must_include: ["sublevel save or stale physics body context", "Create carriage contraption or sublevel unload scenario", "update Sable stack or avoid save with removed bodies"]
- expected.fix_must_not: ["generic update or remove sable_rapier only with no save/sublevel context", "blame create mod as primary"]
- proposed_fixture_dir: `samples/fixtures/crash-intelligence/sable-body-removed-save/`
- wt_gap_tags: [bad_advice]
- severity: P1
- suggested_code_touch: CrashNarrator
- acceptance: Golden test fails today on Fix assertion — generic update/remove only; passes after sublevel-save / stale-body advice while primary_mod remains `sable_rapier`.

### FB-05 — Watchdog follow-up after Sable crash (21:50)
- id: FB-05
- title: Watchdog follow-up after Sable crash (21:50)
- source_files: [`samples/new samples 02.08.2026/crash-reports/crash-2026-08-01_21.50.21-server.txt`, `samples/new samples 02.08.2026/crash-reports/crash-2026-08-01_21.49.17-server.txt`]
- ground_truth: `ServerHangWatchdog` ~60 s tick hang 64 s after Sable body-removed crash — second follow-up pair, not independent root incident
- expected.failure_kind: `watchdog_followup`
- expected.issue_id: `crash_watchdog_sable_followup`
- expected.primary_mod: `sable_rapier`
- expected.fix_must_include: ["link to preceding Sable crash", "paired_primary_file points to crash-2026-08-01_21.49.17-server.txt", "advice references prior mod_runtime crash not generic lag hang"]
- expected.fix_must_not: ["standalone watchdog with c2me_base as root primary", "MSPT/sim-distance advice without mentioning prior Sable crash"]
- proposed_fixture_dir: `samples/fixtures/crash-intelligence/watchdog-sable-followup-2150/`
- wt_gap_tags: [linkage, wrong_primary, bad_advice]
- severity: P1
- suggested_code_touch: IncidentChainBuilder, CrashClassifier, CrashNarrator
- acceptance: Golden test fails today on `failure_kind=watchdog`, `primary_mod=c2me_base`, no chain metadata; passes after `watchdog_followup` kind, Sable primary from chain, and paired_primary_file.

---

## P2 — shutdown noise, ingestion blind spots, recipe flood

### FB-06 — Spark profiler inactive on server shutdown
- id: FB-06
- title: Spark profiler inactive on server shutdown
- source_files: [`samples/new samples 02.08.2026/crash-reports/crash-2026-07-31_17.27.20-server.txt`]
- ground_truth: `IllegalStateException: Profiler job no longer active!` during `ServerLifecycleHooks.handleServerStopping` via `NeoForgeServerSparkPlugin.onDisable` — shutdown-path hygiene, not mid-session gameplay instability
- expected.failure_kind: `shutdown_noise`
- expected.issue_id: n/a
- expected.primary_mod: `spark`
- expected.fix_must_include: ["server shutdown or stop path", "non-issue or low-priority shutdown hygiene"]
- expected.fix_must_not: ["gameplay instability framing", "update or remove spark as if mid-session mod crash"]
- proposed_fixture_dir: `samples/fixtures/crash-intelligence/spark-shutdown-profiler/`
- wt_gap_tags: [wrong_kind, bad_advice]
- severity: P2
- suggested_code_touch: CrashClassifier, CrashNarrator
- acceptance: Golden test fails today on `failure_kind=mod_runtime` and gameplay-stability Fix; passes after `shutdown_noise` kind and stop-path advice with `should_be_issue: false` posture.

### FB-07 — Jade InvWrapper NPE sidecar blind
- id: FB-07
- title: Jade InvWrapper NPE sidecar blind
- source_files: [`samples/new samples 02.08.2026/logs/JadeErrorOutput.txt`]
- ground_truth: 67 `InvWrapper.getInv()` NPE lines in dedicated Jade sidecar (1,173 corpus-wide incl. scattered latest.log hits) — Jade addon compat noise, non-fatal, outside `GzipLineReader.iterLogFiles`
- expected.failure_kind: n/a
- expected.issue_id: `signal_jade_invwrapper_npe`
- expected.primary_mod: `jade`
- expected.fix_must_include: ["Jade addon compatibility", "sidecar ingested and attributed to jade", "non-fatal / informational severity"]
- expected.fix_must_not: ["crash or outage classification", "silent omission — zero surface in Issues"]
- proposed_fixture_dir: `samples/fixtures/log-intelligence/jade-sidecar-invwrapper/`
- wt_gap_tags: [blind]
- severity: P2
- suggested_code_touch: GzipLineReader, LogScanner, ModLogAnalyzer
- acceptance: Golden test fails today — JadeErrorOutput.txt not scanned, no jade InvWrapper issue; passes after sidecar ingestion and capped jade compat signal in Issues.

### FB-08 — createfood / KubeJS recipe parse flood (noise_drown)
- id: FB-08
- title: createfood / KubeJS recipe parse flood (noise_drown)
- source_files: [`samples/new samples 02.08.2026/logs/2026-07-30-1.log.gz`, `samples/new samples 02.08.2026/logs/2026-08-01-5.log.gz`, `samples/new samples 02.08.2026/logs/latest.log`]
- ground_truth: ~51,694 createfood + ~56,080 KubeJS recipe parse WARN lines — boot/recipe noise, not crash drivers; `ModLogAnalyzer` caps (25 mods, 5 recipes, 3 samples) risk drowning actionable recipe errors; census `createfood_recipe` `should_be_issue: false`
- expected.failure_kind: n/a
- expected.issue_id: `signal_recipe_flood`
- expected.primary_mod: `createfood`
- expected.fix_must_include: ["recipe WARN flood deprioritized or capped in Issues", "actionable recipe ERROR still surfaces above noise", "should_be_issue false for bulk WARN flood"]
- expected.fix_must_not: ["51k lines each promoted to top Issues", "crash or outage classification for recipe WARN volume"]
- proposed_fixture_dir: `samples/fixtures/log-intelligence/recipe-flood-createfood-kubejs/`
- wt_gap_tags: [noise_drown]
- severity: P2
- suggested_code_touch: ModLogAnalyzer, IssuesLiveEvaluators
- acceptance: Golden test fails today on Issues ranking — recipe WARN volume competes with actionable signals; passes after flood deprioritization while distinct recipe ERROR rows still appear.

### FB-09 — KubeJS dedicated sidecar logs unread
- id: FB-09
- title: KubeJS dedicated sidecar logs unread
- source_files: [`samples/new samples 02.08.2026/logs/kubejs/server.log`, `samples/new samples 02.08.2026/logs/kubejs/startup.log`, `samples/new samples 02.08.2026/logs/kubejs/client.log`]
- ground_truth: KubeJS sidecar logs inventoried by census but outside `GzipLineReader.iterLogFiles` — recipe-parse volume in sidecars invisible to LogScanner; overlaps FB-08 but distinct ingestion blind spot
- expected.failure_kind: n/a
- expected.issue_id: `signal_kubejs_sidecar`
- expected.primary_mod: `kubejs`
- expected.fix_must_include: ["kubejs/server.log and startup.log scanned", "KubeJS ERROR lines attributed when present in sidecars", "path or source tag kubejs sidecar in evidence"]
- expected.fix_must_not: ["rely on latest.log tail only for kubejs signals", "silent skip of dedicated kubejs logs"]
- proposed_fixture_dir: `samples/fixtures/log-intelligence/kubejs-sidecar-ingestion/`
- wt_gap_tags: [blind]
- severity: P2
- suggested_code_touch: GzipLineReader, LogScanner, OpsLogTailScanner
- acceptance: Golden test fails today — kubejs sidecar files not in scan set; passes after sidecar enumeration and KubeJS line capture from `logs/kubejs/*.log`.

---

## P3 — boot noise and low-incident config signals

### FB-10 — DISTXFORM client-on-server and loot-parse spam
- id: FB-10
- title: DISTXFORM client-on-server and loot-parse spam
- source_files: [`samples/new samples 02.08.2026/logs/2026-07-29-1.log.gz`, `samples/new samples 02.08.2026/logs/2026-08-01-1.log.gz`]
- ground_truth: ~1,896 DISTXFORM client-on-server lines + ~27,272 loot-table missing-dep lines — boot/datapack noise; `distxform_client` and `loot_parse` census `should_be_issue: false`; poor signal-to-noise in Issues/mod peek
- expected.failure_kind: n/a
- expected.issue_id: `signal_distxform_loot`
- expected.primary_mod: n/a
- expected.fix_must_include: ["boot noise deprioritized in Issues ranking", "client_on_server or loot_parse attributed per mod when surfaced", "should_be_issue false for bulk spam"]
- expected.fix_must_not: ["27k loot lines each promoted to actionable Issues", "outage classification for DISTXFORM boot spam alone"]
- proposed_fixture_dir: `samples/fixtures/log-intelligence/distxform-loot-noise/`
- wt_gap_tags: [noise_drown]
- severity: P3
- suggested_code_touch: ModLogAnalyzer, StartupProfileScanner, IssuesLiveEvaluators
- acceptance: Golden test fails today on Issues signal-to-noise — loot/DISTXFORM volume drowns actionable rows; passes after deprioritization caps while per-mod attribution remains available on drill-down.

### FB-11 — GriefLogger MariaDB connection fail (no dedicated surface)
- id: FB-11
- title: GriefLogger MariaDB connection fail (no dedicated surface)
- source_files: [`samples/new samples 02.08.2026/logs/2026-07-29-1.log.gz`, `samples/new samples 02.08.2026/logs/latest.log`]
- ground_truth: ~70 `Database connection failed` lines from GriefLogger MariaDB addon — persistent config issue captured only as generic `LOGGER_ERROR` when ERROR + resolvable logger; no dedicated DB-addon category
- expected.failure_kind: n/a
- expected.issue_id: `signal_db_addon_fail`
- expected.primary_mod: `grieflogger`
- expected.fix_must_include: ["database connection or MariaDB config context", "actionable config issue in Issues or brief", "attributed to grieflogger"]
- expected.fix_must_not: ["silent omission when ERROR lines present", "generic logger_error with no DB config hint"]
- proposed_fixture_dir: `samples/fixtures/log-intelligence/grieflogger-db-addon/`
- wt_gap_tags: [no_surface]
- severity: P3
- suggested_code_touch: ModLogAnalyzer, IssuesLiveEvaluators
- acceptance: Golden test fails today — no actionable DB-addon issue surfaced; passes after grieflogger DB connection issue appears in Issues with config-oriented advice.

---

## Severity rollup

| Severity | Count | ids |
| -------- | ----: | --- |
| P0 | 0 | — |
| P1 | 5 | FB-01 … FB-05 |
| P2 | 4 | FB-06 … FB-09 |
| P3 | 2 | FB-10, FB-11 |

## Matrix crosswalk

| gap-matrix id | backlog id |
| ------------- | ---------- |
| crash-0801-opac-cmd | FB-01 |
| crash-0801-opac-listener | FB-02 |
| crash-0801-watchdog-2043 | FB-03 |
| crash-0801-sable | FB-04 |
| crash-0801-watchdog-2150 | FB-05 |
| crash-0731-spark | FB-06 |
| signal-jade-sidecar | FB-07 |
| signal-recipe-flood | FB-08 |
| signal-kubejs-sidecar | FB-09 |
| signal-distxform-loot | FB-10 |
| signal-db-addon | FB-11 |
| signal-tick-lag | *(excluded — acceptable)* |
