# Changelog

**What changed in each Watchtower version** — new features and fixes that affect you as a server owner.

Full downloads: [GitHub Releases](https://github.com/djinnbanter/WatchTower/releases) · Maintainer copy: [CHANGELOG.md](https://github.com/djinnbanter/WatchTower/blob/main/CHANGELOG.md)

---

## Unreleased

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
