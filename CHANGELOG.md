# Changelog

All notable **user-facing** changes to Watchtower are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

**Maintainers:** detailed planning and changelog notes may live in local `docs/dev/` (gitignored, not on GitHub).

## [Unreleased](https://github.com/djinnbanter/WatchTower/compare/v1.0.0...HEAD)

### Fixed

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
