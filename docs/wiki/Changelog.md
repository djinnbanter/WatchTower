# Changelog

**What changed in each Watchtower version** — new features and fixes that affect you as a server owner.

Full downloads: [GitHub Releases](https://github.com/djinnbanter/WatchTower/releases) · Maintainer copy: [CHANGELOG.md](https://github.com/djinnbanter/WatchTower/blob/main/CHANGELOG.md)

---

## Unreleased

*(nothing yet — see [1.1.0](#110--2026-07-13))*

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
