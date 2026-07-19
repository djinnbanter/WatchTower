# Dashboard Tabs

The dashboard has **thirteen main tabs** plus **Docs** and **Settings** in the rail’s **System** group (theme and collapse sit in the tool row under them). Tabs are grouped as **Monitor**, **Triage**, and **Ops**.

---

## Navigation groups

| Group | Tabs |
|-------|------|
| **Monitor** | Overview, Live, Insights, Session, Startup |
| **Triage** | Issues, Crashes, Logs, Spark |
| **Ops** | Mods, Backups, Activity, Sources |
| **System** | Docs, Settings (+ Theme / Collapse tools) |

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
| **Issues** | You want a prioritized fix list | Report + live peek |
| **Crashes** | A player crashed or the server died | Background scan + report |
| **Logs** | You want to read `latest.log` or a crash file | Live file read + crash scan |
| **Mods** | Mod errors or conflicts | Background scan + report |
| **Backups** | You need to know if backups are recent | Background scan + report |
| **Activity** | You want a timeline of events | Background scan + report |
| **Spark** | You profiled lag with Spark | Full report |

---

## Overview

**Your home screen** after at least one health report.

- **Mission band** — health grade, one-line verdict, and live TPS / MSPT / Players (plus CPU when available)
- Quiet **trust chips** — uptime, session, environment, Java, mods, backup
- **Needs attention** / **Right now** triage (when something needs action)
- **Instrument cards** — Storage (disk dial + dimension share), world pregen jobs, Boot profile strip, Insights teaser
- Setup resume chip when wizard / baseline / backups still need attention
- **Run Report** lives on the side rail (Reports plate)

**Tip:** Run a report first for the full fix list. Many cards still update from background scans before that. Topbar shows Live/Offline and report freshness so Overview does not repeat those.

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

**Your fix inbox** for the whole server — report findings, live lag/mod/log-stale peek, Modrinth updates, backups, and a pointer into Crashes. Deep forensics stay on Crashes / Mods / Logs; Issues answers *what to fix next*.

Subtabs: **Active** (default) · **Reviewed** · **Tools**.

### Active / Reviewed

Permanent **list + detail** split (same idea as Crashes / Mods Overview):

- **Left list** — priority bands (**Needs attention** / **Worth watching** / **Older findings**); Needs expanded by default; compact rows with severity, source chip (Live · Report · Update · Crash · Backup), age, and peek text; source filter + search
- **Active** — open work only (live peek + action queue)
- **Reviewed** — items you marked reviewed (Undo brings them back); no duplicate “Older findings” archive
- **Right detail** — nested panels: **Fix** (default) | **Details**
  - **Fix** — “Do this next” numbered step cards, primary deep link (Mods / Live / Crashes / Backups / Modrinth), Copy steps, Mark reviewed / Don’t show again, High/Medium/Low confidence when guidance exists
  - **Details** — identity keys, source, timestamps, narrative, live lag metrics when present
- Crash rows are a compact pointer (“N crash groups need review”) — open **Crashes** for the real fix plan
- Deep links: `?tab=issues&view=active|reviewed|tools` + `issue=<ackKey>`; Overview attention items open Active with `issue=` set

### Tools

- **Mark all reviewed** (also available on Active when the queue is nonempty)
- **Hidden (suppressed)** — restore issue ids silenced with **Don’t show again** (see [[Crash Rule Packs]])
- Short tips on when to review vs suppress

Dismissing a Modrinth update in the topbar bell also marks that Issues card reviewed. Crash cards still clear via the Crashes ack path.

---

## Crashes

**Resolve crashes quickly** — similar reports collapse into fingerprint **groups**, then a numbered fix plan. Subtabs: **Review** (default), **Reviewed**, **Tools**.

### Review / Reviewed

Permanent **list + detail** split (same idea as Mods Overview / Issues Active vs Reviewed):

- **Left list** — inbox-style day groups (Today / Yesterday / date); only **Today** expanded by default; compact rows with title, count, age, cause peek, kind chip; kind filters + search
- **Review** — unreviewed fingerprint groups only (the fix queue)
- **Reviewed** — groups already marked reviewed (history)
- **Right detail** — nested panels: **Fix** (default) | **Evidence** | **Details**
  - **Fix** — “Do this now” numbered step cards, Modrinth / Mods / Find owning jar / Copy steps / Mark group reviewed, related mod chips, short Why + High/Medium/Low confidence
  - **Evidence** — pre-crash context, member files with View log + per-file Reviewed
  - **Details** — fingerprint, exception, kind, rule hits, mixin/config/OOM/java mismatch

### Tools

Calm ops page (no giant list):

- KPI strip (Needs review, total, latest age) + **Scan now** / **Mark all reviewed**
- **Find owning jar** — class/package lookup (same as Mods → Forensics)
- Short tips on groups, Mark reviewed, Scan vs full report, links to Mods → Forensics and Logs

### Links and inbox

- URL: `?tab=crashes&view=review|reviewed|tools` (+ optional `group=<fingerprint>`)
- Deep link / inbox: keep `group=`; opens **Review** if any member is unreviewed, else **Reviewed**
- Confidence is **High / Medium / Low** only (no fake %)
- Crash folder is checked in the background; **Scan now** rescans without a full report. The topbar **bell** lists unreviewed crash groups and update nudges (`GET /api/inbox`).

Crash **summaries and review** stay on this tab — Logs is for reading the raw files.

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

**Mod health** — log errors update in the background; full mod list, side scoring, and dependency trees need a report.

Pages: **Overview**, **Updates**, **Conflicts**, **Log errors**, **Changes**, **Modrinth**, **Forensics**.

- **Overview** — smart catalog: icons, side badges, Update chips; search in the catalog toolbar; filters All / Client / Server / Unresolved; sort (Name, Mod ID, side, updates, version); paginated list (25 per page) with a permanent 50/50 list/details split (Client/server callout, links, expandable **Dependencies** with Needed by / Needs trees). On wide screens the details pane lays out in two columns. Toolbar links to Updates when outdated jars exist. Compact banners for Security / Connector / Modrinth scan status (click through to Modrinth).
- **Updates** — Modrinth-compatible updates from the latest report with pack-impact verdicts (Safe / Caution / Break / Unknown), blockers, co-updates, dependents, and the same expandable Dependencies section; opens Modrinth in the browser (Watchtower never downloads jars)
- **Conflicts** — log/compat recommendations (not the same as Modrinth version Updates)
- **Log errors** — merges scan + report aggregates into expandable cards with full sample lines, category breakdown, and Do this next from recommendations (not a one-line table)
- **Changes** — jar add/remove/change since the last report
- **Modrinth** — dedicated scan tab: coverage / outdated / cache KPIs, Run Modrinth scan, staged progress with batches + ETA; patches the latest report after a successful scan
- **Forensics** — class-index status, corrupt jars, config health (from last report / API); use Crashes → **Tools** → Find owning jar for stack lookup

Search and jump between sections. Badge shows count of mods with log errors.

Optional **Modrinth lookup** (Settings → Monitoring) gates the dedicated **Mods → Modrinth** scan (cached; never downloads jars). Full reports never call Modrinth — they only apply cache hits. Optional **auto-scan after mod changes** starts that scan when jars change on disk (ops poll), not when you Run Report. Off by default; no API key; sends jar SHA-512 hashes only. See [[Installation]] privacy note. After enabling, run a scan from Mods → Modrinth: Overview shows icons, project links, and Client/server signal chips; **Crashes** and inbox/Issues get accurate update hints.

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
