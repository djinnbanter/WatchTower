# Fixture backlog — 2026-08-02-new-samples

> **Forensic reconciliation (F5):** Updated in place from [`forensic/cross-check.md`](forensic/cross-check.md) §3 Prior-pass reconciliation, §4 net-new candidates, and §5 recommended F5 edits. FB-01…FB-11 ids kept stable; acceptance / expected / ground_truth revised where forensic facts changed. **Forensic status** markers: confirmed | revised | new. FB-12 / FB-13 added only for net-new Jul 29 signals. No prior FB entry rejected or superseded.

Sample root: `samples/new samples 02.08.2026`  
Sources: `gap-matrix.md`, `crash-replay.json`, `timeline.md`, `forensic/cross-check.md`

Ranked P0 → P3 in recommended implementation order. All six crash reports and corpus-signal gaps from the matrix are covered below (tick-lag excluded — acceptable).

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
- notes: **Forensic status: confirmed.** Golden still fails on `mod_runtime` + generic Fix for command-path NSM.

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
- notes: **Forensic status: confirmed.** Listener-path twin; precursor to FB-03 unchanged.

### FB-03 — Watchdog follow-up after OPAC listener crash (20:43)
- id: FB-03
- title: Watchdog follow-up after OPAC listener crash (20:43)
- source_files: [`samples/new samples 02.08.2026/crash-reports/crash-2026-08-01_20.43.06-server.txt`, `samples/new samples 02.08.2026/crash-reports/crash-2026-08-01_20.42.00-server.txt`]
- ground_truth: `ServerHangWatchdog` ~60 s tick hang 63 s after OPAC listener crash — follow-up hang after tick-loop death, not independent root. Dump has **249** named threads and **no `"Server thread"`** — chain evidence vs stuck-lag / `c2me_base` primary
- expected.failure_kind: `watchdog_followup`
- expected.issue_id: `crash_watchdog_opac_followup`
- expected.primary_mod: `opac_better_commands`
- expected.fix_must_include: ["link to preceding OPAC crash", "paired_primary_file points to crash-2026-08-01_20.42.00-server.txt", "advice references prior mod_runtime crash not generic MSPT tuning alone", "absent Server thread in dump as chain evidence"]
- expected.fix_must_not: ["standalone watchdog with c2me_base as root primary", "Chunky/DH pause advice without mentioning prior crash"]
- proposed_fixture_dir: `samples/fixtures/crash-intelligence/watchdog-opac-followup-2043/`
- wt_gap_tags: [linkage, wrong_primary, bad_advice]
- severity: P1
- suggested_code_touch: IncidentChainBuilder, CrashClassifier, CrashNarrator
- acceptance: Golden test fails today on `failure_kind=watchdog`, `primary_mod=c2me_base`, no `paired_primary_file`; passes after `watchdog_followup` kind, OPAC primary from chain, linked incident_id, and ground-truth check that dump lacks `"Server thread"`.
- notes: **Forensic status: revised.** Acceptance still correct; added missing-Server-thread chain evidence (strengthens vs c2me_base primary).

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
- notes: **Forensic status: confirmed.** Primary OK; Fix must include sublevel save / stale body / Create carriage.

### FB-05 — Watchdog follow-up after Sable crash (21:50)
- id: FB-05
- title: Watchdog follow-up after Sable crash (21:50)
- source_files: [`samples/new samples 02.08.2026/crash-reports/crash-2026-08-01_21.50.21-server.txt`, `samples/new samples 02.08.2026/crash-reports/crash-2026-08-01_21.49.17-server.txt`]
- ground_truth: `ServerHangWatchdog` ~60 s tick hang 64 s after Sable body-removed crash — second follow-up pair, not independent root. Dump has **288** named threads and **no `"Server thread"`** — same chain signal as FB-03
- expected.failure_kind: `watchdog_followup`
- expected.issue_id: `crash_watchdog_sable_followup`
- expected.primary_mod: `sable_rapier`
- expected.fix_must_include: ["link to preceding Sable crash", "paired_primary_file points to crash-2026-08-01_21.49.17-server.txt", "advice references prior mod_runtime crash not generic lag hang", "absent Server thread in dump as chain evidence"]
- expected.fix_must_not: ["standalone watchdog with c2me_base as root primary", "MSPT/sim-distance advice without mentioning prior Sable crash"]
- proposed_fixture_dir: `samples/fixtures/crash-intelligence/watchdog-sable-followup-2150/`
- wt_gap_tags: [linkage, wrong_primary, bad_advice]
- severity: P1
- suggested_code_touch: IncidentChainBuilder, CrashClassifier, CrashNarrator
- acceptance: Golden test fails today on `failure_kind=watchdog`, `primary_mod=c2me_base`, no chain metadata; passes after `watchdog_followup` kind, Sable primary from chain, paired_primary_file, and dump lacks `"Server thread"`.
- notes: **Forensic status: revised.** Same as FB-03 for Sable pair — missing-Server-thread expectation added.

---

## P2 — shutdown noise, ingestion blind spots, recipe flood, joinability

### FB-06 — Spark profiler inactive on server shutdown
- id: FB-06
- title: Spark profiler inactive on server shutdown
- source_files: [`samples/new samples 02.08.2026/crash-reports/crash-2026-07-31_17.27.20-server.txt`]
- ground_truth: `IllegalStateException: Profiler job no longer active!` during `ServerLifecycleHooks.handleServerStopping` via `NeoForgeServerSparkPlugin.onDisable` — shutdown-path hygiene, not mid-session gameplay. ISE **absent** from all Jul 31 rotate bodies (session gap before `-2`); clean Spark stops never reproduce it — **crash report is source of truth**
- expected.failure_kind: `shutdown_noise`
- expected.issue_id: n/a
- expected.primary_mod: `spark`
- expected.fix_must_include: ["server shutdown or stop path", "non-issue or low-priority shutdown hygiene"]
- expected.fix_must_not: ["gameplay instability framing", "update or remove spark as if mid-session mod crash"]
- proposed_fixture_dir: `samples/fixtures/crash-intelligence/spark-shutdown-profiler/`
- wt_gap_tags: [wrong_kind, bad_advice]
- severity: P2
- suggested_code_touch: CrashClassifier, CrashNarrator
- acceptance: Golden test fails today on `failure_kind=mod_runtime` and gameplay-stability Fix; passes after `shutdown_noise` kind and stop-path advice with `should_be_issue: false` posture. Fixture notes must assert ISE absence from Jul 31 rotate peers and that clean stops do not reproduce.
- notes: **Forensic status: revised.** Still shutdown_noise; rotate-body absence + clean-stop non-reproduction are required ground truth.

### FB-07 — Jade sidecar multi-exception blind
- id: FB-07
- title: Jade sidecar multi-exception blind
- source_files: [`samples/new samples 02.08.2026/logs/JadeErrorOutput.txt`]
- ground_truth: **8 INSTANCE** events in Jade sidecar — **5** InvWrapper NPE + Lectern NPE + cauldron ISE + Create LecternController ClassCast (not “67 InvWrapper”). Census sidecar 67 / corpus 1,173 are overcount (stack frames + plugin-load / DEBUG). Non-fatal; outside `GzipLineReader.iterLogFiles`
- expected.failure_kind: n/a
- expected.issue_id: `signal_jade_sidecar_compat`
- expected.primary_mod: `jade`
- expected.fix_must_include: ["Jade addon compatibility", "sidecar ingested and attributed to jade", "non-fatal / informational severity", "covers InvWrapper and Lectern/cauldron/Create ClassCast classes"]
- expected.fix_must_not: ["crash or outage classification", "silent omission — zero surface in Issues", "InvWrapper-only framing that ignores other INSTANCE exceptions"]
- proposed_fixture_dir: `samples/fixtures/log-intelligence/jade-sidecar-compat/`
- wt_gap_tags: [blind]
- severity: P2
- suggested_code_touch: GzipLineReader, LogScanner, ModLogAnalyzer
- acceptance: Golden test fails today — JadeErrorOutput.txt not scanned, no jade compat issue; passes after sidecar ingestion and capped multi-exception jade signal (8 INSTANCE / not InvWrapper-only) in Issues.
- notes: **Forensic status: revised.** Ground-truth counts → 8 INSTANCE / multi-exception; expected issue covers Lectern/cauldron/Create ClassCast, not InvWrapper alone.

### FB-08 — createfood / KubeJS recipe parse flood (noise_drown)
- id: FB-08
- title: createfood / KubeJS recipe parse flood (noise_drown)
- source_files: [`samples/new samples 02.08.2026/logs/2026-07-30-1.log.gz`, `samples/new samples 02.08.2026/logs/2026-08-01-5.log.gz`, `samples/new samples 02.08.2026/logs/latest.log`, `samples/new samples 02.08.2026/logs/kubejs/server.log`]
- ground_truth: ~51,694 createfood + ~56,080 KubeJS recipe parse WARN lines — boot/recipe noise, not crash drivers; dense WARN set also in unread `kubejs/server.log`; `ModLogAnalyzer` caps risk drowning actionable recipe errors; census `createfood_recipe` `should_be_issue: false`
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
- notes: **Forensic status: confirmed.** Recipe flood noise_drown still correct; latest + rotates + kubejs/server.log all show it.

### FB-09 — KubeJS dedicated sidecar logs unread
- id: FB-09
- title: KubeJS dedicated sidecar logs unread
- source_files: [`samples/new samples 02.08.2026/logs/kubejs/server.log`, `samples/new samples 02.08.2026/logs/kubejs/startup.log`, `samples/new samples 02.08.2026/logs/kubejs/client.log`]
- ground_truth: KubeJS sidecars outside `GzipLineReader.iterLogFiles`. `client.log` is **empty** (no signal / no-op). Recipe flood lives in `server.log` (~1402 WARNs Aug 2); `startup.log` clean. Overlaps FB-08 but distinct ingestion blind
- expected.failure_kind: n/a
- expected.issue_id: `signal_kubejs_sidecar`
- expected.primary_mod: `kubejs`
- expected.fix_must_include: ["kubejs/server.log prioritized in scan set", "startup.log scanned when present", "KubeJS ERROR/WARN lines attributed from server.log", "path or source tag kubejs sidecar in evidence"]
- expected.fix_must_not: ["rely on latest.log tail only for kubejs signals", "silent skip of dedicated kubejs logs", "require client.log content as acceptance gate"]
- proposed_fixture_dir: `samples/fixtures/log-intelligence/kubejs-sidecar-ingestion/`
- wt_gap_tags: [blind]
- severity: P2
- suggested_code_touch: GzipLineReader, LogScanner, OpsLogTailScanner
- acceptance: Golden test fails today — kubejs sidecar files not in scan set; passes after sidecar enumeration with **server.log (+ startup)** prioritized; empty client.log must not block pass.
- notes: **Forensic status: revised.** Empty client.log is no-op; prioritize server.log (+ startup) in acceptance.

### FB-12 — Jul 29 login disconnect storm (joinability)
- id: FB-12
- title: Jul 29 login disconnect storm (joinability)
- source_files: [`samples/new samples 02.08.2026/logs/2026-07-29-7.log.gz`]
- ground_truth: ~199 `ServerLoginPacketListenerImpl` Disconnected with almost no successful joins after one short join — server process “up” ~4 h but unplayable; underweighted vs join counts
- expected.failure_kind: n/a
- expected.issue_id: `signal_login_storm`
- expected.primary_mod: n/a
- expected.fix_must_include: ["login-path / joinability framing", "high disconnect-to-join ratio surfaced", "server-up-but-unplayable posture"]
- expected.fix_must_not: ["silent underweight vs raw player_join totals", "crash or outage classification without login evidence"]
- proposed_fixture_dir: `samples/fixtures/log-intelligence/login-storm-0729/`
- wt_gap_tags: [underweight, joinability]
- severity: P2
- suggested_code_touch: JoinClinic, LogScanner, IssuesLiveEvaluators
- acceptance: Golden test fails today — login-listener disconnect storm not elevated vs healthy join counts; passes after joinability / login-storm signal with disconnect-heavy evidence.
- notes: **Forensic status: new.** Maps to `signal-login-storm-0729`. Not an Aug 1 crash driver.

---

## P3 — boot noise and low-incident config / compat signals

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
- notes: **Forensic status: confirmed.** DISTXFORM + loot spam still noise_drown P3.

### FB-11 — GriefLogger MariaDB ACL / GLRA (no dedicated surface)
- id: FB-11
- title: GriefLogger MariaDB ACL / GLRA (no dedicated surface)
- source_files: [`samples/new samples 02.08.2026/logs/2026-07-29-2.log.gz`, `samples/new samples 02.08.2026/logs/2026-07-29-1.log.gz`, `samples/new samples 02.08.2026/logs/latest.log`]
- ground_truth: Jul 29 `-2` is best exemplar — MariaDB **1130 host ACL** disables **core** GriefLogger (+ LuckPerms SQL). Later boots recover core while **GLRA** (`griefloggerrollbackaddon`) keeps failing (~70 `Database connection failed` corpus). Not only “~70 Database connection failed” flattened to `grieflogger`
- expected.failure_kind: n/a
- expected.issue_id: `signal_db_addon_fail`
- expected.primary_mod: `grieflogger` (ACL core-disable) / `griefloggerrollbackaddon` (persistent GLRA)
- expected.fix_must_include: ["MariaDB host ACL (1130) or database config context", "core GriefLogger disable when ACL blocks", "GLRA / griefloggerrollbackaddon attribution when core recovers but addon keeps failing", "actionable config issue in Issues or brief"]
- expected.fix_must_not: ["silent omission when ERROR lines present", "generic logger_error with no DB/ACL config hint", "always blame grieflogger core when only GLRA fails"]
- proposed_fixture_dir: `samples/fixtures/log-intelligence/grieflogger-db-addon/`
- wt_gap_tags: [no_surface]
- severity: P3
- suggested_code_touch: ModLogAnalyzer, IssuesLiveEvaluators
- acceptance: Golden test fails today — no actionable DB-addon issue with ACL/GLRA nuance; passes after MariaDB ACL core-disable (Jul 29 `-2`) and/or GLRA-persistent fail surfaces with config-oriented advice and correct logger id.
- notes: **Forensic status: revised.** Expect MariaDB ACL / GLRA attribution nuance; Jul 29 `-2` best exemplar for core disable.

### FB-13 — GriefLogger × Create mounted-storage NPE
- id: FB-13
- title: GriefLogger × Create mounted-storage NPE
- source_files: [`samples/new samples 02.08.2026/logs/2026-07-29-8.log.gz`]
- ground_truth: Jul 29 `-8` ~21:31 — GriefLogger `ContainerHandler` NPE (`menuProvider is null`) on Create `contraption_interact` / mounted storage; FATAL task without crash-report; process continues. Distinct from FB-11 boot-config DB fail
- expected.failure_kind: n/a
- expected.issue_id: `signal_gl_create_npe`
- expected.primary_mod: `grieflogger` (compat with Create)
- expected.fix_must_include: ["GriefLogger ContainerHandler / menuProvider null", "Create contraption_interact or mounted storage context", "FATAL task without crash-report framing"]
- expected.fix_must_not: ["fold into MariaDB ACL / DB-addon only", "silent generic logger_error with no Create mounted-storage hint"]
- proposed_fixture_dir: `samples/fixtures/log-intelligence/grieflogger-create-npe-0729/`
- wt_gap_tags: [no_surface, compat]
- severity: P3
- suggested_code_touch: ModLogAnalyzer, LogScanner, IssuesLiveEvaluators
- acceptance: Golden test fails today — FATAL GL×Create NPE lands as generic logger/create or is missed; passes after dedicated compat signal naming GriefLogger + Create mounted storage.
- notes: **Forensic status: new.** Maps to `signal-gl-create-npe-0729`. Kept separate from FB-11 (boot config vs runtime NPE).

---

## Severity rollup

| Severity | Count | ids |
| -------- | ----: | --- |
| P0 | 0 | — |
| P1 | 5 | FB-01 … FB-05 |
| P2 | 5 | FB-06 … FB-09, FB-12 |
| P3 | 3 | FB-10, FB-11, FB-13 |

## Forensic reconcile counts (FB)

| Status | Count | ids |
| ------ | ----: | --- |
| confirmed | 5 | FB-01, FB-02, FB-04, FB-08, FB-10 |
| revised | 6 | FB-03, FB-05, FB-06, FB-07, FB-09, FB-11 |
| new | 2 | FB-12, FB-13 |
| rejected | 0 | — |
| superseded | 0 | — |

## Matrix crosswalk

| gap-matrix id | backlog id | forensic status |
| ------------- | ---------- | --------------- |
| crash-0801-opac-cmd | FB-01 | confirmed |
| crash-0801-opac-listener | FB-02 | confirmed |
| crash-0801-watchdog-2043 | FB-03 | revised |
| crash-0801-sable | FB-04 | confirmed |
| crash-0801-watchdog-2150 | FB-05 | revised |
| crash-0731-spark | FB-06 | revised |
| signal-jade-sidecar | FB-07 | revised |
| signal-recipe-flood | FB-08 | confirmed |
| signal-kubejs-sidecar | FB-09 | revised |
| signal-distxform-loot | FB-10 | confirmed |
| signal-db-addon | FB-11 | revised |
| signal-login-storm-0729 | FB-12 | new |
| signal-gl-create-npe-0729 | FB-13 | new |
| signal-tick-lag | *(excluded — acceptable)* | confirmed (ok) |
