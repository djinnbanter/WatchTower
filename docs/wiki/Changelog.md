# Changelog

**What changed in each Watchtower version** — new features and fixes that affect you as a server owner.

Full downloads: [GitHub Releases](https://github.com/djinnbanter/WatchTower/releases) · Maintainer copy: [CHANGELOG.md](https://github.com/djinnbanter/WatchTower/blob/main/CHANGELOG.md)

---

## Unreleased

- **Documentation audit** — setup wizard copy, Settings → Security paths, HTTP API (Insights, Spark, onboarding), README and contributor doc fixes; DR viewer marked as early preview

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

- [Release v1.0.0](https://github.com/djinnbanter/WatchTower/releases/tag/v1.0.0)
- [[Roadmap]] — what is planned next
