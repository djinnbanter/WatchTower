# Dashboard Tabs

The dashboard has **eleven main tabs** plus **Docs**, **Settings**, and **Help**. This page explains what each one is for and when to use it.

---

## At a glance

| Tab | Use this when… | Main data source |
|-----|----------------|------------------|
| **Overview** | You want a quick health summary | Live + last report |
| **Live** | You are watching performance right now | Live charts |
| **Insights** | You want patterns over days/weeks | Minute history + report |
| **Session** | You want to see who is online | Live + last report |
| **Sources** | You wonder “when did this last update?” | All layers |
| **Issues** | You want a prioritized fix list | Full report |
| **Crashes** | A player crashed or the server died | Background scan + report |
| **Mods** | Mod errors or conflicts | Background scan + report |
| **Backups** | You need to know if backups are recent | Background scan + report |
| **Activity** | You want a timeline of events | Background scan + report |
| **Spark** | You profiled lag with Spark | Full report |

---

## Overview

**Your home screen** after at least one health report.

- Overall health (ok / warning / critical)
- Key numbers: speed, CPU, memory, players
- Short list of recent problems with link to **Issues**
- Teaser for **Insights** patterns
- Storage and recent activity snippets
- **Run full report** — refreshes everything that depends on a deep check

**Tip:** Run a report first for the full fix list. Many cards still update from background scans before that.

---

## Live

**Watch the server right now.**

- **Right now** alerts — backup running, restart scheduled, stale logs, mod file changes
- Game: TPS, tick lag (MSPT), memory, players — with charts
- Host: CPU, RAM, disk, network when available
- Change refresh speed and chart time range

Data is recorded every second (configurable) and kept up to 90 days.

---

## Insights

**See patterns over time** — busy hours, lag vs player count, week comparisons.

Sub-areas:

| Area | What it shows |
|------|----------------|
| **Patterns** | Heatmaps, averages, sticky lag episodes, outliers |
| **Mod changes** | Mods added, removed, or updated since last report |
| **Storage** | Disk jumps and world size breakdown |

Needs some uptime history (ideally 24h+) for meaningful charts. **Overview** only shows a one-line teaser — full analysis is here. CSV export is on this tab.

---

## Session

**Who is on the server and who was active recently.**

- Live list: online players, ping, dimension
- Search, sort, copy player UUID
- Playtime and session history from last report
- 24h player count sparkline

Requires server online for live status; historical stats come from reports.

---

## Sources

**Understand what updates how.**

- When live charts, background scan, and last full report ran
- Plain explanation of the three update layers
- Table of which features need live vs scan vs report
- Link to **Settings → Monitoring**

---

## Issues

**Your fix list** from the latest health report.

Three groups:

1. **Needs attention now** — crashes, out-of-memory, server down signals
2. **Worth fixing when you can** — lag, stale backups, mod warnings
3. **Historical** — older or acknowledged items

Each item has severity, what happened, and suggested steps.

---

## Crashes

**Crash reports in plain English.**

- Headline, time, likely cause, suspected mod
- Steps to try
- What happened in the 10 minutes before the crash
- Mark as reviewed when handled
- Filters: all, needs review, mod-related, host/resource

Crash folder is checked in the background; **Refresh** rescans without a full report.

---

## Mods

**Mod health** — log errors update in the background; full mod list and conflict analysis need a report.

Pages: Overview, Update conflicts, Client-only mods, Log errors.

Search and jump between sections. Badge shows count of mods with log errors.

---

## Backups

**Are your backups recent and configured?**

Watchtower does **not** guess backup locations — you set them in **Settings → Backups** or **Choose backup folder** on this tab.

Shows panel backup status, local archive list, rescan, and plain “what to do” steps when backups are missing or old.

See [[Backups]] for setup.

---

## Activity

**Timeline of server events** — joins, leaves, crashes, reboots, commands, backups, and more.

Search and filter by type. **Not** the same as **Insights** (which shows patterns over time). Enable [[Scheduled Reports]] so older events stay populated.

---

## Spark

**Lag breakdown from a Spark CPU profile** — pick any saved `.sparkprofile` from the dropdown (on-demand parse). No full report required to view; optional **Run report** adds Spark to Overview and `brief.txt`.

**How to use Spark** workflow at the top: capture while lagging → pick profile → read advice (collapses after first load). Five sub-views — **Summary** (verdict, KPIs, findings, recommendations), **Mods & code** (mod usage, signals, hot methods), **World** (entities, hotspots, dimension breakdown), **Capture window** (timeline), **Advanced** (performance chart, method table, JVM/config details). Choice persists per browser. See [[Using-Spark-with-Watchtower]].

---

## Admin — Docs

**All guides inside the dashboard** — search, categories, diagrams on key pages. Same content as this wiki. **Help (?)** links here for full articles.

---

## Technical appendix

Internal data layers and APIs for maintainers:

| Tab | Technical notes |
|-----|-----------------|
| Overview | L0 vitals + ops peek; master refresh = full report |
| Live | L0 + ops-cache Right now feed |
| Insights | L1 rollups + ops-cache; tab id `performance`; `GET /api/performance/dashboard` |
| Session | `GET /api/players` + `player_directory` / `window_stats` from facts |
| Sources | `GET /api/data-sources` |
| Issues | Full queue from facts; live peek on Overview |
| Crashes | OPS_LOG_SCAN_SEC folder scan + facts `pre_crash` |
| Mods | Ops-cache log errors + facts manifest |
| Backups | `backups_live` ops-cache merge + facts |
| Activity | Ops ledger + facts backfill; subtitle references OPS_LOG_SCAN_SEC |
| Spark | On-demand profile list/parse (`/api/spark/*`); report embeds newest for Overview |

Feature details and UI notes are in [[Changelog]].

---

## See also

- [[Live Charts]]
- [[Health Reports]]
- [[Quick Start Checklist]]
- [[Understanding-Data-Sources]]
