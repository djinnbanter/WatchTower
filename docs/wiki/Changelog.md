# Changelog

**What changed in each Watchtower version** — new features and fixes that affect you as a server owner.

Full downloads: [GitHub Releases](https://github.com/djinnbanter/WatchTower/releases) · Maintainer copy: [CHANGELOG.md](https://github.com/djinnbanter/WatchTower/blob/main/CHANGELOG.md)

---

## Unreleased

_(empty)_

## [1.2.0-beta.1] — 2026-08-02

**Artifacts:** `watchtower-neoforge-1.2.0-beta.1+mc1.21.jar` · `watchtower-cli-1.2.0-beta.1.jar`

Release: [v1.2.0-beta.1](https://github.com/djinnbanter/WatchTower/releases/tag/v1.2.0-beta.1) (**pre-release / beta**)

> **Beta:** expect rough edges. Try on a test pack first.

> **Updating from 1.1.x:** your existing dashboard login keeps working and becomes the **owner** — no reset. Everyone signs in again after the restart. Pre-upgrade file kept as `watchtower/dashboard-auth.json.pre-1.1.18.bak`.

- **Backup integrity verify** — Backups list shows Verified / Suspicious / Broken; Verify now; optional test restore into `watchtower/restore-verify/` only (never the live world)
- **Soft jar Disable / Enable** — Mods can rename a jar to `*.jar.disabled` (and back). Disabled jars stay in the list; filters All / Enabled / Disabled. Restart chip on Overview until you reboot. Admin/owner only — no Delete
- **World risk** — Badge when the save may depend on a mod (dimension folders / jar data). Extra confirm before disable. Issue if a disabled mod still has world dimension folders left behind
- **Named admin accounts** — owner / admin / viewer; Settings → Accounts (owner adds people and hands over a one-time temp password)
- **Audit log** — Settings → Audit log records settings, acks, suppressions, accounts, and sign-ins (`watchtower/audit-log.jsonl`, newest 2000 / 90 days)
- **Join & pack sync clinic** — rejects for mismatched channels / missing / wrong-version mods from `latest.log`; Issues `JOIN_SYNC` + Session → **Session activity** (joins / leaves / failed joins with **Copy fix**)
- **Session activity plate** — replaces Join clinic + Recent sessions with one right-column feed
- **Mods → Configs** — edit TOML under `config/` from the dashboard (form when it parses; raw otherwise); backup + undo; Admin+ only
- **RAM advice** — Insights → Configs uses host/container memory limits
- **Theme + accent** — rail Customize + Settings → Appearance; per account
- **Dashboard look** — bold blue accent, tighter corners, clearer gauge colours (metric vs healthy/warn), shared hero plates; less generic dark-SaaS chrome
- **React dashboard is the real app** — old Preact/alpha UI archived; packaging and docs follow `web/dashboard`
- **Insights → Storage Space map** — treemap of where disk goes (world / mods / logs / backups drill-in); meters and tables stay
- **Spark → Map** — pan/zoom chunk heat from the selected profile’s entity hotspots; click a square for chunk details
- **Insights → World** depth — dimension cards, compare bars, forceload + players (ties to 1.1.9 world pressure)
- **Live charts** — less jump/flash; calmer hover; better downsample
- **Snappier shell** — lazy routes, less query thrash, tabs scroll to top on change
- **Issues inbox** — severity groups only (Critical / Warning / Info); drift / silent-fail / world-pressure still show as Issues with the right Fix actions
- **Mods → Log errors** — Active / Reviewed + Mark reviewed
- **Support packs** — chooser is pack type + optional note + size; Customize files stays optional; tighter redaction and size accounting
- **Settings Appearance** — theme and accent on one row
- **Screenshots** — docs assets recaptured for Overview, Live, Insights, Mods, Issues, Crashes, Spark, Backups

## [1.1.9] — 2026-07-29

**Artifacts:** `watchtower-neoforge-1.1.9+mc1.21.jar` · `watchtower-cli-1.1.9.jar`

Release: [v1.1.9](https://github.com/djinnbanter/WatchTower/releases/tag/v1.1.9)

> 1.1.8 (pack pin storytelling) is deferred — this release skips that number.

- **World pressure** — continuous entity/chunk census by dimension; item-storm / mob-spike classifiers vs quiet hours; Insights → World dimension cards show forceload share + players; Issues band (`WORLD_PRESSURE_ENABLED`). Never auto-cleans entities/chunks; Spark World still owns per-chunk hotspots

## [1.1.7] — 2026-07-29

**Artifacts:** `watchtower-neoforge-1.1.7+mc1.21.jar` · `watchtower-cli-1.1.7.jar`

Release: [v1.1.7](https://github.com/djinnbanter/WatchTower/releases/tag/v1.1.7)

- **Silent script / datapack failures** — KubeJS, CraftTweaker, datapack JSON, and `/reload` errors that never crash become Issues (with a path when on the same log line); Active band **Script & datapack failures** (`SILENT_FAIL_DETECT_ENABLED`)

## [1.1.6] — 2026-07-28

**Artifacts:** `watchtower-neoforge-1.1.6+mc1.21.jar` · `watchtower-cli-1.1.6.jar`

Release: [v1.1.6](https://github.com/djinnbanter/WatchTower/releases/tag/v1.1.6)

- **Uptime & restart hygiene** — Overview suggests a maintenance restart when uptime is long and GC/heap is worsening, plus the next quiet window from Schedule evidence; never auto-restarts (`RESTART_HYGIENE_ENABLED`)
- **Dashboard timezone** — Settings → Timezone (this browser only) shows Schedule and quiet-window times in your zone; stored data stays UTC

## [1.1.5] — 2026-07-28

**Artifacts:** `watchtower-neoforge-1.1.5+mc1.21.jar` · `watchtower-cli-1.1.5.jar`

Release: [v1.1.5](https://github.com/djinnbanter/WatchTower/releases/tag/v1.1.5)

- **Watchdog and OOM force-kill detection** — when the previous session was killed from outside the JVM (OS/container OOM-killer or panel force-kill) with no Minecraft crash report, Crashes shows a **Killed** entry with the right fix (raise memory limit vs raise panel stop timeout); kill-switch `EXTERNAL_KILL_DETECT_ENABLED`

## [1.1.4] — 2026-07-28

**Artifacts:** `watchtower-neoforge-1.1.4+mc1.21.jar` · `watchtower-cli-1.1.4.jar`

Release: [v1.1.4](https://github.com/djinnbanter/WatchTower/releases/tag/v1.1.4)

- **Pack drift lock** — same jar name + version with a different checksum shows as Jar drift on Issues (verify intentional — not labeled corrupted)
- **Client-only jars on Issues** — high-confidence likely-removable client mods appear under Client-only jars (not only Mods filters)

## [1.1.3] — 2026-07-28

**Artifacts:** `watchtower-neoforge-1.1.3+mc1.21.jar` · `watchtower-cli-1.1.3.jar`

Release: [v1.1.3](https://github.com/djinnbanter/WatchTower/releases/tag/v1.1.3)

- **Weekly ops digest** — Insights → Digest (and a dismissible Overview card) summarizes the week: grade, crashes, disk change, MSPT trend, mod churn, and one “do this next” action; history stays local in `ops-cache.json`; optional kill-switch / cadence keys in `watchtower.conf` (`WEEKLY_DIGEST_*`); no email or webhooks

## [1.1.2] — 2026-07-26

**Artifacts:** `watchtower-neoforge-1.1.2+mc1.21.jar` · `watchtower-cli-1.1.2.jar`

Release: [v1.1.2](https://github.com/djinnbanter/WatchTower/releases/tag/v1.1.2)



- **Setup 2FA QR code** — setup wizard and Settings Security show the server QR (`qr_data_url`) next to the manual key
- **Wizard discovery crash/issue counts** — finished discovery shows real crash and issue totals (not blank dashes)
- **Support Bundle Builder** — rail Support opens a chooser (presets, logs Off/Tail/Full, crashes, Spark, extras); async compose; redacted pack v4 (`environment.json`, recipe, budgets); Settings Quick download + Customize; Copy for Discord; Add to support pack from Logs/Spark
- **Zero-BAU Pass 4** — reviewing disk-fill / tick-lag Issues no longer reopens on daily days-until-full drift or lag entry-count changes (stable fingerprints)
- **Zero-BAU Pass 3** — action queue gates on ops backups/crashes; Issues Hidden works without facts; ops-first Backups/crash drivers; empty Mods/Insights/Startup/Overview + wiki retarget Scanning / Support (Initial discovery stays the one-time baseline)
- **Zero-BAU Pass 2** — Support facts stay out of the BAU report index; Overview no longer forever-stale with schedule Off; Mods tree + `/watchtower issues` use Scanning when no legacy facts; brief/status wording matches Support compose
- **Zero-BAU Pass 1** — ops-cache/state path locks on remaining writers; Issues ledger contracts (log stale `active`, disk projection fields, skip resolved lag, stable backup fingerprints); backup scans refresh Issues; Acknowledge all syncs `issues_live`
- **Backup Issues “lookback window”** — BAU Issues use a **24-hour** freshness gate (not report lookback); missing archive vs older-than-24h messages updated
- **Crash Scan stuck on Unknown** — manual Scan force-reclassifies all crash reports; ops enrich overrides weak facts labels
- **Crash groups showing Unknown** — NeoForge stacks classify as loader when no mod id; titles prefer exception/display label; continuous enrich no longer sticks on Unknown
- **Modrinth update blockers** — missing required dependencies show the Modrinth project title (not the raw project id)
- **First-login account setup** — username/password change gate runs before the wizard/audit (login no longer skipped it)
- **Wizard Options** — enable Modrinth lookup before Initial discovery
- **Wizard discovery progress** — live counts for logs / crashes / mods / issues when discovery finishes (dashes only while unknown)
- **Settings without Deep audit schedule** — General no longer shows schedule / lookback / incremental; optional legacy schedule is conf or `/watchtower schedule` only
- **Preview mode on live servers** — fixed embedded flag injection so the dashboard no longer shows fixture Preview mode when served from the mod
- **Fresh install empty dashboard** — Initial discovery runs a full deep audit baseline again (facts + brief); empty live `latest: {}` no longer blocks Overview; wizard hydrates stores when discovery finishes
- **Wizard Initial discovery** — blocking first-run deep audit baseline with ReportEngine stage progress; Next locked until complete; Watching + Scanning keep deltas after that
- **Wizard without Support schedule** — no scheduled-bundle step; use rail Support when you need a zip
- **Zero-BAU audit fixes** — scheduled tick runs Support compose (not full ReportEngine); ops-cache delta writes synchronized; Modrinth scan works without legacy facts; Modrinth/Updates tabs ungated; Sources shows last support compose time; `MODS_DEEP_MAX_JARS_PER_WAKE` enforced
- **Zero-BAU wiki (Z10)** — in-app Docs: Understanding Data Sources, Health Reports, Commands, dashboard guides, HTTP API, Configuration; Support compose is the operator ask
- **Zero-BAU hardening (Z11)** — preview fixture includes continuous `issues_live` + `mods_deep`; ops tick regression test (no StagingBuilder on 60s path)
- **SupportComposer (Z7–Z8)** — Support zip and `/watchtower run` / `/watchtower diagnostics` compose from continuous ops + rollups; `watchtower-facts-support-*` is for the zip only (BAU ignores `-support-` artifacts)
- **Session tab (Z6)** — live online roster poll + stats mtime cursor; no deep-audit CTAs
- **Activity gap backfill (Z5)** — large `latest.log` gaps backfill into ops activity asynchronously (`ACTIVITY_GAP_*`)
- **Post-continuous UX** — no Catch-up on the rail; Support compose for shareable zips; schedule defaults **Off** on new installs
- **Spark hardening** — auto-capture failure cooldown (~60s) instead of burning the full 15m window; list cache for unchanged profiles; lag↔Spark correlation window 60 minutes; Overview shows Spark summary; Issues Fix panel **Open in Spark**; sub-tab/profile remembered in the browser; import size limit 64 MB; docs/conf.example match reality (`SPARK_*`, no dead `RCON_SPARK_TPS`)
- **Modrinth cache** — fixed cache wipe after every scan (timestamps + update deps now persist); update labels match Fabric/Quilt/Forge/NeoForge; Overview banner respects lookup off; Ops KPIs fill after a scan
- **Continuous Issues** — background scans keep an Issues ledger so Active stays useful with schedule Off; provenance chips (Live / Scanning / Event / Deep audit); Issues UI no longer requires a facts file
- **Startup without report** — boot timeline can appear after the server finishes starting (ops-cache `startup_profile`)
- **Crash enrich on mtime** — new crash files get a light summary without a deep audit (`CRASH_ENRICH_ON_MTIME`)
- **Mods light on jar change** — jar add/remove refreshes side scores into ops-cache; Mods Overview prefers them when fresher than the last report
- **Spark Overview without report** — fresh on-disk / auto-capture profiles show on Overview even before a deep audit
- **Support zip sooner** — download a support pack (dashboard or `/watchtower diagnostics`) from ops data before the first deep audit
- **New installs** — scheduled deep audits default Off
- **Data sources copy** — Watching / Scanning / Deep audit framing; Issues peeks + background scan cover day-to-day without a full audit
- **Internal docs** — continuous data-flow + post-continuous UX roadmaps — maintainer `docs/dev/roadmap/versions/`
- **Internal docs** — continuous data-flow study expanded (chunked jobs, cadences, catch-up-only deep audit) — maintainer `docs/dev/roadmap/studies/`
- **Mods UI consistency** — catalog rows match Issues/Crashes inbox; secondary-tab search in chrome; Forensics EmptyState
- **Crashes inbox** — list rows match the Issues inbox look
- **Overview Storage UX** — dropped RAM free; tighter dial + World/RSS layout, dimension share %, Classic Sass polish
- **Live RAM used** — toolbar + chart show host RAM used instead of free
- **Live toolbar vitals** — CPU, RAM used, and temps join TPS / MSPT / Players in the top bar
- **Overview storage dial** — “Disk used” above the dial; center shows only the %
- **Live temp dials** — title above the dial; center shows only the temperature
- **Live network / host temps on large screens** — Network and Host temperatures sit side-by-side from 1200px
- **Live network layout** — Receive / Send stack like host temps: graph left, animated Mbps on the right
- **Live disk read/write charts** — preview again fills Disk read/write (and net) history from envelope I/O; write-latency chip moved out of the chart grid
- **Live host temps** — CPU package and Ambient stack one above the other; dial on the right of each graph
- **Sass rail width** — side nav matches Aero width (no longer wider)
- **Live chart readout** — current value sits in the card header next to the title (not on the plot); hover still updates it
- **Live toolbar UX** — status + vitals sit together; Window / Poll / Pin lag stay on the right; freshness age only (no second “Live”); Sass Classic vitals and window chrome
- **Live 5m window** — range picker now includes **5m** before 15m
- **Sass Live chart polish** — taller plots; smaller left/bottom axis gutters
- **Sass Live thermal + network** — temp gauges and network strip match Classic cards (no aero glow / hard cyan)
- **Sass Insights heatmaps** — Patterns → Schedule maps follow the skin palette (orange accent under Sass, not blue); tighter Classic cell chrome
- **Sass chart wells** — Live/Overview graphs no longer show a harsh black inset border; plot blends with the card
- **Sass skin polish** — darker OLED black theme; mission tone washes fixed; Classic vitals/trust chrome cleaned up
- **Overview mission band** — denser two-row layout: compact grade + verdict on top, full-width live vitals strip below; KPI chips as a tight wrap
- **Sass skin (Classic v1.0 look)** — rail **Skin** cycles Aero (default glass) ↔ Sass (Deep Orange `#FF5722`, Inter + JetBrains Mono, glass cards, solid orange active rail, pill Run Report, left severity bars); pairs with Theme (dark / light / black)
- **Config and launch audit** — Startup shows a read-only Launch & config audit for `server.properties` (consider raising/lowering); Insights → Configs lists the same rows next to JVM flag advice; dismiss per key in the browser; `GET /api/config-audit`; padded Card/ListRow layout on Startup and Configs
- **Incident story timeline** — Activity shows a stitched “what happened” card when lag, crash, mod change, and backup signals line up; Overview teasers the latest story with a jump to Activity (demo fixture includes a sample story); Activity page layout cleaned up for clearer hierarchy
- **Blank dashboard after motion revival** — fixed Overview crash (`DUR is not defined` in vitals) and bad `AnimatedNumber` import paths
- **Motion revival** — mount-once page enters (no Overview/Live poll flash), metric count-ups from 0 on tab open and tween on change, animated gauges, one-shot chart reveals, bar grow-in, heatmap stagger, tab transitions, and safer button press feedback; respects `prefers-reduced-motion`
- **Spark profile subtabs** — Overview / Mods / World / Over time / Technical: plain labels, glossed tick rate/time, numbered next steps, mod spotlight, friendly entity names; section headers and cards get real padding
- **Spark tab UX polish** — padded Refresh/Import buttons; collapsible capture help; clearer empty + import chrome; profile meta row
- **Spark tab Refresh + Import from URL** — toolbar Refresh rescans disk; paste a `spark.lucko.me` link to download once into `watchtower/spark-upload/`; unreadable profiles show a skipped notice; `source_path` stays relative for deep links
- **Modrinth false updates** — no longer flags an older parent-MC build (e.g. Farmer’s Delight `1.21-1.2.4`) as an update over a newer `1.21.1-*` install; pack MC prefers patch-level jar/version votes
- **Empty Minecraft version on live reports** — server now always stamps MC + loader into snapshot/`platform.json` (with `VERSION_STRING` fallback); Modrinth uses that before guessing from jars
- **Server won't start with C2ME** — fixed JPMS split-package crash (`watchtower` vs jar-in-jar common both exporting `dev.mcstatus.watchtower`); drop in a fresh jar from `releases/latest`
- **Disk fill projection** — Overview/Insights Storage show days-until-full; Live write latency; Issue `DISK_FILL_PROJECTED` when runway is short; MSPT↔disk write correlation
- **Performance baseline** — Insights → Patterns: freeze a known-good window, flag when the last 7 days are ≥10% slower; **Set new baseline**; Overview teaser; Settings → Monitoring toggles
- **1.1.x quality pass** — Monitoring settings stick after save; baseline healthy gate ~30 min; Configs prefers report JVM health; Restart uses unreviewed crash time
- **RAM right-sizing** — Insights → **Configs**: conservative “do I need more RAM?” card from 7d+ heap history vs `-Xmx` (blocks “add RAM” when single-thread bound; GC-bound only when pressure is not already high)
- **Live chart order** — GC pause % wall sits after Players online
- **Backup false “failure” + Scan now** — lookback alone no longer shows **Backup failure** (warn days drive stale); hybrid fresh local or external is OK; Backups **Scan now** refreshes inventory / Overview / Issues without a full report
- **Safe to restart** — Overview Restart card: Safe / Caution / Wait from backups, pregen, players, disk, and recent crashes (informational only)
- **GC / JVM health** — Live shows GC pause % of wall, heap pressure, and flags profile; **Insights → Configs** recommends the best Aikar / flags.sh baseline for this Java/Minecraft/heap, lists missing flags worth adding, and shows a paste box when useful (card spacing fixed so padding is visible); Insights Load adds heap/GC columns; Issues can raise **GC / heap pressure** when the heap is full or GC is eating wall time — without shaming custom/ZGC setups
- **Issues / Crashes selection** — clicking another row switches the detail pane; leaving the tab is no longer blocked (selection no longer fights URL navigation or freezes a stale Issues tree)
- **Dashboard thrash while offline** — connection-lost no longer freezes tab switching (was re-rendering the shell on every failed poll)
- **Dashboard UI polish** — clearer glass cards, shared Issues/Crashes/Mods search chrome, honest Live/report freshness stamps, Fix-first queue details, `/` j/k `r` shortcuts on queues, Modrinth links show they open in a new tab
- **v2 ALPHA concept preview removed** — interactive mock on `:8081` scrapped; 1.x dashboard unchanged
- **Auto-Spark lag capture** — opt-in in Settings → Monitoring (off by default): on critical lag, Watchtower can run Spark ~45s, save a profile on disk, and show which mod was chewing the tick in Issues + Spark
- **Auto-Spark lag peek** — attaching Spark to a lag incident no longer reopens a resolved Issues row
- **Roadmap page** — rebuilt to match the share poster (legend, situation panels, promises)
- **Roadmap share image** — neo-Frutiger Aero poster of the public roadmap
- **Roadmap** — rewritten for clarity (today / coming next by situation / later / not our job); wiki + in-app tab match
- **Navigation** — rail tabs and page subtabs update immediately again (no F5); same root-render stall as Live charts
- **Live charts** — fixed blank charts when navigating to Live (no more F5); uPlot survives dashboard re-renders and samples fetch immediately on entry
- **Overview layout** — healthy/steady Overview keeps a 2-column layout (instruments stacked + triage side), matching incident mode at the same width
- **Modrinth updates** — fixed false “0 updates” on NeoForge when Minecraft version wasn’t on the mods list; scan now resolves MC from snapshot/Spark/NeoForge mapping
- **Mods list** — only top-level jars in mods/; nested jar-in-jar mods show on the parent Details pane
- **Report Retry** — failed Run Report modal now shows Retry (and Run again after success)
- **Dashboard updates stick** — live HTML/JS/CSS no longer cached aggressively, so Overview layout matches the jar after refresh
- **Startup boot phases** — fixed absurd phase durations when a log line lacked a timestamp; phases stay within total boot time
- **Spark preview** — five fixture profiles load on the Spark tab in preview (selector + Summary/Mods/World/Window/Advanced use parser-shaped mock data)
- **Roadmap page** — new System rail tab with a glass showcase of what’s coming next (Live today, vision themes, fleet/alerts horizons, trust chips, GitHub CTA)
- **Instrument plate across pages** — Overview-style glass + tone wash + top gradient hairline on featured cards, Live charts/thermals, Session/Startup heroes, Sources, Mods forensics KPIs, and other verdict surfaces
- **Overview Storage** — Heap tile removed from Storage (still in vitals); smaller disk used % readout
- **Live charts** — paint filled immediately again (no empty stagger/reveal; samples prefetch at boot)
- **Dashboard navigation** — rail clicks and back/forward now switch pages reliably again (signals SCU patch + root re-render on route changes)
- **Overview vivid & alive** — glowing grade beacon, channel-coloured live vitals (clear numbers, no sparklines), one consolidated status chip strip (MC / loader / Java / session / mods / backup), colour-washed instruments, and triage as a flush glass list; Heap vital restored; honours reduced-motion
- **Overview mission control** — grade + vitals hero band, trust chips, instrument cards (Storage dial, Boot strip); less duplicated status chrome
- **Rail brand header** — glass plate + icon cradle, stronger WatchTower wordmark, quiet “Server ops” tagline
- **Rail + topbar UX** — Reports glass plate; System label; Theme/Collapse tool row; collapse restores on boot; mobile drawer always expanded; short Live/Offline + freshness chips; Search primary then quiet Inbox; theme stays on the rail
- **Issues / Crashes / Mods chrome parity** — shared glass search+filter strip; Mods detail uses Crashes panel chrome; sticky detail panes without nested scrollbars
- **Issues tab overhaul** — Active / Reviewed / Tools; list+detail with Fix | Details (same panel/step chrome as Crashes); Hidden under Tools; deep links via `view` + `issue`
- **Crashes subtabs** — Review / Reviewed / Tools; list+detail with Fix | Evidence | Details; Tools for Scan, Mark all, Find owning jar
- **Crashes inbox list** — collapsible day groups; Today expanded by default
- **Crashes Fix pane** — numbered step cards, clearer action tiers, confidence in header
- **Crashes Evidence & Details** — shared panel chrome with Fix; grouped Details sections; richer Evidence layout
- **Crashes list layout** — styles.css rebuild so list rows render as a proper stack (not overlapping bare buttons)
- **Mods → Modrinth** — dedicated scan tab (KPIs, progress/ETA, Overview banner); reports no longer call Modrinth (cache-only); optional auto-scan after mod changes
- **Mods Overview catalog** — paginated full list (25 per page, First/Prev/Next/Last) with sort (Name, Mod ID, Server→Client, Updates first, Version); remembered in the browser
- **Mods list/details** — 50/50 split; details pane two columns; pagination instead of nested list scroll
- **Mods Client/server signals** — Modrinth logo + plain labels (Server required / Client only) instead of raw `modrinth:…` keys
- **Mods subtabs** — removed Client-only and Dependencies pages; dependency trees now live in an expandable section on Overview / Updates detail panes
- **Mods → Updates** — pack-impact verdicts for Modrinth-compatible outdated jars (see main [CHANGELOG.md](https://github.com/djinnbanter/WatchTower/blob/main/CHANGELOG.md))
- **Themed scrollbars** — soft sky-glass thumbs across the dashboard

---

## [1.1.0] — 2026-07-13

**Artifacts:** `watchtower-neoforge-1.1.0+mc1.21.jar` · `watchtower-cli-1.1.0.jar`

Release: [v1.1.0](https://github.com/djinnbanter/WatchTower/releases/tag/v1.1.0)

Watchtower **1.1.0** builds on **1.0.0** / **1.0.0a** with a large ops toolkit upgrade:

### Dashboard

- **Overview welcome** — personalized greeting with hostname and a short live status summary
- **Session** — cleaner player roster (vitals → top playtime → directory; online-first sort)
- **Insights Patterns** — Overview / Schedule / Load / Incidents sub-panels with Schedule heatmaps
- **Setup wizard** — live discovery audit, optional 30-day baseline, actionable Backups / schedule / Security steps
- **Backups Not tracking** — opt out of backup age Issues and nudges while keeping folder paths
- **UI polish** — clearer type scale, tooltips, loading spinners, Crashes/Spark/Logs chrome

### Intelligence & triage

- Crash fix advice is evidence-first (Create/watchdog/OOM and related playbooks)
- Declarative crash rule packs, mod forensics, and CA parity crash kinds
- Crash inbox groups, Startup boot profile, Logs viewer, Issues acknowledge / Reviewed
- Modrinth identity + update hints (opt-in; never downloads jars)

### Live & chrome

- Live chart windows through 30d, collapsible sections, System temps-only dials
- Neo-Frutiger Aero glass themes; Run Report stage progress
- Short guided tour: one card per rail page

---

## [1.0.0] — First public release — 2026-06-24

**Artifacts:** `watchtower-neoforge-1.0.0+mc1.21.jar` · `watchtower-cli-1.0.0.jar`

Watchtower **1.0.0** is the complete ops toolkit for NeoForge **1.21.x** Linux servers:

### Core

- Live dashboard at `:8787` with login + optional 2FA
- Scheduled health reports (default twice daily) with plain-English **brief** + **facts** JSON
- Disaster recovery CLI + browser DR viewer when the server will not boot
- **GPL-3.0-or-later** · one mod JAR for Minecraft **1.21.1** through latest **1.21.x** (`+mc1.21`)

### Dashboard tabs

- **Overview** — vitals, server health peek, performance insights teaser, setup resume card
- **Live** — TPS, MSPT, CPU, RAM, disk, network charts with linked time range
- **Insights** — busy/quiet hours, lag patterns, mod changes, storage trends, CSV export
- **Issues** — prioritized fix list from reports + live lag/mod peek
- **Crashes** — crash review with pre-crash context
- **Mods** — full mod list, log errors, conflict guidance
- **Backups** — folder inventory + panel/cloud heartbeat tracking
- **Activity** — live event ledger and lag spike incidents
- **Session** — roster, peak players, search/sort, copy UUID
- **Spark** — profiler workflow, profile picker, five detail sub-tabs
- **Sources** — freshness matrix for live vs scan vs report data
- **Docs** — full operator wiki built into the dashboard

### Operator tools

- **Setup wizard** — first-run audit, backups, schedule, optional 2FA (`?setup=1` to reopen)
- **Settings → Backups** — 2-step panel backup setup with test heartbeat
- **Settings → Monitoring** — read-only poll intervals and retention
- Always-on background scan (~60s) for logs, crashes, mod errors, and activity
- Version chip + update banner (GitHub / Modrinth check)
- Hosted-panel metrics honesty (cgroup labels, trust badges)

### Commands

`/watchtower run`, `brief`, `status`, `issues`, `schedule`, `diagnostics`, `url`, `pin`, `dashboard reset-password`

---

## Links

- [Release v1.1.0](https://github.com/djinnbanter/WatchTower/releases/tag/v1.1.0)
- [Release v1.0.0](https://github.com/djinnbanter/WatchTower/releases/tag/v1.0.0)
- [[Roadmap]] — what is planned next
