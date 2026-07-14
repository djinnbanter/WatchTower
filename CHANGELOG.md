# Changelog

All notable **user-facing** changes to Watchtower are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

**Maintainers:** detailed planning and changelog notes may live in local `docs/dev/` (gitignored, not on GitHub).

## [Unreleased](https://github.com/djinnbanter/WatchTower/compare/v1.1.0...HEAD)

### Changed

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

### Fixed

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

### Changed

- **Support bundle** — includes `ops-cache.json` when present (scan aggregates such as `mod_log_errors` / `mod_issues`) so live scan rows are debuggable
- **Run Report progress detail** — checklist shows step N/M, elapsed time, and live sub-step text (e.g. “Scanning server logs…”) so long Collect stages look alive
- **First-login account setup** — password-change gate now also requires a new username (not the default `watchtower`)

### Added

- **Login default credentials hint** — sign-in screen shows default `watchtower` / `password` with a reminder to change it

## [1.1.0](https://github.com/djinnbanter/WatchTower/compare/v1.0.0a...v1.1.0) — 2026-07-13

Artifacts: `watchtower-neoforge-1.1.0+mc1.21.jar` · `watchtower-cli-1.1.0.jar` in `releases/1.1.0/` and `releases/latest/`.

### Changed

- **Dashboard readability polish** — bumped floor type scale (12/13/14px), tokenized feature hints, larger empty-state copy, denser nested Insights subnav, Crashes/Spark on shared `Page` chrome; Logs empty states show body text again
- **Overview welcome** — personalized band with username, server hostname (and panel label), plus a short live status summary before vitals
- **Session roster** — single full-width composition (vitals → top-playtime chips → directory); status as a tone dot instead of a fat badge beside the name; default sort online-first
- **Insights Patterns** — split into Overview / Schedule / Load / Incidents sub-panels (`?panel=`); Schedule adds TPS and players hour-of-week heatmaps (plus players hourly bars) alongside MSPT
- **Setup wizard (first-time experience)** — live discovery audit via `POST /api/onboarding/audit` (with `backup_configured` / `has_facts_report` / `schedule_summary`); optional non-blocking 30-day baseline with report stage progress; actionable Backups / schedule / Security steps (Backups no longer auto-completes the wizard); Docs **Run again** and `?setup=1` relaunch correctly; Overview resume chip for unfinished setup / baseline / missing backups
- **Crash fix advice (evidence-first)** — Create contraption crashes lead with stop/break the stuck assembly (not Flywheel); Create↔Flywheel pairing only with evidence; watchdog/OOM/env-lock/UCVE/NBT/loader tips reordered to match real operator playbooks; dashboard “Do this now” headlines no longer default to “Update {mod}”
- **Dashboard preview mocks** — crash corpus covers Create contraption vs generic, watchdog (+follow-up), NBT, mixin init/conflict, duplicates, UCVE/LuckPerms, env lock, OOM, and a reviewed examplemod; forensics/config/corrupt-jar fixtures + preview API fallbacks; stub crash-report text for Logs/Crashes view
- **Guided tour** — short one-card-per-page walkthrough of the rail (Overview through Docs)

### Fixed

- **Loading button spinner** — Scan and other loading buttons no longer orbit off-center (spinner rotate no longer fights centering `transform`); removed press-scale animation from buttons/icon buttons
- **Insights tooltips** — KPI / compare-card `?` help tips and hourly bar tips use a full-viewport float layer with solid backgrounds (no more clipped/collapsed tip boxes); bar tips sit above the cursor
- **Dashboard blank page** — Crashes “Find owning jar” used a regex literal with an unescaped `/`, which failed module parse and left the whole dashboard blank
- **Create crash overclaim** — “contraption collision” / assembly tips only when stack/exception evidence supports it; other Create runtime crashes get a generic Create narrative without inventing Flywheel or contraption causes

### Added

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

- **CA parity ship polish (1.0.16)** — Crashes tech panel shows `duplicate_mod_ids` / `duplicate_jars` / `locked_path` / `oom_kind` / `java_mismatch`; fix headlines for asset/dependency/worldgen/compat/script; CA-06 `mod_load_dependency` narrator + brief one-liner; SERVER TOML log lines classify as `server_config_corrupt` (Java + DR advisor); tests cover unresolved mixin conflict, vanilla `UnsupportedClassVersionError` suppression, and `memory_diagnostics` enrichment from native OOM fixtures
- **Live MSPT chart scale** — Y-axis no longer caps at 100 ms; range grows with the series peak (and warn threshold) so heavy lag no longer draws off-chart ([#1](https://github.com/djinnbanter/WatchTower/issues/1))
- **GriefLogger / protobuf JPMS clash** — shade and relocate `protobuf-javalite` into `watchtower-core` as `dev.mcstatus.watchtower.core.internal.protobuf` so health reports can parse Spark profiles when another mod (e.g. GriefLogger via MySQL Connector/J) owns `com.google.protobuf` on the module path; Spark collect also degrades with a warning on `LinkageError` instead of aborting the whole report ([#2](https://github.com/djinnbanter/WatchTower/issues/2))
- **Overview Vitals** — counter-only cards in a single top row (TPS, MSPT, heap, players, CPU, RAM, disk); sparklines and the Vitals section block removed — use Live for charts; cards share equal height in the row
- **Overview Host CPU flicker** — vitals no longer show/hide Host CPU (and other extras) when load crosses the warn threshold; available metrics stay mounted
- **Docs article sidebar** — wiki layout no longer uses negative page margins outside `.ui-page`, so the nav isn’t clipped off-screen; sidebar and article scroll independently within the shell
- **Live / Overview trend charts** — uPlot series used unresolved CSS variables (and a nonexistent `--ui-positive`), so lines were invisible; hover updated React state and destroyed/recreated charts every mouse move (flicker + lag); 1h windows dropped stale fixture history. Charts now resolve canvas colors from tokens, update legends via DOM (no remount on hover), join samples by timestamp with downsample, and fall back to available history when a window is empty. Preview fixtures rebase timestamps to now and keep a continuous simulator window.

### Changed

- **Crash fix copy (1.0.14)** — CrashNarrator / classifier hints prefer imperative steps (Pause Chunky, Update Create on Modrinth); Issues badge and action queue use `unreviewed_groups` (“N crash groups need review”)

### Changed

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

- **Mod load crash alongside spark** — the bundled `watchtower-core` library generated its protobuf classes into spark's `me.lucko.spark.proto` package, so installing Watchtower next to the standalone **spark** mod failed at startup with `ResolutionException: Modules dev.mcstatus.watchtower.core and spark export package me.lucko.spark.proto`. The generated classes are now relocated to `dev.mcstatus.watchtower.core.spark.proto`, removing the split-package collision (wire format is unchanged)
- **2FA login** — fix `/api/auth/totp` rejecting valid codes with “Authenticator code required” (session gate now allows pending 2FA verification) — preview build now runs the same CSS, wiki, and mock-data steps as Gradle; `verifyModJar` checks all shipped dashboard assets; embedded mode uses `data-embedded` only; settings, scan buttons, exports, and wizard chrome match between preview and live; mock fixtures include server icon, crash pre-context, and dynamic report index timestamps (`PREVIEW_PROFILE=fresh` for empty-install demo)
- **Setup wizard (embedded dashboard)** — include `setup-wizard.css` in the CSS build so the wizard is styled in the mod JAR (not only in dev preview); serve all dashboard static assets from one path map; inject `data-embedded="true"` when serving `index.html` so API mode works on non-default ports
- **Initial audit scan** — show Retry / Skip / Continue in background when the baseline report fails, times out, or is already running; expose `report_timeout_minutes` in `/api/config` for client-side poll limits

### Added

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

- Mod release filename **`watchtower-neoforge-<version>+mc1.21.jar`** for NeoForge 1.21.x line
- Live chart polish — gradient fills, live-end dot, TPS/MSPT/heap threshold guides, crosshair, touch scrubbing, loading shimmer, stable downsampling, debounced resize
- Hub UI cohesion — Settings, Help, and Docs use shared hub shell; unified side-nav styling
- Operational tab motion — card stagger, KPI count-ups, scroll reveals across Monitor/Triage/Ops tabs
- Guided tour no longer auto-starts on load — start from Settings → About when wanted
- Docs clarify that **`watchtower-cli-*.jar` may live in `mods/`** alongside the mod (not loaded by NeoForge; recommended for DR)

### Fixed

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
