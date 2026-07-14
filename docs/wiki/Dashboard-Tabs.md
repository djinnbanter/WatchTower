# Dashboard Tabs

The dashboard has **thirteen main tabs** plus **Docs**, **Settings**, and **Help**. This page explains what each one is for and when to use it.

---

## At a glance

| Tab | Use this when… | Main data source |
|-----|----------------|------------------|
| **Overview** | You want a quick health summary | Live + last report |
| **Live** | You are watching performance right now | Live charts |
| **Insights** | You want patterns over days/weeks | Minute history + report |
| **Session** | You want to see who is online | Live + last report |
| **Startup** | You want last boot time, phases, and boot warnings | Full report |
| **Sources** | You wonder “when did this last update?” | All layers |
| **Issues** | You want a prioritized fix list | Full report |
| **Crashes** | A player crashed or the server died | Background scan + report |
| **Logs** | You want to read `latest.log` or a crash file | Live file read + crash scan |
| **Mods** | Mod errors or conflicts | Background scan + report |
| **Backups** | You need to know if backups are recent | Background scan + report |
| **Activity** | You want a timeline of events | Background scan + report |
| **Spark** | You profiled lag with Spark | Full report |

---

## Overview

**Your home screen** after at least one health report.

- Personalized **welcome** band (username, hostname / panel label, short live status)
- Overall health (ok / warning / critical)
- Key numbers: speed, CPU, memory, players
- Short list of recent problems with link to **Issues**
- Teaser for **Insights** patterns
- **Boot profile** card — last `Done!` duration, slowest phase, warning count; links to **Startup**
- Storage and recent activity snippets
- **Run full report** — refreshes everything that depends on a deep check
- Setup resume chip when wizard / baseline / backups still need attention

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
| **Patterns** | Nested panels — **Overview** (KPIs, week compare, takeaways), **Schedule** (MSPT / TPS / players hour-of-week heatmaps + hourly bars), **Load** (daily + player-count tables), **Incidents** (outliers, sticky lag, correlations, related events) |
| **Mod changes** | Mods added, removed, or updated since last report |
| **Storage** | Disk jumps and world size breakdown |

Needs some uptime history (ideally 24h+) for meaningful charts. **Overview** only shows a one-line teaser — full analysis is here. CSV export is on this tab.

---

## Session

**Who's online and who's been here.**

- Vitals row (online count, peak, playtime) then optional **Top playtime** chips
- Player directory: avatar + name, status tone, ping, dimension, playtime, last seen, copy UUID
- Default sort: online first, then name (or the column you pick)
- Search and sort; 24h player count sparkline when available

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

**Your fix list** from the latest health report, plus live lag/mod peek alerts.

Use **Active** vs **Reviewed**:

1. **Needs attention** — crashes, OOM, live lag spikes, blocking findings
2. **Worth watching** — Modrinth updates, softer warnings
3. **Older findings** — auto-historical report items (still on Active until you review them)

Each card has severity, what happened, suggested steps, and **Mark reviewed**. Reviewed items move to the **Reviewed** tab (Undo brings them back). **Mark all reviewed** clears the active queue; crash cards still use the Crashes ack path. Dismissing a Modrinth update in the topbar bell also marks that Issues card reviewed. Use **Suppress** to hide noisy issue ids (see [[Crash Rule Packs]]); suppressed items appear under **Hidden**.

---

## Crashes

**Resolve crashes quickly** — similar reports collapse into fingerprint **groups**, then a numbered fix plan.

- **Group list** — human label (e.g. “Server hang during pregen”), count chip, needs-review chip, one-line cause, primary action peek
- Expand a group → **Do this now** first (numbered steps), then Why, then Evidence (pre-crash context, member files, View log) collapsed by default
- **Modrinth** / **Mods** CTAs when a mod needs updating or pairing — opens Modrinth in the browser (no auto-download). With Modrinth lookup enabled, links prefer the loader/MC-compatible version page when the installed jar is outdated.
- **Mark all reviewed** — one click for every unreviewed crash file (files stay on disk); or mark one group
- Filters: All / Needs review / Mod-related / Server hang / Host (+ search)
- Deep link: `?tab=crashes&group=<fingerprint>`
- Confidence is **High / Medium / Low** only (no fake %)

Crash folder is checked in the background; **Scan now** rescans without a full report. The topbar **bell** lists unreviewed crash groups and update nudges (`GET /api/inbox`).

---

## Startup

**Last boot at a glance** — from the latest report’s `optional.startup_profile`.

- Hero: total boot time, status, finished time, vs last boot, warning/error counts
- Phase cards with share of boot and ranked slowest markers (no duplicate Slowest list)
- Side-by-side warnings and errors (blocking vs non-blocking); Open Mods on error cards
- Compare to previous boot when prior profile exists

Needs a full report. Overview shows a short boot card that deep-links here.

---

## Logs

**Read server logs and crash report files** without leaving the dashboard.

- Left list: `latest.log`, `debug.log`, rotated `*.log.gz`, plus crash report files from the crash scan
- Right viewer: monospace tail of the file, filter/search lines, copy, and download
- Choose how many lines to load (500 / 2k / 5k / 10k) for live logs

Crash **summaries and review** stay on the **Crashes** tab — Logs is for reading the raw files.

---

## Mods

**Mod health** — log errors update in the background; full mod list, client-only scoring, and dependency trees need a report.

Pages: **Overview**, **Update conflicts**, **Changes**, **Client-only**, **Dependencies**, **Log errors**, **Forensics**.

- **Overview** — running mods with report-driven badges (`server-required`, client-only bucket, MCreator, Fabric jar)
- **Log errors** — merges scan + report aggregates into expandable cards with full sample lines, category breakdown, and Do this next from recommendations (not a one-line table)
- **Forensics** — class-index status, corrupt jars, config health (from last report / API); use Crashes → **Find owning jar** for stack lookup
- **Client-only** — scored candidates from the latest report (`likely_removable` / `uncertain` / …) with confidence, reason, signals, and dependents links (falls back to a short heuristic list only when no report is loaded)
- **Dependencies** — pick any mod and expand **Needed by** / **Needs** trees from TOML dependencies

Search and jump between sections. Badge shows count of mods with log errors.

Optional **Modrinth lookup** (Settings → Monitoring) can refine ambiguous jars — **only when a full report runs**, not when you open this tab. Off by default; no API key; sends jar SHA-512 hashes only. See [[Installation]] privacy note. After enabling, run a report, then look for `modrinth:…` signal chips on Client-only rows. The same lookup also fills accurate Modrinth project/version links on **Crashes** and optional “update available” inbox/Issues hints — Watchtower **never downloads jars**.

---

## Backups

**Are your backups recent and configured?**

Watchtower does **not** guess backup locations. On this tab: **Step A** choose a local folder (browse — never auto-filled), **Step B** connect panel/cloud via heartbeat or marker — or choose **Not tracking** to silence backup Issues and Overview alerts while keeping folder paths. Settings → Backups only shows status and a link here.

Shows archive list, last external signal, rescan, and plain “what to do” steps when backups are missing or old.

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

**All guides inside the dashboard** — search, categories, and diagrams on key pages. Same content as this wiki.

---

## Technical appendix

Internal data layers and APIs for maintainers:

| Tab | Technical notes |
|-----|-----------------|
| Overview | L0 vitals + ops peek; boot card from `optional.startup_profile`; master refresh = full report |
| Live | L0 + ops-cache Right now feed |
| Insights | L1 rollups + ops-cache; tab id `performance`; `GET /api/performance/dashboard` |
| Session | `GET /api/players` + `player_directory` / `window_stats` from facts |
| Startup | facts `optional.startup_profile` (phases, warnings, errors) |
| Sources | `GET /api/data-sources` |
| Issues | Full queue from facts; live peek on Overview |
| Crashes | OPS_LOG_SCAN_SEC folder scan + facts `crash_summaries` / `pre_crash` (`failure_kind`, stall/primary mod) |
| Logs | `GET /api/logs/list`, `GET /api/logs/content`; crashes via ops-cache + `/api/crashes/report` |
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


### Mod forensics / jdeps (1.0.17)

Watchtower finds which jar owns a class via entry scan (/api/mods/forensics/find-class). JDK **jdeps** is optional and offline-only — run locally with a JDK; Watchtower does not spawn jdeps on the server.
