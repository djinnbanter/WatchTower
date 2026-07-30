# Changelog

All notable **user-facing** changes to Watchtower are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

**Maintainers:** detailed planning and changelog notes may live in local `docs/dev/` (gitignored, not on GitHub).

## [Unreleased](https://github.com/djinnbanter/WatchTower/compare/v1.1.9...HEAD)

> Running dump of work after **1.1.9** / off-roadmap polish that landed alongside the 1.1.3–1.1.9 feature line (Jul 28–30). Versioned ops features stay under their numbered sections below; this block holds dashboard identity, packaging, support privacy, Live stability, Storage Space map, Join clinic, named accounts, and related fixes.

> **Updating from 1.1.x:** your existing dashboard login keeps working and becomes the **owner** account — no reset, no config change. Everyone signs in again after the restart, as with any server restart. The pre-upgrade credential file is kept as `watchtower/dashboard-auth.json.pre-1.1.18.bak`.

### Added

- **Named admin accounts (1.1.18)** — per-person logins with three roles: **owner** (everything, including accounts), **admin** (operate, no account management), **viewer** (read-only). Existing installs keep their credentials and become the owner
- **Side rail signed-in account + Sign out** — rail footer shows who is signed in and a **Sign out** control
- **Minecraft player link** — optional UUID/name on a dashboard account; rail (and Accounts) show that player's Crafthead skin. Owner sets links in Accounts; anyone can link themselves under Security
- **Audit log (1.1.18)** — `watchtower/audit-log.jsonl` records settings changes, acknowledgements, suppressions, account management, and sign-ins (including failures and blocked writes), readable from **Settings → Audit log**
- **Join & pack sync clinic (1.1.10)** — Parses Forge/NeoForge/Fabric join rejections from `latest.log` (`JoinRejectionSignatures` on the ops-log tail), diffs named mods against the server inventory (suppresses known client-only), writes `ops-cache.join_clinic`, opens continuous Issues `JOIN_SYNC:*` with Session deep-link, and surfaces failed joins on Session → **Session activity** with a player-safe **Copy fix**. Kill-switch `JOIN_CLINIC_ENABLED` (default on). Read-only — never changes `mods/`. Wiki `Join-Clinic.md`; fixtures under `samples/fixtures/join-clinic/`
- **Insights Storage Space map** — WinDirStat-style squarified treemap on Insights → Storage as a new **Space map** card (meters + share tables kept). Zoom / breadcrumb drill-in; World dimensions, Logs, Other; Mods and Backups drill when sizes exist; client tree from existing `optional.storage` (+ live dimension / backup sizes). Backend `by_mods` top-40 jar sizes + Other for Mods drill. Camera zoom animation, GB/MB/KB labels, dynamic label scale, fills available width. `d3-hierarchy` + visx `ParentSize` (not nivo)
- **Storage treemap motion / design notes** — maintainer plans/specs under `docs/superpowers/plans|specs/*storage-treemap*` (motion pass follow-ups)
- **Scorecard `grade_reasons`** — structured codes explaining a Degraded (or similar) grade without changing grade math; Overview Needs-attention can list them; support brief open/reviewed issue counts clearer
- **Mods → Log errors Active / Reviewed** — Mark reviewed + Active/Reviewed tabs (chrome layout stabilized so switching tabs does not jump)
- **Dashboard timezone** already shipped in 1.1.6; Unreleased follow-ups localize more Schedule / digest / hygiene surfaces as they touch datetime helpers

### Changed

- **Setup wizard is owner-only** — invited admin/viewer accounts skip the full server setup wizard after password change
- **Acknowledgements and suppressions attribute the account name** instead of the literal `dashboard` (rows written before the update keep `dashboard`)
- **Session activity plate** — right-column feed merges live `player_join` / `player_leave` from ops-cache activity with `join_clinic` failures (expand + **Copy fix**); replaces full-width Join clinic and Recent sessions; Issues action **Open Session activity**
- **Dashboard UI identity pass (Jul 29)** — accent off Linear-style periwinkle onto bold signal blue (`#4C8DFF` family); shadcn token layer aliased to `--wt-*`; radius ladder tightened; solid rail (less glass mush); lantern/logo lockup; channel colours (TPS/MSPT/heap/CPU/…) separated from status colours (ok/warn/danger) so gauges are not ambiguous; shared `.wt-plate` / `HeroCard` across Overview + ops heroes; Geist + JetBrains Mono; dead UI surface cleanup for one language
- **Identity follow-up (evening)** — KPI hierarchy on Insights; remove static count-ups that lied; drop unused WebGL specular / `ogl` paths and unused motion bits; a11y list/keyboard fixes on catalogs; mission uptime KPI formats `1d 14h 13m` / `14h 13m 5s` without overflow
- **Issues Active grouping** — thematic bands (Jar drift / Client-only / Script fails / World pressure) removed from inbox chrome; severity-only Critical / Warning / Info; specialized Fix actions still keyed by issue id (`MOD_JAR_DRIFT`, `SILENT_FAIL`, `WORLD_PRESSURE`, `CLIENT_ON_SERVER`, …)
- **Startup Boot health** — hero treatment aligned with shared plates
- **Backups / Activity / Sources heroes** — flattened chrome; hide duplicate shell H1 where the page hero already titles the tab
- **Tab scroll reset** — changing rail route scrolls main content to top
- **Dashboard snappiness** — `React.lazy` route splits; SpecularButton WebGL cap/pause when off-screen; shell query dedupe; fixture samples honour `minutes` / `max_points`
- **React dashboard is canonical (de-alpha)** — production UI is `web/dashboard` (React 19 + Vite + Tailwind 4); Preact tree moved to `web/dashboard-archive`; preview APIs/profiles renamed; Gradle embed, CI, packaging audits, CONTRIBUTING / end-user docs point at the React path; alpha packaging audit scripts renamed/consolidated (`tools/audit-dashboard-packaging.mjs`, parity updates)
- **Docs / screenshots** — recaptured Overview, Live-Metrics, Insights, Mods, Issues, Crash-Logs, spark, Backups under `docs/assets/screenshots/`; public ROADMAP / wiki pages updated for digest, world pressure, silent fail, external kill, drift, restart hygiene; new wiki pages World-Pressure, Script-Failed-Silently; maintainer roadmap realignment (`ROADMAP-AUDIT-2026-07.md`, `shipped-1.1.md`, near-term / day2 version docs, backlog-deferred, cut-log)
- **Support compose privacy & correctness** — redact ops once for facts/brief/zip; safer IPv6 regex; ensure `facts.system`; `panel_running` unknown instead of false DOWN when unknown; absolute `server_dir`; UUID truncation in share copy; join dedupe; budget accounting includes history/rollups; soft/hard size honesty
- **World pressure UI depth (with 1.1.9)** — Insights → World hero, classifiers, dimension cards, pies, quiet/busy/peak compare bars, forceload share, Players gauge, Spark World deep-link; chunk load breakdown (spawn estimate + vanilla `/forceload` + NeoForge mod force-loads); world compare baselines (busy-hours p95 + window peak 7d/30d)
- **Overview restart hygiene layout** — hygiene subsection on Restart plate; incident story + digest teaser card polish; friendlier incident titles
- **Crashes Killed chip** — external_kill filter under Host; Fix copy OOM vs panel force-kill

### Fixed

- **Join clinic mock / preview** — Vite fixture API re-reads `join_clinic` (and related ops blocks) from disk mid-session so Session → Join clinic is not stuck empty after regenerating mock data
- **Live charts harden** — tip-forced downsample; stale host/net equality guards; no blank flashes on navigate; Y-domain recovery; calmer slide/hover thrash
- **Blank Insights after Space map Motion transition** — outlet / motion edge case that white-screened Insights after treemap enter
- **Mission uptime KPI overflow / overlap** — clock + unit markers fit the mission band
- **Mods Log-errors chrome shift** — Active ↔ Reviewed no longer reflows the list chrome
- **Support bundle P0–P2** — privacy leak of raw ops into facts/brief; over-redaction of timestamps; missing system/panel/server_dir; size/budget under-count
- **Status fragmentation** — grade reasons on Overview + clearer support brief issue lines so Degraded is explainable

## [1.1.9](https://github.com/djinnbanter/WatchTower/compare/v1.1.7...v1.1.9) — 2026-07-29

Artifacts: `watchtower-neoforge-1.1.9+mc1.21.jar` · `watchtower-cli-1.1.9.jar` in `releases/1.1.9/` and `releases/latest/`.

> **Note:** 1.1.8 (pack pin storytelling & export) is deferred — this release skips that number.

### Added

- **Entity and chunk pressure + farm/item-storm storytelling** — always-on per-dimension world census folded into the tick-thread sample pass (analysis off-thread): entity totals, items vs living split, top entity types, loaded chunks, forced/forceload share; quiet-hours baseline from L1 rollups; sustained classifiers `item_storm` / `mob_spike` (unattended-loaders storytelling on World UI; unattended-as-Issue later removed to cut noise)
- **Insights → World** — dedicated Insights nav pill: alerts strip, by-dimension cards, forceload share, entity pressure, Players `WtGauge`, quiet / busy / peak compare bars, Spark World deep-link for per-chunk proof
- **Issues `WORLD_PRESSURE:*`** — continuous ledger rows when classifiers stay hot; Fix pane deep-links World / Spark; kill-switch `WORLD_PRESSURE_ENABLED` (default on). Read-only — never kills entities or unloads chunks
- **Chunk load breakdown helpers** — `SpawnChunkEstimate` + NeoForge `ChunkLoadBreakdown` (spawn estimate, vanilla `/forceload`, mod force-loads) for forceload share storytelling
- **World census sampling config** — NeoForge `liveWorldCensusIntervalSeconds` / related live sampling; fixtures under `samples/fixtures/world-pressure/`
- **Wiki** — `World-Pressure.md`, Configuration / Insights / Roadmap / HTTP-API / On-disk-Files updates; in-app wiki rebuild

### Changed

- **Performance rollups** — L1 minute rows may carry `entities_max` / `chunks_max` / `unattended_chunks_max` when census has run; ops-cache `world_pressure` block holds latest census, baseline, MSPT correlation, classifiers
- **Roadmap** — World pressure moved to Works today; pack-pin remains Coming next under deferred 1.1.8

### Fixed

- World pressure classifiers gated on sustained windows vs quiet baseline (avoids one-tick spikes)
- Census collection failures degrade soft (no tick-thread throws into sampler)

## [1.1.7](https://github.com/djinnbanter/WatchTower/compare/v1.1.6...v1.1.7) — 2026-07-29

Artifacts: `watchtower-neoforge-1.1.7+mc1.21.jar` · `watchtower-cli-1.1.7.jar` in `releases/1.1.7/` and `releases/latest/`.

### Added

- **Script / datapack / KubeJS silent-fail surfacing** — `SilentFailSignatures` matches known log lines on the existing ops-log tail (KubeJS ERROR/Exception/failed, CraftTweaker ERROR, datapack `Couldn't parse data file` / element, `/reload` Failed to execute reload / Reload failed); persists `silent_fails` in ops-cache; continuous Issues `SILENT_FAIL:{kind}:{…}` with path (+ line) when present on the **same** log line
- **Issues Active band (at ship)** — Script & datapack failures thematic section (later Unreleased: severity-only inbox; ids unchanged)
- Kill-switch `SILENT_FAIL_DETECT_ENABLED` (default on). Does not auto-edit scripts
- **Wiki** — `Script-Failed-Silently.md`; Configuration / Issues / Changelog; fixtures `samples/fixtures/issues-live/silent-fail.json`

### Changed

- `OpsLogTailScanner` / `OpsCacheWriter` / `IssuesLiveEvaluators` pipeline mirrors `MOD_JAR_DRIFT` / `EXTERNAL_KILL` pattern (dedupe, suppress, ack)

### Fixed

- Path capture only when co-located on the triggering line (no cross-line false paths)

## [1.1.6](https://github.com/djinnbanter/WatchTower/compare/v1.1.5...v1.1.6) — 2026-07-28

Artifacts: `watchtower-neoforge-1.1.6+mc1.21.jar` · `watchtower-cli-1.1.6.jar` in `releases/1.1.6/` and `releases/latest/`.

### Added

- **Uptime & restart hygiene advisor** — `RestartHygieneAdvisor` reads JVM uptime + recent vs prior-12h GC/heap rollups; when both look worse, Overview Restart plate suggests a maintenance restart and the next historically quiet window from Schedule evidence (UTC-canonical server-side). Advisory only — never starts, schedules, or blocks `/stop`. Kill-switch `RESTART_HYGIENE_ENABLED` (default on). Payload on Overview meta / `meta.restart_hygiene`
- **Dashboard timezone preference** — Settings picker (`wt-timezone`: browser / UTC / IANA) via `web/dashboard` datetime helpers; localizes Insights Schedule heatmaps and restart-hygiene quiet-window display; stored rollups remain UTC

### Changed

- Overview Restart card layout to host hygiene subsection beside Safe / Caution / Wait checklist
- Conf.example + Configuration wiki keys for restart hygiene

### Fixed

- Quiet-window suggestion uses existing hour-of-week Schedule evidence (no new backend timezone store)

## [1.1.5](https://github.com/djinnbanter/WatchTower/compare/v1.1.4...v1.1.5) — 2026-07-28

Artifacts: `watchtower-neoforge-1.1.5+mc1.21.jar` · `watchtower-cli-1.1.5.jar` in `releases/1.1.5/` and `releases/latest/`.

### Added

- **Watchdog and OOM force-kill detection** — post-mortem on the **next** boot: session heartbeat + clean-stop marker (`WatchtowerBootstrap` stopping path); if prior session vanished without a Minecraft crash report, `ExternalKillDetector` + `KernelOomProbe` classify OS/container OOM-killer vs panel watchdog / SIGKILL
- **Crashes `failure_kind: external_kill`** — synthetic/merged entry (not wiped by file-based crash rebuild); **Killed** chip; Fix copy subtype-correct (OOM → memory limit / Insights → Configs RAM advisor; panel → raise stop/watchdog timeout); ack/review works like file crashes
- Continuous Issues via `IssuesLiveEvaluators.fromExternalKill` when applicable
- Kill-switch `EXTERNAL_KILL_DETECT_ENABLED` (default on)
- Fixtures `samples/fixtures/external-kill/*`; tests `ExternalKillDetectorTest`

### Changed

- Crash group API merges `external_kill` block per-request so ops crash file rebuild cannot drop the verdict
- Wiki Crashes / Configuration / Changelog

### Fixed

- Abrupt kill vs clean stop discriminated by clean-stop marker + heartbeat freshness (no false Killed after orderly `/stop`)

## [1.1.4](https://github.com/djinnbanter/WatchTower/compare/v1.1.3...v1.1.4) — 2026-07-28

Artifacts: `watchtower-neoforge-1.1.4+mc1.21.jar` · `watchtower-cli-1.1.4.jar` in `releases/1.1.4/` and `releases/latest/`.

### Added

- **Pack drift lock** — `ModJarChecksumBaseline` SHA-512 on mod jars vs last baseline; `ModsInventoryDiff.drift[]`; continuous Issues `MOD_JAR_DRIFT:*` when same filename + version, different hash. Copy: verify intentional swap — not labeled “corrupted.” Kill-switch `MOD_JAR_DRIFT_ENABLED` (default on)
- **Client-only jar Issues** — high-confidence `likely_removable` from `ModSideScorer` (+ Modrinth side) → continuous `CLIENT_ON_SERVER:{mod_id}` info Issues; respects ignored client mods; kill-switch `CLIENT_ON_SERVER_ISSUES_ENABLED` (default on)
- Issues Active thematic sections at ship (Jar drift / Client-only jars) — see Unreleased for later severity-only inbox chrome
- Fixtures `samples/fixtures/ops-cache/mod-jar-drift-positive.json`, `samples/fixtures/issues-live/mod-jar-drift.json`, `client-on-server-band.json`; tests on diff / evaluators

### Changed

- Ops scan refreshes drift + client-on-server into `issues_live` on jar inventory wake
- Wiki Issues / Mods / Configuration

### Fixed

- Normal Modrinth version bumps (name/version change) do not raise drift; drift is hash-only same name+version

## [1.1.3](https://github.com/djinnbanter/WatchTower/compare/v1.1.2...v1.1.3) — 2026-07-28

Artifacts: `watchtower-neoforge-1.1.3+mc1.21.jar` · `watchtower-cli-1.1.3.jar` in `releases/1.1.3/` and `releases/latest/`.

### Added

- **Weekly ops digest** — `WeeklyDigestBuilder` rolls grade, crashes, disk delta, MSPT / low-TPS trend, and mod changes into one weekly summary entry; bounded history in ops-cache (`WEEKLY_DIGEST_HISTORY_MAX`, default 8); auto cadence `WEEKLY_DIGEST_INTERVAL_DAYS` (default 7); kill-switch `WEEKLY_DIGEST_ENABLED` (default on)
- **Insights → Digest** — full history panel + manual refresh
- **Overview digest teaser** — dismissible card with “do this next” action; no email / webhook
- **HTTP** — `GET` / `POST /api/weekly-digest`
- Fixtures `samples/fixtures/ops-cache/weekly-digest-*.json`; Java `WeeklyDigestBuilderTest` + dashboard `weekly-digest.test.ts`
- Wiki Insights / Dashboard-Overview / Configuration / HTTP-API / On-disk-Files / Understanding-Data-Sources / Roadmap; conf.example keys

### Changed

- Ops scan `maybeBuildWeeklyDigest` / `buildWeeklyDigest` wired through `OpsCacheWriter.applyWeeklyDigest`
- Public ROADMAP Works today lists weekly digest

## [1.1.2](https://github.com/djinnbanter/WatchTower/compare/v1.1.0...v1.1.2) — 2026-07-26

Artifacts: `watchtower-neoforge-1.1.2+mc1.21.jar` · `watchtower-cli-1.1.2.jar` in `releases/1.1.2/` and `releases/latest/`.

### Added

- **Spark evidence workspace** — alpha Spark adds profile/import/upload controls, evidence-ranked findings, source own/involvement views, one-minute timeline, bounded call paths, world/memory/technical context, and compatible baseline comparison without AI
- **Spark v2 APIs** — cached parsed profiles plus bounded tree, local upload, and deterministic compare endpoints; profile list now exposes live auto-capture status
- **Support Bundle Builder** — rail Support opens a modal to choose preset, category/note, logs (Off/Tail/Full), crashes, Spark, and extras; async compose + download; Copy for Discord blurb; attach-from Logs/Spark
- **Support pack v4** — `environment.json`, `builder-options.json`, redacted ops/config, evidence collectors, soft 25 MiB / hard 100 MiB budgets, skip reasons in manifest
- **Wizard Initial discovery** — blocking first-run **deep audit baseline** (ReportEngine facts/brief + ops-cache reconcile) with **per-item progress** (logs / crashes / mods counts + processing N/M detail); Next stays locked until complete (`POST /api/onboarding/discovery/start`, `GET /api/onboarding/discovery/status`); Watching + Scanning keep deltas after that
- **Wizard Options step** — enable Modrinth lookup (and optional auto-scan) before Initial discovery
- **Wizard without Support schedule** — setup no longer asks to schedule bundles; use rail **Support** when you need help

### Changed

- **Spark interpretation contract** — corrected root-normalized inclusive/self math, authoritative source attribution, mode-aware units, one-minute window semantics, and evidence-linked reversible advice while preserving production summary aliases
- **Spark source involvement** — nested same-source frames no longer inflate involvement above 100%; Own/Involvement sorting follows the selected metric
- **Support compose is async-only for download** — `POST /api/support/compose` (or `/api/reports/run`) then `GET /api/support/bundle` when `zip_ready`; GET no longer composes on the request thread
- **Settings without Deep audit schedule** — General no longer exposes schedule / lookback / incremental; day-to-day is Initial discovery + Watching/Scanning; optional legacy schedule stays in `watchtower.conf` / `/watchtower schedule` only
- **Zero-BAU wiki (Z10)** — in-app Docs updated: Understanding Data Sources, Health Reports, Commands, dashboard guides, HTTP API, Configuration kill-switches; Support compose is the operator ask (no Initial collection homework)
- **SupportComposer (Zero-BAU Z7–Z8)** — Support zip and `/watchtower run` / `/watchtower diagnostics` compose from continuous ops + rollups; synthesizes `watchtower-facts-support-*` + brief for the zip only (BAU dashboard ignores `-support-` artifacts); includes logs tail and latest Spark profile when present
- **Session tab (Zero-BAU Z6)** — player directory poll merges live online state; stats playtime uses an mtime cursor (skips unchanged files); Session no longer prompts for deep audit / Initial collection
- **Activity gap backfill (Zero-BAU Z5)** — when `latest.log` unread bytes exceed the threshold (default 5 MB), ops defers inline parsing and an async job chunks activity events into the ops ledger (kill-switches: `ACTIVITY_GAP_BACKFILL_ENABLED`, `ACTIVITY_GAP_THRESHOLD_MB`, `ACTIVITY_GAP_CHUNK_MB`); steady tail scans continue for live context
- **Post-continuous UX** — Catch-up removed from the primary rail; day-to-day CTAs point to Live / Issues / setup; **Support compose** (rail Support, Settings → Advanced, `/watchtower run`) replaces Force deep audit; Sources = Watching / Scanning / Support compose; wizard schedule defaults **Off**

### Fixed

- **Wizard discovery crash/issue counts** — finished Initial discovery fills Crashes and Issues from facts (`crash_summaries` / non-historical `issues[]`) instead of blank dashes; real `0` shows as 0
- **Setup 2FA QR code** — wizard and Settings Security read `qr_data_url` from TOTP setup (was looking for `qr_image_url`, so only the secret showed)
- **Overview Restart plate glow** — secondary Restart card no longer wraps in BorderGlow; mission hero keeps the glow
- **Zero-BAU Pass 4** — disk-fill and tick-lag Issues fingerprints are stable (`disk_fill_projected`, `lag:c`/`lag:w`) so reviewing no longer reopens on daily days-until-full drift or open-entry count changes
- **Zero-BAU Pass 3** — action queue gates on ops backups/crashes (not only issues_live); Issues Hidden from suppressions store without facts; Backups/crash drivers prefer ops; empty Mods/Insights/Startup/Overview copy retargeted to Scanning / Support; wiki + Docs widgets drop report-as-BAU framing
- **Zero-BAU Pass 2** — Support-compose facts excluded from `/api/reports/index` (BAU hydrate); Overview missing legacy facts is neutral (`stale=false`) instead of forever-stale homework; `/api/mods/tree` falls back to ops-cache Scanning data; `/watchtower issues` prefers `issues_live`; brief/status no longer treat compose as a deep audit / “run first” homework
- **Zero-BAU Pass 1** — remaining ops-cache and state load→mutate→write paths take path locks; Issues ledger contracts fixed (log stale uses `active`, disk fill uses projection analyzer fields + warn days, resolved lag skipped, stable `backup:stale` / `backup:not_found` fingerprints); backup scans refresh Issues; Acknowledge all syncs `issues_live` to reviewed
- **Backup Issues “lookback window”** — BAU Issues no longer tie backup freshness to report `LOOKBACK_HOURS`; `BACKUP_NOT_FOUND` is only when no archive exists (“No backup archive found.”), and `BACKUP_STALE` fires when the newest archive is older than **24 hours** (“No backup in the last 24 hours.”); continuous evaluator reads `backups_live.last_backup`
- **Crash Scan stuck on Unknown** — manual Crashes → Scan force-reclassifies every crash report (not only changed files); ops enrich overrides weak/missing facts `failure_kind` so Alloyed load-fails and watchdog hangs refresh after a jar upgrade
- **Crash groups showing Unknown** — NeoForge stack frames now count toward loader classify; group titles prefer exception / display label over a bare "Unknown"; continuous enrich advances past already-parsed files; weak `failure_kind=unknown` no longer overwrites a better prior label
- **Modrinth update blockers** — missing required dependencies show the Modrinth project title (not the raw project id) in Will break / blockers
- **First-login account setup** — login/TOTP now open the username/password change gate when `must_change_password` is set (backend never sent `gate`, so the wizard could start discovery before account setup)
- **Preview mode on live servers** — embedded dashboard injects `data-embedded="true"` even when `index.html` has `data-skin` / extra attrs (old exact-string replace missed the tag and fell back to fixture data)
- **Fresh install empty dashboard** — Initial discovery again runs a **full deep audit baseline** (ReportEngine facts + brief + ops reconcile) so Overview/Issues/Mods open with data; continuous Watching/Scanning handle deltas afterwards. Empty `/api/live` `latest: {}` no longer counts as live data; wizard finish hydrates reports/ops-cache/live so tabs are not stuck on a pre-discovery empty snapshot.
- **Zero-BAU audit fixes** — scheduled tick runs Support compose (not full ReportEngine); ops-cache delta writes synchronized; Modrinth scan works without legacy facts; `/api/reports/run` tracks runtime state; dashboard removes dead deep-audit modal/wizard baseline; Modrinth/Updates tabs ungated; Sources shows `last_support_compose_at`; `MODS_DEEP_MAX_JARS_PER_WAKE` enforced in jar index rebuild; wiki `ACTIVITY_GAP_CHUNK_MB` default corrected to 2
- **Dashboard blank screen** — fixed jammed wizard import and a broken `</${Button}>` close tag in Settings → Advanced that aborted module load

- **Spark auto-capture** — failed starts no longer burn the full cooldown (short ~60s failure window); start watchdog clears a stuck `inFlight` if the server tick never runs
- **Continuous Issues mod keys** — fixed mod-log ledger rows resolve when peeks clear (no sticky Active cards)
- **Crash scan labels** — unchanged crash files keep prior enrich labels across ops polls
- **Ops-cache / state races** — path locks on load→mutate→write so boot/player/ops schedulers cannot clobber `issues_live` or wipe issue acks via `ops_cache_seq` bumps
- **Issues ledger ack keys** — dashboard `issue:DISK_HIGH` maps to bare ledger id `DISK_HIGH`
- **DR report state** — disaster-recovery runs no longer bump `ops_cache_seq` via incident-story enrich
- **`/watchtower diagnostics`** — packs an ops-only support zip when no facts exist yet
- **Spark ↔ lag correlation** — 60-minute window (was 5), respects `SPARK_FRESH_HOURS`, and no longer correlates when times are missing
- **Spark freshness** — future/skewed `captured_at` no longer counts as fresh
- **Spark profile list** — caches unchanged files so Refresh does not re-parse multi-MB profiles every time
- **Spark empty state** — disabled copy points to `SPARK_ENABLED` in `watchtower.conf` (not Settings)
- **Spark docs** — Using-Spark / Dashboard-Tabs / conf.example match real behaviour; removed dead `RCON_SPARK_TPS`

### Added

- **Zero-BAU hardening (Z11)** — dashboard fixture ops-cache includes `issues_live` + `mods_deep`; preview hydrates Sources timestamps; regression test asserts ops tick never imports StagingBuilder/ReportEngine — ops tick writes `issues_live[]` (lag / log stale / disk / backup / mod keys) so Active Issues works with report schedule Off; ack/suppress mirrored in state; Force catch-up enriches without wiping opens
- **Startup profile on boot** — captures boot phases into ops-cache ~60s after start (`STARTUP_PROFILE_ON_BOOT`); Startup tab + Overview read ops when facts are missing
- **Crash enrich on mtime** — light classify/summary when crash files change (`CRASH_ENRICH_ON_MTIME`); listing still continuous without enrich
- **Mods light on jar change** — side-score snapshot into `mods_light` (`MODS_LIGHT_ON_JAR_CHANGE`); Mods Overview prefers it when fresher than the last report
- **Player directory poll** — Session data refresh every 15m by default (`PLAYER_DIRECTORY_POLL_SEC`)
- **Overview Spark without report** — `spark_tldr` falls back to the latest fresh on-disk / auto-capture profile
- **Support zip without facts** — download works from ops-cache + rollups before the first catch-up audit
- **New-install schedule Off** — fresh `watchtower.conf` defaults `REPORT_SCHEDULE_MODE=off`; dashboard **Force catch-up** replaces day-to-day Run Report framing

- **Overview Spark summary** — renders `spark_tldr` with Open Spark deep-link when a fresh profile was in the last report
- **Issues Open in Spark** — Fix panel button when a lag issue has a profile path
- **Spark UI persistence** — remembers sub-tab and last profile path in the browser
- **Spark import size limit** — rejects bytebin downloads over 64 MB
- **SparkPaths helper** — shared upload-dir resolution with server-root containment
- **Crashes inbox** — list rows match the Issues inbox (flat inset rows, same hover/active chrome)
- **Overview Storage UX** — removed RAM free tile; dial + World/RSS KPIs, cleaner dimension rows with share %, notes grouped in a footer; Classic Sass wells/tiles
- **Live RAM used** — toolbar + Host machine chart show host RAM used (not free); preview derives used from available when needed
- **Live toolbar vitals** — adds CPU %, RAM used, and host temps (CPU package / ambient when available) beside TPS / MSPT / Players
- **Overview storage dial** — “Disk used” title above the dial; center shows only the %
- **Live temp dials** — title sits above the dial; center shows only the temperature number
- **Live network / host temps on large screens** — Network and Host temperatures sit side-by-side from 1200px; cards stay stacked inside each column
- **Live network layout** — Receive / Send stack like host temps: graph on the left, animated Mbps readout on the right (charts restored via I/O history hydration)
- **Live disk read/write charts** — hydrate series from envelope I/O history in preview (and keep appending in the simulator); latency KPI sits under the chart grid instead of breaking the 2-column layout
- **Live host temps** — CPU package and Ambient stack vertically; dial sits to the right of each graph
- **Sass rail width** — side nav stays the same width as Aero (no longer expands to 248px)
- **Live chart readout** — current series value sits in the card header next to the title (not as a floating chip on the plot); hover still updates it
- **Live toolbar UX** — tighter lead group (status + vitals), controls flush right with a poll divider; freshness shows age only (no duplicate “Live”); Classic Sass chrome for vitals/select/window
- **Live 5m window** — chart range picker starts at **5m**, then 15m…30d
- **Sass Live chart polish** — taller plots; tighter left/bottom axis gutters so the series fills the card
- **Sass Live thermal + network** — temp gauges and network heroes flattened to Classic cards (no aero glow/cyan); chart wells inside thermal cards match the graph fix
- **Sass Insights heatmaps** — schedule hour-of-week maps use skin tokens (ok/warn/danger + accent) instead of hard-coded blue; Classic cell chrome + hour-bar wells
- **Sass chart wells** — removed harsh black inset borders around Live/Overview graphs; plot area blends with the card surface
- **Sass skin polish** — OLED-darker black theme (`#000` canvas); fixed mission tone washes overwritten by glass; grade beacon no longer styled as a card; Classic vitals/trust/setup chrome; no hover lift on vitals
- **Overview mission band** — denser two-row layout: compact grade + verdict on top, full-width live vitals strip below; KPI chips wrap as a tight row (no empty side column)
- **Sass skin (Classic v1.0 look)** — opt-in look via rail **Skin** (Aero ↔ Sass): Deep Orange `#FF5722` CloudGuard palette, Inter + JetBrains Mono, glass cards, solid orange active rail, orange pill **Run Report**, left severity bars on issue rows; Aero (neo-glass) stays the default
- **Config and launch audit** — read-only `server.properties` audit (view-distance, simulation-distance, max-tick-time, compression, sync-chunk-writes, entity broadcast) with soft “consider” verdicts on Startup and Insights → Configs; reuses the JVM flag summary from this release (no duplicate classifier); per-key dismiss via `localStorage`; `GET /api/config-audit`; kill-switch `CONFIG_AUDIT_ENABLED` (default true); apply/write deferred to 1.1.21; Startup/Insights audit cards use padded Card + ListRow chrome (not bare text)
- **Incident story timeline** — correlates lag spikes, crashes, mod-jar changes, and backup failures within a ~30m window into plain-English narrative cards; Activity shows the full chronological story with deep links; Overview teasers the latest story; live in `ops-cache.json` `incident_stories` and mirrored to facts `optional.incident_stories` on report (`INCIDENT_STORY_*` conf; kill-switch `INCIDENT_STORY_ENABLED`); dashboard fixture/mock data includes a demo lag → Create crash → backup-failed story; Activity page layout cleaned up (KPI strip, narrative-first story card, compact alert, single event feed)
- **Motion revival** — dashboard feels alive again with mount-once page enter (no Overview/Live poll flash), shared metric count-ups (from 0 on tab open, tween on change), animated gauges/radar dials, one-shot chart reveals, bar/hour-bar grow-in, heatmap cell stagger, tab outlet fade + View Transitions when supported, list stagger on Overview queues, and safer button/icon press feedback (no spinner fight); all motion still respects `prefers-reduced-motion`

- **Spark Import from URL** — Spark tab **Import from URL** pastes a `spark.lucko.me` link (or 10-char key); downloads once from lucko bytebin into `watchtower/spark-upload/` (`POST /api/spark/import`, allowlisted hosts only)
- **Disk fill projection + I/O health** — L1 minute avgs for disk use/free + write rate/await; Netdata-style days-until-full projection (`DISK_FILL_*` conf); live `write_await_ms` from `/proc/diskstats` with rare fsync probe fallback; Overview Storage runway line; Live latency KPI; Insights Storage projection card; MSPT↔disk write correlation insight; Issue `DISK_FILL_PROJECTED` when runway ≤ warn days
- **Performance baseline + regression** — auto-captures a known-good window once when healthy; compares last 7d p50/p95 TPS/MSPT/heap to the frozen baseline; Insights → Patterns banner + **Set new baseline**; Overview teaser when slower; Settings → Monitoring toggles (`BASELINE_AUTO_CAPTURE`, `BASELINE_REGRESSION_THRESHOLD_PCT`); best-effort jar `mtime` correlation; never auto-overwrites
- **RAM right-sizing advisor** — Insights → **Configs** shows a conservative wallet-framed card: Right-sized / Over-provisioned / Under-provisioned / Not enough data from 7d+ L1 heap peak/p95 vs live `-Xmx`; window-recomputed GC gate blocks “add more RAM” when history looks single-thread bound (and when GC-bound unless heap pressure stays high); soft “toward ~N GB” tip only when clearly idle
- **1.1.x quality pass** — Settings live save applies snake_case server payload (Monitoring toggles no longer snap back); quieter Monitoring toasts; baseline healthy streak ≈30 min; mod-diff `mtime` on added jars; Configs prefers report JVM health over live spikes; Restart uses unreviewed crash time + stable `checked_at`; Insights baseline banner padding uses real spacing tokens (`16`/`20`, not undefined `--ui-sp-18`)
- **Safe-to-restart checklist** — Overview **Restart** card answers Safe / Caution / Wait from backup freshness, Chunky/DH pregen, players online, disk headroom, and recent crashes; reasons deep-link to the right tab; informational only (never blocks `/stop` or the panel); hybrid backups prefer a fresh external heartbeat over a stale local archive
- **GC / JVM flags health advisor** — Live GC pause % of wall + heap pressure + flags profile; **Insights → Configs** always advises the best Aikar / flags.sh baseline for this Java / Minecraft / heap size, lists missing flags worth adding (including Xms=Xmx when max is set without matching start), and shows a single-line recommended-flags box when adopt/complete/large-heap applies (never overwrites healthy Bruce/MeowIce/ZGC/custom); Configs card layout polished (single action badge, quiet meta row, vitals, collapsible missing list) with fixed spacing tokens so card/vitals/flags padding actually applies; live and report share `buildJvmHealth` payload shape; Insights Load daily GC/heap columns; report `optional.jvm_health` and Issues `GC_PRESSURE` for sustained heap/GC-bound cases. Preview fixtures include a `g1_basic` sample with gaps.
- **Auto-Spark lag capture (1.1.1)** — opt-in Settings → Monitoring toggle (off by default): on critical sustained lag, Watchtower runs Spark for ~45s, saves a profile on disk, attaches top non-vanilla mods to the lag incident, and surfaces an Issues chip + Spark “Auto-captured” deep link (`SPARK_AUTO_CAPTURE_ON_LAG`)
- **Roadmap share image** — neo-Frutiger Aero poster of the public roadmap (docs/assets/watchtower-roadmap.png + editable 
oadmap-poster.html)
- **Roadmap dashboard page** — new System rail tab (?tab=roadmap) showcasing what’s coming next in a neo-Frutiger Aero glass layout (hero band, Live today strip, themed vision cards, bigger horizons, trust chips, GitHub Issues CTA); guided tour includes a Roadmap step
- **Dedicated Modrinth scan backend** — opt-in scans now own Modrinth network work, persist a status snapshot and cache, and patch the latest facts report with refreshed mod identities and update impact data
- **Mods → Modrinth** — dedicated subtab with coverage/outdated/cache KPIs, Run scan, staged checklist with batches + ETA, and Overview banner deep-link; `POST /api/modrinth/scan` + `GET /api/modrinth/status`
- **Modrinth auto-scan after mod changes** — optional Settings → Monitoring toggle (`MODRINTH_AUTO_SCAN_ON_MOD_CHANGES`); when lookup is on, starts the dedicated Modrinth scan if the ops poll sees jars added/removed/updated (not tied to Run Report)
- **Mods → Updates** — dedicated subtab for Modrinth-compatible outdated jars with pack-impact verdicts (Safe / Caution / Break / Unknown), blockers, co-updates, and dependents; never downloads jars
- **Mod update pack-impact analyzer** — during dedicated Modrinth scans, checks candidate version dependencies + local TOML `versionRange` against the installed pack and enriches `optional.modrinth_updates[]`
- **Mods Overview catalog** — merged running + report mods with Modrinth icons, side/Update badges, project links (Modrinth / wiki / source / issues / Discord), All/Client/Server/Unresolved filters, and a permanent split list/details panel
- **Modrinth all-mod enrichment** — opt-in Modrinth scan hashes jars (512 cap, chunked requests, rate-limited, 429 Retry-After once then skip); persists wiki/source/issues/Discord/icon/description on `optional.mods[]` for scoring and the catalog
- **Login default credentials hint** — sign-in screen shows default `watchtower` / `password` with a reminder to change it

### Removed

- **v2 ALPHA concept preview** — removed `web/v2-alpha-preview/` (interactive mock on `:8081`); research notes remain under `docs/dev/ui-ux/v2-alpha/` only

### Fixed

- **Blank dashboard after motion revival** — Overview crashed with `DUR is not defined` in live vitals (missing import); also fixed bad `AnimatedNumber` import paths that broke the patterns barrel
- **Spark tab padding actually applied** — rebuilt bundled `styles.css` so Spark insets ship; stop stripping EmptyState side padding; stacked import actions + `md` button pads; profile chrome in a padded Card
- **Spark tab Refresh + detection feedback** — toolbar **Refresh** rescans disk; unreadable `.sparkprofile` files surface in `skipped` instead of vanishing; `source_path` in facts/API is relative to the server root (fixes absolute `/home/container/...` deep-link mismatches)
- **Modrinth false “updates” (lower version)** — pack MC is voted from jar/version hints with patch-level preferred (`1.21.1` over a lone `+mc1.21` tag); compatible picks must be newer than the installed Modrinth version, so Farmer’s Delight no longer offers `1.21-1.2.4` over installed `1.21.1-1.3.2`
- **Live server MC version stamp** — `SharedConstants` failures no longer leave `meta.minecraft_version` / snapshot empty (falls back to `VERSION_STRING`); snapshot also writes `loader` + `platform.json`; reports refresh the snapshot first; Modrinth scan prefers live snapshot/platform over jar guesses; RCON TPS no longer drops native MC/mods from a stale snapshot
- **NeoForge startup with C2ME (JPMS split package)** — loader glue moved to `dev.mcstatus.watchtower.neoforge` so the outer jar no longer exports the same `dev.mcstatus.watchtower` package as jar-in-jar `watchtower-neoforge-common` (fixes `ResolutionException` when C2ME or other mods require that package)
- **Live chart order** — GC pause % wall (and the GC health block) sits after Players online, not between Heap and Players
- **Overview refresh flash** — disabled enter-fade animations on Overview (same as Live) so live vitals polls no longer look like the page is reloading; Restart checklist keeps a stable `checked_at` when nothing changed
- **Overview vitals isolation** — only the top TPS/MSPT/players/heap/CPU strip re-renders on the 1s Overview live poll; root `kickRender` no longer remounts the whole Overview page on every live tick; grade beacon enter animation settles once
- **Backup false “failure” + Scan now freshness** — archives older than the 24h lookback but still within warn days (default 7) are no longer labeled **Backup failure**; warn-stale uses **Backup is stale**; hybrid setups treat a fresh external heartbeat or fresh local archive as OK; **Scan now** refreshes ops-cache inventory, Overview backup pill, and Issues without requiring a full report
- **Issues / Crashes selection** — row selection uses plain module state (not a Preact signal + kickRender dual path); clicks update the detail pane and no longer leave a detached Issues tree that traps the tab
- **Dashboard thrash while offline** — connection-lost no longer re-renders the whole shell on every failed live poll (that was freezing tab switches); Overview no longer re-subscribes to the 1s clock tick
- **Auto-Spark lag peek** — attaching a Spark profile to a lag incident no longer reopens an already-resolved Issues entry
- **Roadmap page layout** — fixed situation bullet lists wrapping into a 6px column (vertical text mash)
- **Tabs / subtabs stuck until F5** — navigation and subnav clicks force an immediate root reconcile; page outlet passes a route key so param-only changes (Mods/Issues/Crashes views) always re-render; signals SCU no longer bails out of updates
- **Live charts blank until F5** — uPlot canvases are hosted outside the Preact VNode tree so root kickRender can no longer strip them on navigate; Live also kicks samples/live fetch immediately on entry
- **Overview steady layout** — healthy / steady mode no longer splits instrument cards into a side-by-side grid (which looked like 3 columns next to triage); instruments stack like incident mode so Overview stays 2 columns at the same width
- **Modrinth “0 updates” on live NeoForge** — compatible-update checks no longer require a `minecraft` row in `optional.mods` (live sampling omits it); MC version is resolved from snapshot/meta, Spark/startup platform, `+mc` suffixes, or NeoForge version mapping, and empty Modrinth version filters soft-retry with loader + MC preference
- **Mods Overview top-level only** — jar-in-jar / nested mods (e.g. Flywheel inside Create) no longer appear as separate catalog rows; they show under the parent jar in Details as Nested / embedded jars
- **Report Retry** — after a failed (or finished) Run Report, the modal keeps a primary Retry / Run again button instead of only Close
- **Dashboard asset cache** — live server serves HTML/JS/CSS with Cache-Control: no-store so Overview and other UI updates match the installed jar after a refresh (not a stale browser cache)
- **Startup boot phases** — phase durations no longer explode when a log line lacks a parseable timestamp (removed line-index-as-epoch fallback; remaining-budget allocation + total_sec cap; first-hit-only phases; stderr/ANSI-tolerant timestamp parse); Startup UI clamps absurd shares
- **Spark preview** — fixture profiles from `samples/fixtures/spark/` now load in dashboard preview (nested mock lookup, `source_path` selector, parser field names for verdict/methods/timeline/mods/world/advanced); live API unwraps `spark_profile`
- **Roadmap page padding** — fixed collapsed spacing from invalid --ui-sp-18/--ui-sp-28 tokens; sections and cards now use the shared spacing scale with consistent gutters
- **Live charts empty then fill** — charts no longer wait on page stagger / clip-path reveal; samples + live envelope prefetch at boot, and root re-render tracks sample updates so Live paints filled immediately
- **Dashboard navigation frozen** — `@preact/signals` `shouldComponentUpdate` was blocking `useState` and route updates on our Preact build, so rail clicks updated the URL but the page often stayed put; patched SCU and force a root `kickRender()` on route/UI signal changes so hooks, signals, and navigation re-render reliably again
- **Crashes list layout** — rebuilt Lantern `styles.css` so the new list/detail row styles load (unstyled rows were stacking as bare buttons)

### Changed

- **Internal docs** — continuous data-flow delivery roadmap (waves W0–W12) + always-on Scanning doc fix — `docs/dev/roadmap/versions/continuous-data-flow.md`; wiki Understanding-Data-Sources / Health-Reports / Scheduled-Reports / Dashboard-Tabs wording
- **Spark tab section spacing** — Spark-scoped section header/body padding, view stack gaps, and card insets so titles and content are no longer flush; Overview vitals (“How it looked”) lead the profile; wide layouts at 1100 / 1400 / 1800 like Overview and Live
- **Spark profile subtabs story-first UX** — Overview / Mods / World / Over time / Technical: glossed vitals, numbered recommendation steps, mod spotlight, friendly entity names, capture duration, progressive tables
- **Dashboard UI polish (Lantern craft)** — unified glass instrument/card surfaces; shared Issues/Crashes/Mods queue chrome; token hygiene; Live pulse only when connected; focus rings on queue rows/modals; Overview + Insights/Session/Startup/Live freshness stamps; Issues/Crashes row contract (severity · title · age · source · one-line peek), Fix-first details, selection advance after Mark reviewed, `/` j/k `r` queue shortcuts; Spark styles extracted from shell; Modrinth link chips show “opens in new tab”; calmer auth lockout + TOTP paste
- **Internal docs** — **2.0.12–2.0.16** Insights improvements roadmap (Schedule horizon `value (Δ)`, recommenders, calendar overlays, shape-drift teaser, polish; research `INSIGHTS-SCHEDULE-TRENDS`) — `docs/dev/roadmap/versions/2.0.12-2.0.16-insights-improvements.md`
- **Internal docs** — Insights → Patterns → **Schedule** research (7d vs 30d horizon trends, owner/admin/mod JTBD, verdict + inline `value (Δ)`, maintenance/event ladder; sequential vs horizon compare) — `docs/dev/roadmap/studies/INSIGHTS-SCHEDULE-TRENDS.md`
- **Internal docs** — **3.0.0–3.0.11** Watchtower Cloud roadmap (paid optional control plane: pairing, heartbeats/offline, fleet, history, digests, alerts, orgs, incidents, PWA, billing, proxy tree, org intelligence) — `docs/dev/roadmap/versions/3.0.0-3.0.11-watchtower-cloud.md`
- **Internal docs** — **2.0.0–2.0.11** World & optional-mod integrations roadmap (one integration per version: World foundation, FTB Chunks, OPAC, Load My Chunks, Chunk Activity Tracker, Observable, Chunky, Distant Horizons, BlueMap, ServerCore, Does It Tick, Vortex) — `docs/dev/roadmap/versions/2.0.0-2.0.11-world-integrations.md`
- **Internal docs** — Minecraft GC/JVM flags research for **1.1.2** advisor correctness (Paper/Aikar + [flags.sh](https://flags.sh) ≥12G split, [brucethemoose](https://github.com/brucethemoose/Minecraft-Performance-Flags-Benchmarks), [meowice-flags](https://github.com/MeowIce/meowice-flags) Graal G1/ZGC advanced profiles, Java↔MC matrix, Spark pause thresholds, locked recommendation rules) — `docs/dev/roadmap/studies/GC-JVM-FLAGS-RESEARCH.md`
- **Internal docs** — full implementation plan for **1.1.1** Auto-Spark lag capture (async console trigger, incident attach, Issues/Spark UI) — `docs/dev/roadmap/studies/SPARK-AUTO-CAPTURE-111.md`
- **Internal docs** — full implementation plan for **1.1.11** mod change performance impact (L1 before/after, event log, Changes UI); quality pass clarified ops-primary events, needAfter/join/buildPlayerBins visibility — `docs/dev/roadmap/studies/MOD-CHANGE-PERF-1111.md`
- **Internal docs** — diagnostics contribute defaults to **self-hosted MinIO + Caddy** (S3 PutObject, $0 invoice, out of the box) — `docs/dev/roadmap/studies/DIAGNOSTICS-CONTRIBUTE-1135.md`
- **Internal roadmap** — detailed plan for **1.1.35** anonymous diagnostics contribution (opt-in, post-report, 24h cooldown, full redacted crash+logs+facts)
- **Roadmap page** — rebuilt to match the share poster: legend strip, works-today grid, situation panels, later / not-our-job / promises row
- **Public roadmap** — rewritten for clarity: today vs coming next vs later, grouped by everyday admin situations (lag, RAM, restarts, mods, joins, world, help, teams), short bullets, explicit not-our-job table; wiki + in-app Roadmap tab synced
- **Internal NeoForge common module (WT-026 / 1.0.19)** — dashboard HTTP, auth, scheduler, and live metrics live in `watchtower-neoforge-common` behind a `ServerContext` SPI; thin glue remains in `mods/neoforge-1.21/`; CI includes an allowed-fail `:neoforge-1.20` stub. No operator-visible behaviour change (`+mc1.21` JAR unchanged)
- **Internal platform prep (WT-026)** — maintainer roadmap slots NeoForge common-module extract as **1.0.19** (no longer colliding with CA **1.0.16**); multi-loader Phase A checklist restored under `docs/dev/`
- **Instrument plate across pages** — shared glass + tone wash + top gradient hairline (Overview Performance insight / Storage / Pregen / Boot look) now applied to featured cards, Live chart frames & thermal/network plates, Session/Startup heroes, Sources cards, Mods forensics KPIs, and other verdict/hero surfaces
- **Overview Storage** — removed duplicate Heap tile (heap stays in mission vitals); disk used % readout is smaller
- **Overview vivid & alive** — the mission band now reads energetic instead of grey: a glowing grade beacon (tone halo + ring draw-in + letter pop), an even grid of channel-coloured live vital cards (TPS/MSPT/Players/Heap + CPU) with clear current values + count-up + live pulse (no sparkline clutter), a tone mesh wash with gradient headline, tinted KPI chips, one consolidated status chip strip (MC / loader / Java / session / mods / backup — no duplicate pill rows), colour-washed instrument cards, and triage lists as a single glass plate of flush rows instead of nested cards; all motion respects `prefers-reduced-motion`
- **Overview server spec restored** — MC version, loader (NeoForge + version) and Java live in the status chip strip; Heap returns as a live vital up top (`deriveMcVersion` / `loaderInfo` helpers)
- **Overview mission control** — first viewport is one Live-inspired mission band (grade + verdict + vitals) plus quiet trust chips; dropped stacked welcome/status-strip/beacon-trio/vitals row; Storage uses a disk Gauge + dimension well; Boot is a hero strip; triage lists use queue glass; lag list capped; backup-disable CTA shown once
- **Rail brand header** — glass brand plate with icon cradle for the WatchTower mark, stronger wordmark, and a quiet “Server ops” tagline (icon-only when collapsed)
- **Rail + topbar UX** — Reports is one glass plate; System micro-label above Docs/Settings; Theme/Collapse demoted to a compact tool row; rail width unified (220/56); collapse preference restores on boot; mobile drawer always expands; Issues/Crashes badges use warn (1–2) then danger; topbar shows short freshness + Live/Offline chips, Search as primary glass chip then quiet Inbox, hostname falls back to “Unknown host”; guided tour and wiki match current chrome
- **Sticky detail panes** — shell main is now the real scrollport (`height: 100dvh` shell + `min-height: 0` main); page enter animation no longer leaves a `transform` on page body children (both were breaking `position: sticky` on Issues / Crashes / Mods details)
- **Issues / Crashes / Mods chrome parity** — shared glass search+filter strip (`feat-queue-chrome`); Crashes queue and Mods Overview/Updates/Forensics/secondary tabs match Issues toolbar look; Mods Overview & Updates detail panes reuse Crashes detail/panel chrome; catalog row hover/selected aligned; detail panes sticky in the main page scroll (no nested pane scrollbar)
- **Issues tab overhaul** — Active / Reviewed / Tools subtabs; permanent list+detail with Fix | Details; priority bands (Needs / Worth watching / Older); Hidden suppressions under Tools; URL `view` + `issue` deep links; crash rows demoted to Crashes pointers; Overview attention items deep-link into Issues; detail panes reuse Crashes panel/step chrome
- **Crashes Fix pane UX** — numbered step cards with large 1/2/3 badges, primary vs tools vs Mark reviewed action tiers, confidence badge in the detail header, quieter Why footer; Evidence members and Details tech fields tightened to match
- **Crashes Evidence & Details panes** — same panel chrome as Fix (hero + section blocks); pre-crash KPI chips and lead-file highlight; Details grouped into Identity / Classification / Mixins & config / Duplicates & locks
- **Crashes inbox list** — crash groups fold into collapsible day sections (Today / Yesterday / date); only Today is expanded by default
- **Crashes tab subtabs** — **Review** / **Reviewed** / **Tools** (Issues-style Active/Reviewed split); list/detail with Fix | Evidence | Details; Tools holds Scan, Mark all, Find owning jar; inbox deep links open Review or Reviewed from unreviewed members
- **Modrinth report enrichment** — report generation is cache-only; it never calls the Modrinth API, while the dedicated scan refreshes cached data
- **Settings → Monitoring** — Modrinth copy points to Mods → Modrinth for scans (not Run Report); optional auto-scan after mod changes; still SHA-512 only, never downloads jars
- **Mods Overview chrome** — compact one-line Security/Connector banners; single glass control strip with search + filters/sort side-by-side and a one-line stats row
- **Mods Overview search** — search field moved into the catalog toolbar (glass bar with icon) so it sits with filters/sort instead of the easy-to-miss strip under the subnav
- **Mods Overview catalog** — paginated full list (25 per page, First/Prev/Next/Last) with sort (Name, Mod ID, Server→Client, Updates first, Version); remembered in the browser
- **Themed scrollbars** — dashboard scrollbars use soft sky-glass thumbs (Firefox + Chromium) instead of the OS native chrome
- **Mods page gaps** — Page layout no longer wraps inactive tab branches in empty flex children (that was the large blank strip under Mods subnav/search)
- **Mods Forensics** — KPI strip, glass search chrome, side-by-side corrupt/config panels, clearer empty/disabled states
- **Mods subtab search gap** — subnav + search share one nav block so page spacing no longer leaves a large empty strip under the tabs
- **Mods subtabs** — order is Overview → Updates → Conflicts → Log errors → Changes → Modrinth → Forensics (problems first, then inventory/tooling); removed **Client-only** and **Dependencies** pages; Client/server advice stays on Overview details, and dependency trees live in an expandable **Dependencies** section at the bottom of Overview and Updates detail panes
- **Mods list/details scroll** — Overview uses pagination instead of a nested list scroller; details pane stays `overflow: visible` so wheel-scroll over it still moves the page
- **Mods Client/server signals** — Modrinth-backed chips use the Modrinth logo plus plain labels (**Server required**, **Client only**, **Both sides**) instead of raw `modrinth:…` keys
- **Mods list/details layout** — fixed 50/50 split (stacks below ~1100px); details body is two columns (Client/server | About/Links) with Needed by / Needs side by side; toolbar links to Updates when outdated jars exist; Overview Segmented no longer has an Updates filter (use the Updates subtab)
- **Mods Overview split details** — permanent glass list/details split; full-row hover + selected glass highlight; Client/server callout in the details pane (role, reason, advice, signals); Modrinth links only in the details pane
- **Mods tabs UI polish** — Overview catalog gets link chips, alert blocks, and clearer detail sections/CTAs; Conflicts/Changes/Log errors/Forensics get labeled actions, search wiring, and consistent empty states
- **Sidebar rail (neo-aero)** — brand mark from `assets/watchtower-icon-simple.png` + frosted logo plate; glass column with top sheen; clearer group labels and active glass pills; integrated report controls; clearer collapse toggle; theme cycle moved to rail only (removed topbar sun button)
- **Overview** — grade legend under health ring; bold colourful By dimension share bars; backup-disable copy padding; disable-backup-alerts control; Backup pill shows **Not tracking** when tracking is off
- **Session** — Top playtime strip padding aligned with hero; glass hero KPI trio, stronger playtime chips, online/offline directory grouping, playtime report CTA
- **Backups / Settings** — folder and panel setup moved to Settings → Backups; Backups tab is status, inventory, and rescan with link to Settings
- **Insights** — loads performance data on mount (7d/30d window) instead of waiting for a manual window change
- **Sources** — next report and report cadence show hours when interval is ≥60 minutes; data-sources API maps `next_scheduled_minutes`, `ops_scan_at`, and `full_report_at`
- **Issues** — suppress control renamed to **Don't show again**; suppressions load at boot and filter Active immediately (undo in Hidden)
- **Mods → Conflicts** — removed duplicate Scan issues section; update conflicts from `mod_recommendations` only
- **Run Report** — 30-day lookback shows a note that the first full run can take several minutes on busy hosts
- **Activity KPI row** — multi-column auto-fill layout instead of a single full-width tile
- **Support bundle** — includes `ops-cache.json` when present (scan aggregates such as `mod_log_errors` / `mod_issues`) so live scan rows are debuggable
- **Run Report progress detail** — checklist shows step N/M, elapsed time, and live sub-step text (e.g. “Scanning server logs…”) so long Collect stages look alive
- **First-login account setup** — password-change gate now also requires a new username (not the default `watchtower`)

### Fixed

- **Roadmap page layout** — fixed situation bullet lists wrapping into a 6px column (vertical text mash)
- **Mods Overview details pane padding** — panel used nonexistent `--ui-sp-18`, so the padding shorthand was dropped and content sat flush to the edges
- **mods.toml dependency fields** — dependency blocks now keep `type` / `mandatory` / `versionRange` (previously flushed early on `modId`)
- **Mods catalog icons** — CSP allows `cdn.modrinth.com` images; preview mocks use current Modrinth icon URLs (Create/JEI/Sodium were 404 `icon.png` paths); broken icons fall back to a letter placeholder
- **CI audit-public-tree** — removed accidentally committed `.tmp-support-bundle/` (real hostname / player data) and gitignored local support-bundle extracts
- **Missing --ui-sp-14 token** — invalid spacing vars dropped whole padding/gap shorthands (Overview dimension rows + backup banner looked flush)
- **Overview By dimension** — grid layout fixes squashed label/GB text; share shown only via bar width (no duplicate % pill); row + backup banner padding
- **Sidebar logo size** — brand PNG is forced to 24/28px so the 1024px asset no longer blows out the rail
- **Crashes bug icon** — replaced broken custom paths with the Lucide bug glyph
- **Live network / disk IO charts missing** — charts now read `/api/samples` series (`net_rx_mbps`, `net_tx_mbps`, `disk_read_mb_s`, `disk_write_mb_s`) like 1.0.x data flow (Lantern had bound missing envelope `*_history` arrays); dedicated cool Network section with RX/TX heroes; ambient temp chart/gauge auto-scales with a 70°C floor
- **Startup tab false Failed** — boot profile is taken from the last `Done!` window in `latest.log`, not the incremental report cutoff (so a running server after boot is no longer marked Failed); missing Done → `unknown` / Incomplete profile unless a real mod-load failure is evident
- **Fake mod ids in Log errors** (`itemstack`, `blockattachedentity`, …) — vanilla logger packages are recognized before truncation so Minecraft class loggers are not treated as mods
- **Crashes tab “Unknown” groups** — ops-cache scan/reconcile now copies `failure_kind` / mod ids from facts and light-classifies crash file heads (watchdog, FML mod-load banners); group titles fall back to plain English / exception instead of bare “Unknown”; nav icon is `bug` not `flame`
- **Mods → Log errors useless** — tab now merges report + scan aggregates into expandable cards with full sample lines, category breakdown, and Do this next from `mod_recommendations` / scan issues (no longer a one-line flat table)
- **“Run a full report for {mod}” scan hints** — removed; generic hints point at Log errors / concrete category steps instead of nagging after a report already exists
- **Run Report stuck on Collecting** — HTTP `/api/reports/run` now marks the report running (and sets the first stage) before returning 202, so status polls no longer race the server tick; dashboard kicks status polling immediately and ignores a brief false “not running” after start; refresh also re-syncs an in-flight report
- **Report data missing after refresh** — dashboard waits on a loading screen until saved reports hydrate; loads index → latest → `/get` fallback and restores the last selected report; shell retries once if facts are still empty
- **Modal close (X)** — popup close button sits above modal body content and receives clicks again (Run Report and other dialogs)
- **Run Report Hide** — you can close the Run Report dialog while a report is still running (it continues in the background)

## [1.1.0](https://github.com/djinnbanter/WatchTower/compare/v1.0.0a...v1.1.0) — 2026-07-13

Artifacts: `watchtower-neoforge-1.1.0+mc1.21.jar` · `watchtower-cli-1.1.0.jar` in `releases/1.1.0/` and `releases/latest/`.

### Changed

- **Internal docs** — architecture/implementation/storage plan for 1.1.35 diagnostics contribute (docs/dev/roadmap/studies/DIAGNOSTICS-CONTRIBUTE-1135.md)
- **Internal roadmap** — detailed plan for **1.1.35** anonymous diagnostics contribution (opt-in, post-report, 24h cooldown, full redacted crash+logs+facts)
- **Roadmap page** — rebuilt to match the share poster: legend strip, works-today grid, situation panels, later / not-our-job / promises row
- **Dashboard readability polish** — bumped floor type scale (12/13/14px), tokenized feature hints, larger empty-state copy, denser nested Insights subnav, Crashes/Spark on shared `Page` chrome; Logs empty states show body text again
- **Overview welcome** — personalized band with username, server hostname (and panel label), plus a short live status summary before vitals
- **Session roster** — single full-width composition (vitals → top-playtime chips → directory); status as a tone dot instead of a fat badge beside the name; default sort online-first
- **Insights Patterns** — split into Overview / Schedule / Load / Incidents sub-panels (`?panel=`); Schedule adds TPS and players hour-of-week heatmaps (plus players hourly bars) alongside MSPT
- **Setup wizard (first-time experience)** — live discovery audit via `POST /api/onboarding/audit` (with `backup_configured` / `has_facts_report` / `schedule_summary`); optional non-blocking 30-day baseline with report stage progress; actionable Backups / schedule / Security steps (Backups no longer auto-completes the wizard); Docs **Run again** and `?setup=1` relaunch correctly; Overview resume chip for unfinished setup / baseline / missing backups
- **Crash fix advice (evidence-first)** — Create contraption crashes lead with stop/break the stuck assembly (not Flywheel); Create↔Flywheel pairing only with evidence; watchdog/OOM/env-lock/UCVE/NBT/loader tips reordered to match real operator playbooks; dashboard “Do this now” headlines no longer default to “Update {mod}”
- **Dashboard preview mocks** — crash corpus covers Create contraption vs generic, watchdog (+follow-up), NBT, mixin init/conflict, duplicates, UCVE/LuckPerms, env lock, OOM, and a reviewed examplemod; forensics/config/corrupt-jar fixtures + preview API fallbacks; stub crash-report text for Logs/Crashes view
- **Guided tour** — short one-card-per-page walkthrough of the rail (Overview through Docs)

### Fixed

- **Roadmap page layout** — fixed situation bullet lists wrapping into a 6px column (vertical text mash)
- **Loading button spinner** — Scan and other loading buttons no longer orbit off-center (spinner rotate no longer fights centering `transform`); removed press-scale animation from buttons/icon buttons
- **Insights tooltips** — KPI / compare-card `?` help tips and hourly bar tips use a full-viewport float layer with solid backgrounds (no more clipped/collapsed tip boxes); bar tips sit above the cursor
- **Dashboard blank page** — Crashes “Find owning jar” used a regex literal with an unescaped `/`, which failed module parse and left the whole dashboard blank
- **Create crash overclaim** — “contraption collision” / assembly tips only when stack/exception evidence supports it; other Create runtime crashes get a generic Create narrative without inventing Flywheel or contraption causes

### Added

- **Roadmap share image** — neo-Frutiger Aero poster of the public roadmap (docs/assets/watchtower-roadmap.png + editable 
oadmap-poster.html)
- **Disable backup tracking** — Backups tab Step B **Not tracking** sets `BACKUP_TRACKING_ENABLED=false` (also via `POST /api/backups/external` `{ trackingEnabled: false }`); silences `BACKUP_*` Issues, Overview backup nudges, and folder poll; keeps folder paths for easy re-enable; Settings/Overview/wizard treat opt-out as satisfied
- **Declarative crash rule packs (1.0.18 / WT-035)** — YAML packs under `config/watchtower/rules/` + JAR `builtin-rules/`; strict predicate allowlist (rejects `exec`/JEXL/HTTP); Java classifier first, YAML after with `optional.crash_rule_hits[]`; issue suppressions via `ISSUE_SUPPRESSIONS` conf + `state.json`; HTTP `/api/rules*` + `/api/issues/suppress*`; CLI `watchtower rules validate|list`; Settings → Rules; Crashes/DR `rule_id` chip; auto-creates `config/watchtower/rules/` on setup; wiki Crash Rule Packs guide
- **Mod forensics foundations (1.0.17)** — `MOD_FORENSICS_SCAN` / `FORENSICS_CORRUPT_JAR_WALK` / `FORENSICS_INDEX_ON_REPORT` / `FORENSICS_STDERR_PATHS` conf flags; `ModForensicsCollector` status payload; authenticated `GET /api/mods/forensics/status` (master-off → `index.state=skipped`); `JarClassIndex` headless class/package scan with one-level nested jarjar + `watchtower/forensics-cache.json` mtime fingerprint cache; `POST /api/mods/forensics/find-class|find-package` (10/min rate limit) + CLI `watchtower forensics find-class|find-package`
- **Mod forensics scanners (1.0.17)** — log + optional zip `CORRUPTED_MOD_JAR`; L3 `config_health[]` (skips `defaultconfigs/`); stderr boot merge into `startup_profile`; UCVE owning-jar attribution via class index (cache load or `FORENSICS_INDEX_ON_REPORT`); Mods **Forensics** tab + Crashes **Find owning jar**; DR facts-only panel wired into Mods tab; CA-20 jdeps docs + offline `tools/jdeps-mod-scan.mjs`; HTTP-API forensics routes; fixtures harness `tools/test-forensics-parity.mjs`; status GET never jar-walks (`idle` when no cache yet; stale cache reported as-is)
- **DR CA parity (1.0.16)** — DR viewer ports `classifyMixinInit` / `classifyCaParity` (`mod_load_mixin`, `mod_load_mixin_conflict`, `mod_load_duplicate`, `mod_load_config`, `mod_load_asset`, `mod_load_worldgen`, `mod_load_compat`, `mod_load_ecosystem`, `platform_mismatch`, `env_lock` + OOM heap/native details); `modListGate.js` / `mixinConfigIndex.js`; FML banners + `known_pattern_hits`; narrator headlines; `samples/fixtures/ca-parity/expected.json` + parity harness asserts **17/17**
- **CA parity dashboard + brief (1.0.16)** — Crashes labels/fix plans for new failure kinds + mixin/config/ecosystem tech fields; Mods Connector hygiene chips + security banner; brief one-liner for CA crash kinds / denylist
- **CA parity foundations (1.0.16)** — `ModListGate` for mod-list early-return on crash rules (requires/forbids/missingAnyOf + Connector top-level or nested id detection); FML dependency/conflict banners → `fml_issues` with `mod_ids[]` + `known_pattern_hits[]` (rank-1 boot vs rank-2+ Issues-only; G-05 demotion preserved); jar `mixin_configs[]` + `MixinConfigIndex`; crash `ClassifyContext` + `mod_load_mixin` attribution (CA-01)
- **CA server parity rules (1.0.16)** — crash classifier emits `mod_load_mixin_conflict`, `mod_load_duplicate` (`duplicate_mod_ids[]` / `duplicate_jars[]`), `mod_load_config` (`config_path`), `mod_load_asset`, `mod_load_worldgen`, `mod_load_compat`, `mod_load_ecosystem`, `platform_mismatch`, `env_lock` (plus gated Create/Epic Fight/AzureLib/KubeJS + language-provider boot gate); `optional.connector_warnings[]`, `optional.security_flags[]` (irlandacore → `SECURITY_BACKDOOR_MOD`), and `optional.memory_diagnostics` (`page_file_disabled` / physical_mb / jvm_args when present) + `OOM_HEAP`|`OOM_NATIVE` tips without stealing Fix from watchdog or mod_runtime
- **Section spacing** — removed the extra 24px top padding on `.ui-section__header` (page stack gap owns vertical rhythm); Live chart cards no longer double-pad; Live/Startup stack gaps tightened
- **Live System temps** — System section is temps only (no per-core bars / duplicate disk-net-heap tiles): two hero dials (CPU package + Ambient) with temp history charts underneath; `/api/samples` adds `thermal_package` / `thermal_ambient` series
- **Live chart window + sections** — Live charts pin their X axis to the selected time window (temp dials included, taller history); window picker is **15m / 1h / 3h / 6h / 12h / 24h / 7d / 30d** with immediate samples refetch; Game / Host / Host temperatures / Pregen / Alerts sections are collapsible (remembered in localStorage)
- **Live tab polish** — rebuilt top toolbar (status + live TPS/MSPT/players chips + window/poll/pin controls); chart sections use page Sections with tighter padding; glass thermal tiles
- **Inbox popover opacity** — topbar inbox menu uses an opaque surface so content behind no longer shows through
- **Startup page polish** — boot hero (time + status + vs-last / warnings / errors), phase cards with share % and slowest rank, side-by-side warnings/errors, glass styling; removed duplicate Slowest list; tighter section/hero/phase padding (no double header top gap)
- **Issues acknowledge + Reviewed tab** — Mark reviewed / Undo / Mark all reviewed on Issues cards (lag, mod peek, log-stale, backup, Modrinth updates, report findings); persists in `acknowledged_issues` via `GET/POST /api/issues/acks|ack|acknowledge-all`; Active vs Reviewed subnav; crash cards still use crash ack-all; dismissing a Modrinth inbox nudge also marks the Issues card reviewed
- **Insights hourly bar tooltips** — Hourly averages (UTC) bars show an instant hover/focus tip and live readout (hour range, MSPT/TPS, avg players, sample minutes); hovered bar highlights and dims the rest
- **Neo-Frutiger Aero UI (1.0.15)** — sky/aqua glass surfaces for light, dark, and black themes; mesh canvas gradients; cards/metrics/list rows use top sheen and soft tone washes (**no left accent bars** — including Overview vitals); scarce coral CTAs; hover lift; glass topbar/modals/toasts; feature cards, Live charts, Logs panes, Settings, and wizard panels share the same glass treatment
- **Run Report stage progress (1.0.15)** — report pipeline emits coarse stages (`window` → `collect` → `analyze` → `enrich` → `write` → `finalize`); `GET /api/reports/status` returns `stage` / `stage_label` while running; Run Report modal stays open with a glass stage checklist (done / active / pending) instead of closing on start; fixture preview simulates the same sequence
- **Backups setup (1.0.15)** — **Backups** tab is the primary setup surface: Step A folder picker (`PathField` + `/api/fs/*` browse, save via `POST /api/backups/dirs`, never prefills guessed paths); Step B panel/cloud guide with tracking mode (folder / heartbeat / both), marker `PathField`, webhook copy + test; Settings → Backups is a thin status mirror with link; setup wizard points to Backups tab with no silent defaults; empty states distinguish cloud-only vs disk folder inventory
- **Modrinth identity + update hints** — when opt-in Modrinth lookup runs on a full report, jar SHA-512 results now write `modrinth_slug` / `modrinth_url` / version deep-links onto `optional.mods[]`; crash suspects are included; compatible NeoForge/MC version checks set `modrinth_outdated` + `optional.modrinth_updates[]` (inbox + Issues soon items). Crashes CTAs prefer compatible-update URLs; Create/Flywheel pair links included. **Never downloads jars.**
- **Crashes page rebuild (1.0.14)** — resolution-first UX: fingerprint group list → detail with numbered **Do this now** steps, Modrinth / Mods / Copy / Mark-group CTAs, deep-link `?tab=crashes&group=`, Mark all reviewed, and plain-English empty states; helper `domain/crash-fix.js`
- **Inbox bell (1.0.14)** — topbar notification popover wired to `GET /api/inbox` / dismiss (crash groups + update nudges)
- **Crash inbox foundations (1.0.14)** — `IncidentChainBuilder` (G-11 pairing), `CrashFingerprintGrouper` (G-12 fingerprint groups, ≤12 cap), crash-inbox fixtures, and StateManager helpers for inbox dismissals / ack-all / acknowledged groups
- **Crash inbox HTTP (1.0.14)** — `GET /api/crashes` (grouped), `POST /api/crashes/acknowledge-all`, `GET /api/inbox` + `POST /api/inbox/dismiss`; dashboard `crashesGrouped` / `crashesAcknowledgeAll` / `inboxGet` / `inboxDismiss` + `acks` store wiring
- **Crash intelligence v2 (1.0.13)** — parser/classifier emit `failure_kind`, `primary_mod_id`, `stall_mod_id`, and `watchdog_tick_ms` (seconds → ms, including corrupt counters); NeoForge `TRANSFORMER/mod@version` stack attribution; Crashes tab badges for kind / Stall / Suspect / hang duration / confidence / `mod_file`
- **Narrative reconciliation (1.0.13)** — boot-window mod warnings demoted after `Done!` when a runtime crash is present (Fix tab cites the active stall/crash, not unrelated boot hygiene like Pride)
- **Startup boot profile (1.0.13)** — `optional.startup_profile` (total boot time, phases, slowest, warnings, blocking vs non-blocking errors, compare-to-last-boot); new **Startup** Monitor tab; Overview boot card links to Startup; brief one-liner
- **FML + mod-error categories (1.0.13)** — multi-block `-- Mod loading issue --` → `optional.fml_issues[]`; Create / KubeJS / AE2 / MISSING migration categories in mod log intelligence
- **DR crash intelligence parity (1.0.13)** — DR viewer ports for `failure_kind` narratives, boot-hygiene reconcile, FML multi-issue parse, startup profile, squaremap/BlueMap `map_render`; golden fixtures + `tools/test-crash-intel-parity.mjs` / `CrashIntelGoldenTest`
- **Local corpus gate (1.0.13)** — `tools/audit-crash-intel-1013.mjs` against available `fixtures/crashlogs` (147 files): unknown **0%** on non-empty reports (gate &lt;10%), watchdog duration **62/62**, runtime `primary_mod_id` **60/60** (&gt;90%), Create NPE→watchdog `incident_id` pairing verified; legacy stub harness still reports ~41% unknown (pre-1.0.13 logic)
- **Mod intelligence v2** — smarter client-only scoring: Create/Flywheel/Registrate (and Create-ecosystem dependents) never suggested for removal; Xaero map mods marked uncertain with honest hybrid copy; Mods **Dependencies** tree (`GET /api/mods/tree`); opt-in Modrinth SHA-512 side lookup (off by default, cached under `watchtower/modrinth-cache.json`); MCreator / Fabric-jar informational badges; Client-only tab reads report scores; DR viewer Layer-1 parity
- **DR mod side scoring parity** — Layer-1 client-only mod scoring (Create protection, hybrid Xaero uncertain, ignored list) ported into the DR viewer analyzer with a shared golden fixture and JS/Java parity tests
- **Logs tab** — dedicated viewer for server logs (`latest.log`, `debug.log`, rotated `*.log.gz`) and crash report files: file list, searchable monospace tail, copy/download, and line-count controls; backed by `/api/logs/list` and `/api/logs/content` (Crashes tab unchanged for triage/review)

### Fixed

- **Roadmap page layout** — fixed situation bullet lists wrapping into a 6px column (vertical text mash)
- **CA parity ship polish (1.0.16)** — Crashes tech panel shows `duplicate_mod_ids` / `duplicate_jars` / `locked_path` / `oom_kind` / `java_mismatch`; fix headlines for asset/dependency/worldgen/compat/script; CA-06 `mod_load_dependency` narrator + brief one-liner; SERVER TOML log lines classify as `server_config_corrupt` (Java + DR advisor); tests cover unresolved mixin conflict, vanilla `UnsupportedClassVersionError` suppression, and `memory_diagnostics` enrichment from native OOM fixtures
- **Live MSPT chart scale** — Y-axis no longer caps at 100 ms; range grows with the series peak (and warn threshold) so heavy lag no longer draws off-chart ([#1](https://github.com/djinnbanter/WatchTower/issues/1))
- **GriefLogger / protobuf JPMS clash** — shade and relocate `protobuf-javalite` into `watchtower-core` as `dev.mcstatus.watchtower.core.internal.protobuf` so health reports can parse Spark profiles when another mod (e.g. GriefLogger via MySQL Connector/J) owns `com.google.protobuf` on the module path; Spark collect also degrades with a warning on `LinkageError` instead of aborting the whole report ([#2](https://github.com/djinnbanter/WatchTower/issues/2))
- **Overview Vitals** — counter-only cards in a single top row (TPS, MSPT, heap, players, CPU, RAM, disk); sparklines and the Vitals section block removed — use Live for charts; cards share equal height in the row
- **Overview Host CPU flicker** — vitals no longer show/hide Host CPU (and other extras) when load crosses the warn threshold; available metrics stay mounted
- **Docs article sidebar** — wiki layout no longer uses negative page margins outside `.ui-page`, so the nav isn’t clipped off-screen; sidebar and article scroll independently within the shell
- **Live / Overview trend charts** — uPlot series used unresolved CSS variables (and a nonexistent `--ui-positive`), so lines were invisible; hover updated React state and destroyed/recreated charts every mouse move (flicker + lag); 1h windows dropped stale fixture history. Charts now resolve canvas colors from tokens, update legends via DOM (no remount on hover), join samples by timestamp with downsample, and fall back to available history when a window is empty. Preview fixtures rebase timestamps to now and keep a continuous simulator window.

### Changed

- **Internal docs** — architecture/implementation/storage plan for 1.1.35 diagnostics contribute (docs/dev/roadmap/studies/DIAGNOSTICS-CONTRIBUTE-1135.md)
- **Internal roadmap** — detailed plan for **1.1.35** anonymous diagnostics contribution (opt-in, post-report, 24h cooldown, full redacted crash+logs+facts)
- **Roadmap page** — rebuilt to match the share poster: legend strip, works-today grid, situation panels, later / not-our-job / promises row
- **Crash fix copy (1.0.14)** — CrashNarrator / classifier hints prefer imperative steps (Pause Chunky, Update Create on Modrinth); Issues badge and action queue use `unreviewed_groups` (“N crash groups need review”)

### Changed

- **Internal docs** — architecture/implementation/storage plan for 1.1.35 diagnostics contribute (docs/dev/roadmap/studies/DIAGNOSTICS-CONTRIBUTE-1135.md)
- **Internal roadmap** — detailed plan for **1.1.35** anonymous diagnostics contribution (opt-in, post-report, 24h cooldown, full redacted crash+logs+facts)
- **Roadmap page** — rebuilt to match the share poster: legend strip, works-today grid, situation panels, later / not-our-job / promises row
- **Docs (1.0.16)** — HTTP API `failure_kind` list includes CA parity kinds (`mod_load_mixin*`, `mod_load_config`, `platform_mismatch`, `env_lock`, …)
- **Docs (Modrinth)** — Settings, Installation privacy, and Dashboard Tabs clarify that opt-in lookup powers Crashes links and update hints, and never downloads jars
- **Docs (1.0.14)** — wiki Crashes tab / public roadmap describe resolution-first groups, Modrinth CTAs, mark-all, and inbox bell; HTTP API lists grouped crashes + inbox endpoints
- **Modrinth lookup UX** — Settings → Monitoring now explains when Modrinth runs (full report only), what is sent (jar SHA-512, no API key), where results appear (`modrinth:…` chips), and that preview mode will not change fixture scores; Client-only hint links to the setting
- **Sidebar report controls restored** — Run Report, report history selector, and Download support bundle live in the rail (compact icons when collapsed); Overview page header no longer duplicates Run Report
- **Old UI richness restored into Lantern** — reusable Gauge/RadarDial, BarMeter/HourBars, StatusPill, BeaconCard, DualMetricTile; Overview status pills + health trio + dual vitals + pregen radars + resource bars; Live thermal dials, per-core CPU, Game/Host chart sections; Insights hour bars + correlations + related events; richer Issues/Crashes/Spark/Session/Activity/Backups surfaces (without restoring legacy `tower/` chrome)
- **Triage pages richer** — Issues summary strip (BeaconCard + MetricTiles), Crashes KPIs as MetricTiles with Sparkline/Timeline in pre-crash context, Spark verdict HealthGrade and mod CPU BarMeters
- **Insights Patterns — week-over-week restored** — full 8-KPI summary grid (sample minutes, TPS, MSPT p95, low-TPS, players, sticky, outliers, related events) plus Prior/Now period-compare cards from `period_compare` (Week over week / Month over month)
- **Lantern visual polish** — premium dark-ops look: deeper surface ladder, warm coral accent (scarcer), resting/lifted elevation, stronger page/metric type hierarchy, recessed chart wells, signature status strips, richer Overview hero, glass topbar, and softer list/KPI cards (inspired by old wow without restoring legacy layout)
- **Insights Storage tab** — shows what’s using space (world / mods / logs / other), by-dimension breakdown with share bars, and disk-jump comparison — not just four KPIs
- **Overview storage & pregen restored** — Storage again shows disk use, by-dimension breakdown, disk-jump and RSS hints; World background jobs card returns Chunky / Distant Horizons pregen progress (chunks, rate, ETA)
- **Overview adaptive layout** — status strip + hero stay first; when healthy, vitals lead (no empty “All clear” block); when unhealthy, Needs attention (top 3 + link to Issues) and Right now lead with compact vitals beside; lag incidents collapse by default; insight/storage sit below
- **Docs hub rebuild** — journey-based Docs home (search, Get started / Learn / Ops / Reference); article renderer restores GFM tables, checklists, wiki-link slugs, and callouts; per-page Lantern diagram widgets remade (data-sources flow, rail map, DR pipeline, etc.); article chrome with back link and prev/next
- **Section header padding** — more space above section titles so they don’t crowd the block above; hairline-to-body spacing kept tight
- **Wide-screen density** — layouts gain columns and side-by-side panes on large viewports instead of stretching a single column: Live charts 3/4-col, Overview triage|vitals split, Activity KPI sidebar, Insights patterns two-pane, Issues secondary 2-col, Crashes 2-col cards, Backups status|inventory, Mods conflict cards 2-col, Settings capped form width with wider nav, Docs/Help denser grids
- **Full-width desktop layout** — page content fills the shell column (removed 1400px left-capped max-width); Settings uses full page width; wider horizontal padding on ≥1600px viewports
- **Live chart resize** — uPlot no longer fights `width: 100% !important`; TimeSeries measures the plot container, coalesces resize with rAF, and syncs size after create so axis labels stay aligned when the window or rail changes
- **Cross-page list chrome** — ListRow rows get bordered tone-accent cards (Overview/Live alerts, Insights takeaways, Mods conflicts); Spark narrative lists use the same pattern; webhook/recovery/pre-crash lists styled; invalid `--ui-sp-10` spacing tokens replaced
- **Activity page chrome** — summary KPIs are tone-accented cards with icons; event timeline rows are bordered cards with category badges, type meta, day counts, and severity-tinted left borders (no longer a flat text list); fixed invalid `--ui-sp-14` padding so KPI/event cards actually have breathing room, with clearer gaps between rows and day groups
- **Dashboard spacing rhythm** — unified page padding/gaps, section and list spacing, chart/status-strip chrome, and feature toolbars so tabs no longer stack uneven margins; crash Fix steps box uses valid spacing tokens (was broken via nonexistent `--ui-sp-14`)
- **Lantern UX — color, guidance & control center** — warmer surfaces and accent wash; larger page/section titles; Overview hero + status strip + first-run CTAs; tables as bordered panels; Live charts pinned from 0 with fills; Issues/Crashes show numbered fix steps; Mods Conflicts shows real compat issues (jar diff → Changes); Help merged into Docs hub; Settings/Docs restyled to match other pages
- **Preview mock data realism** — live samples, bandwidth/disk I/O, rollups, and the fixture simulator now share correlated server physics (diurnal players, MSPT↔TPS, heap GC sawtooth, save spikes, sticky idle lag) instead of independent sine waves
- **Live charts — one metric per plot** — TPS, MSPT, heap, CPU, RAM, players, disk, RX, TX, disk read, and disk write each get their own chart (no dual-axis / shared series); arranged in a responsive 2-column grid
- **Live / Overview chart chrome** — chart frames use a subtle plot surface, always-visible last-value legend, thicker series strokes, TPS/MSPT warn guides, and a tighter Live status strip with live pulse on the connection dot
- **Dashboard UI rebuilt (Lantern)** — full rip-and-replace of the operator dashboard front-end with a new modular design system and reactive app:
  - Framework layers: `--ui-*` design tokens (dark / light / black themes), primitives, shared patterns, feature pages
  - Stack: vendored Preact + HTM + `@preact/signals` + uPlot (native ES modules, no bundler); self-hosted IBM Plex Sans/Mono
  - Nav: collapsible rail (Monitor / Triage / Ops / System) + Ctrl/Cmd+K command palette (pages, actions, settings, wiki)
  - Capability parity: Overview, Live, Insights, Session, Issues, Crashes, Spark, Mods, Backups, Activity, Sources, Docs, Settings (General / Monitoring / Backups / Security / About), Help + guided tour, setup wizard, auth gates
  - Live updates via signal stores + poll scheduler (no full-page remount flicker); three-layer freshness honesty (Live / Scanned / Report) on every tab
  - Motion catalog with `prefers-reduced-motion` fallbacks; typeahead Combobox/PathField for ops inputs
  - Preview: `npm run preview`; embedded JAR sync via Gradle `buildDashboardAssets` / `syncDashboard`

### Removed

- **Legacy dashboard UI** — `tower/`, `css/v3/`, root classic scripts (`app.js`, Chart.js/Lucide vendors, `wiki-bundle.js`, etc.) are gone; shipped path is `src/` + Lantern `styles.css` only

## [1.0.0a](https://github.com/djinnbanter/WatchTower/compare/v1.0.0...v1.0.0a) — 2026-06-28

Hotfix build. Artifacts: `watchtower-neoforge-1.0.0a+mc1.21.jar` · `watchtower-cli-1.0.0a.jar` in `releases/1.0.0a/` and `releases/latest/`.

### Fixed

- **Roadmap page layout** — fixed situation bullet lists wrapping into a 6px column (vertical text mash)
- **Mod load crash alongside spark** — the bundled `watchtower-core` library generated its protobuf classes into spark's `me.lucko.spark.proto` package, so installing Watchtower next to the standalone **spark** mod failed at startup with `ResolutionException: Modules dev.mcstatus.watchtower.core and spark export package me.lucko.spark.proto`. The generated classes are now relocated to `dev.mcstatus.watchtower.core.spark.proto`, removing the split-package collision (wire format is unchanged)
- **2FA login** — fix `/api/auth/totp` rejecting valid codes with “Authenticator code required” (session gate now allows pending 2FA verification) — preview build now runs the same CSS, wiki, and mock-data steps as Gradle; `verifyModJar` checks all shipped dashboard assets; embedded mode uses `data-embedded` only; settings, scan buttons, exports, and wizard chrome match between preview and live; mock fixtures include server icon, crash pre-context, and dynamic report index timestamps (`PREVIEW_PROFILE=fresh` for empty-install demo)
- **Setup wizard (embedded dashboard)** — include `setup-wizard.css` in the CSS build so the wizard is styled in the mod JAR (not only in dev preview); serve all dashboard static assets from one path map; inject `data-embedded="true"` when serving `index.html` so API mode works on non-default ports
- **Initial audit scan** — show Retry / Skip / Continue in background when the baseline report fails, times out, or is already running; expose `report_timeout_minutes` in `/api/config` for client-side poll limits

### Added

- **Roadmap share image** — neo-Frutiger Aero poster of the public roadmap (docs/assets/watchtower-roadmap.png + editable 
oadmap-poster.html)
- **`tools/audit-dashboard-parity.mjs`** — CI guard for CSS module coverage, setup-wizard styles, and embedded detection

### Documentation

- **Docs and wiki audit (1.0.0)** — fixed setup wizard vs welcome-screen copy, Settings → Security paths, HTTP API (Insights tab, Spark + onboarding endpoints), README feature table, contributor version refs; DR viewer early-preview caveat; added `tools/audit-docs.mjs` CI check
- **Backups tab** — fixed broken world-storage card HTML that could break the Backups page layout
- **README** — Screenshots and Sources sections with dashboard captures from `docs/assets/screenshots/`

## [1.0.0](https://github.com/djinnbanter/WatchTower/releases/tag/v1.0.0) — 2026-06-24

First public release for **NeoForge 1.21.x** on Linux dedicated servers — live ops dashboard, scheduled health reports, disaster recovery, Spark profiler integration, setup wizard, and in-app documentation.

**Artifacts:** `watchtower-neoforge-1.0.0+mc1.21.jar` · `watchtower-cli-1.0.0.jar` in `releases/1.0.0/` and `releases/latest/`

**Platform:** NeoForge loader range `[1.21.1,1.22)` — one mod JAR for Minecraft **1.21.1** through latest **1.21.x** patch. **License:** GPL-3.0-or-later ([LICENSE](LICENSE)).

### Added — Health reports & commands

- Rule-based health engine — structured **facts** (JSON) and human-readable **brief** (text)
- Host metrics — CPU, memory, disk, uptime, thermal sensors (when available), network bandwidth
- Log and crash analysis — tick lag, OOM signals, mod load errors, recipe/registry issues, timeline of notable events
- Panel-aware collection — Crafty, Pterodactyl, AMP, bloom, and other common hosting layouts where detectable
- Incremental reports with persistent state under `watchtower/`
- In-game commands — `/watchtower run`, `brief`, `status`, `issues`, `schedule`, `diagnostics`, `url`, `pin`
- Scheduled reports — wall-clock default **00:00** and **12:00** server local time; configurable from Settings or `/watchtower schedule`
- Report retention — auto-prune old facts+brief pairs (`REPORT_RETENTION_COUNT` default 30, `REPORT_RETENTION_DAYS` default 90)
- Trust scorecard on Overview; CLI `report --preset` for headless runs

### Added — Live dashboard

- Live TPS, MSPT, players, heap, host CPU/RAM/disk sampled every second; 90-day retention tiering
- Embedded web dashboard at `http://<server>:8787` — Overview, Live, Insights, Issues, Crashes, Mods, Backups, Activity, Session, Spark, Sources
- Minute-by-minute **performance history** (`performance-rollups.json`) with L0 backfill on upgrade
- **Performance insights** — busy/quiet hours, lag-vs-players correlation, outlier minutes, sticky lag, CSV export, Insights tab heatmaps
- Per-core CPU on Live, dimension storage breakdown, disk I/O card, RSS vs heap hint
- RAM charts plot **used** GB (not free) where host metrics exist; linked **1h / 6h / 24h** vitals range on Overview and Live; full time-range picker on Live (1 min through 90 days)
- Always-on background ops scan (`OPS_LOG_SCAN_SEC`, default 60s) — unified log tail, mod log errors, crash folder, log-stale detection, running mod list, activity ledger, lag spike capture with auto incident files
- Live **Right now** alert feed; Overview **Server health** peek; `GET /api/issues/peek` for live lag and mod issues
- Mod JAR inventory diff between reports; host disk jump detection; tech-mod log hints (Create, KubeJS, AE2)
- Chunky pregen detection; backup-running and restart-soon warnings from log tail; optional backup-folder slow poll (`BACKUP_POLL_MIN`)
- Session ops roster — peak concurrent, unique players, recent sessions, 24h player sparkline, roster search/sort, copy UUID
- **Live / Scanned / Report / Mixed** badges on major cards; tab subtitles and footers; dedicated **Sources** tab with freshness matrix
- **Docs** tab (Admin rail) — bundled operator wiki with category nav, search, rich page widgets, URL persistence, and ⌘K doc search
- **Setup wizard** — unified first-run flow with initial audit scan, backup discovery, scheduled reports, optional security; resume card on Overview; `?setup=1` deep link; Help → Run setup wizard again
- `POST /api/onboarding/audit` for fast discovery scans during setup
- Version chip in nav with **up to date** / **update available** states; global update banner via `GET /api/update/check`
- Cgroup CPU/RAM labels on hosted panels; environment banner and per-metric trust badges
- Support bundle export; report freshness indicators; smart disk/backup nudge; uptime card
- Run reports from the dashboard; change lookback, incremental mode, and schedule without a restart
- Crash review workflow — acknowledge crashes, pre-crash context (TPS, commands, chunk gen), plain-English narratives
- Mod health — full mod list, log-error attribution, update-conflict guidance, client-mod detection, broken-mod fix steps
- Backup visibility — folder picker, inventory table, panel-specific hints; external backup heartbeat (marker file + webhook) for S3/panel/k8up hosts
- **Settings → Backups** — 2-step fast track for panel backups with plain-language copy and test heartbeat
- Help hub — in-app guide, optional guided tour (Settings → About), security settings

### Added — Spark profiler

- Reads `.sparkprofile` (and optional `.sparkheap`) on report run and on demand via API
- **Spark tab** — 3-step workflow (capture → pick → view); five sub-tabs (Summary · Mods & code · World · Capture window · Advanced)
- `GET /api/spark/profiles` and `GET /api/spark/profile?path=…`
- Verdict, mod usage, hot methods, world/chunk pressure, recommendations, capture metadata, JVM/config snapshot
- Fresh profiles surface in `brief.txt`, Overview TLDR, and MSPT capture marker; Spark viewer links

### Added — Dashboard security

- Username and password login; default `watchtower` / `password` (forced change on first login)
- Optional TOTP two-factor authentication with recovery codes
- HttpOnly session cookies, login rate limiting, security headers, exposure warning when bound to `0.0.0.0`
- Operator recovery via `/watchtower dashboard reset-password` (OP level 4)

### Added — Disaster recovery

- **`watchtower-cli`** — run from the server `mods/` folder when the game will not start; outputs **`watchtower-dr-bundle-*.zip`**
- Bundle includes facts, brief, and logs from the lookback window; mod-set change detection between last good start and failure
- Browser-based **DR viewer** — upload a bundle zip for a fix-first crisis UI (Fix, Attempts, Logs, Mods, Report)
- `watchtower/DR-README.txt` written after each successful in-game report with emergency CLI steps

### Added — Documentation

- **GitHub Wiki** — primary operator documentation (`docs/wiki/` source; publish with `node tools/sync-wiki.mjs --push`)
- Main [README](README.md) — quick start and wiki index
- Plain-English Help and Docs copy for non-technical server owners

### Changed

- **Internal docs** — architecture/implementation/storage plan for 1.1.35 diagnostics contribute (docs/dev/roadmap/studies/DIAGNOSTICS-CONTRIBUTE-1135.md)
- **Internal roadmap** — detailed plan for **1.1.35** anonymous diagnostics contribution (opt-in, post-report, 24h cooldown, full redacted crash+logs+facts)
- **Roadmap page** — rebuilt to match the share poster: legend strip, works-today grid, situation panels, later / not-our-job / promises row
- Mod release filename **`watchtower-neoforge-<version>+mc1.21.jar`** for NeoForge 1.21.x line
- Live chart polish — gradient fills, live-end dot, TPS/MSPT/heap threshold guides, crosshair, touch scrubbing, loading shimmer, stable downsampling, debounced resize
- Hub UI cohesion — Settings, Help, and Docs use shared hub shell; unified side-nav styling
- Operational tab motion — card stagger, KPI count-ups, scroll reveals across Monitor/Triage/Ops tabs
- Guided tour no longer auto-starts on load — start from Settings → About when wanted
- Docs clarify that **`watchtower-cli-*.jar` may live in `mods/`** alongside the mod (not loaded by NeoForge; recommended for DR)

### Fixed

- **Roadmap page layout** — fixed situation bullet lists wrapping into a 6px column (vertical text mash)
- NeoForge mod JAR embeds the TOTP library (and QR/transitive deps) via jarJar — fixes boot crash with `NoClassDefFoundError` when the dashboard is enabled
- Dashboard login screen no longer hidden behind the boot overlay; auth gate appears on first visit
- Default dashboard password is `password` (username `watchtower`); legacy random-password accounts aligned on server start
- Live and Overview charts were blank because CSP blocked CDN Chart.js — Chart.js and Lucide are now bundled locally
- Long lookback windows (7d–90d) no longer lag the dashboard — server-side `max_points` cap, scaled polling, tail append from `/api/live`
- False **Panel: Down** on bloom/Ptero-style containers when the panel daemon runs outside the game JVM
- Misleading Overview **Memory** vital on containers (host `mem_available_gb` demoted; heap headroom promoted)
- Setup wizard infinite recursion in legacy migration that could freeze dashboard on “Initializing…”
- Spark profile dropdown refresh after async profile list load
- Issues tab render after UI cohesion pass

### Documentation

- Version reset to **1.0.0** for first public go-live — consolidated changelog, roadmap, wiki, and README; future work renumbered from **1.0.1**

### Tests

- `ReportRetentionPolicyTest` — retention intersection, brief pair deletion, facts listing order
- Spark fixture audit — `gradlew :watchtower-core:sparkAuditFixtures`
