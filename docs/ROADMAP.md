# Watchtower roadmap

**What's happening on your server — and what to do next.**  
Live dashboard, health reports, disaster recovery — **all on your machine**. No cloud account, no analytics database.

Releases ship when they're ready (no fixed dates). **Latest:** **1.1.0** · [Modrinth](https://modrinth.com/mod/watchtower) · [Changelog](../CHANGELOG.md)

**Platform:** NeoForge **1.21.x** now · Fabric **1.21** + NeoForge **1.20.x** later.

---

## 1.1.0 — Shipped

Ops intelligence and dashboard polish since **1.0.0** / **1.0.0a** — former planned **1.0.1–1.0.8** themes landed here:

- Smarter mod list (Create protection, Modrinth lookup, dependency tree)
- Crash & DR intelligence, Startup boot profile, crash inbox groups
- Mod forensics + declarative crash rule packs
- Glass UI, Run Report stage progress, Backups setup + **Not tracking**
- Overview welcome, Insights Patterns sub-panels, Session roster polish
- Issues acknowledge / Reviewed, Logs viewer, Live chart windows
- Setup wizard discovery audit + guided tour (one card per rail page)

Artifacts: `watchtower-neoforge-1.1.0+mc1.21.jar` · `watchtower-cli-1.1.0.jar`

---

## 1.0.0 — Shipped

First public release — everything below ships in **1.0.0**:

- Live dashboard (`:8787`) with Overview, Live, Insights, Issues, Crashes, Mods, Backups, Activity, Session, Spark, and Sources tabs
- **Docs** tab — bundled operator wiki with search
- **Setup wizard** — first-run audit, backup discovery, schedule, optional 2FA
- Scheduled health reports (default twice daily) with report retention
- Always-on background ops scan (~60s) — logs, crashes, mod errors, activity, lag spikes
- Performance history and **Insights** (busy/quiet hours, heatmaps, CSV export)
- Spark profiler integration — Spark tab with on-demand profile parsing
- External backup heartbeat for panel/cloud backups (Settings → Backups wizard)
- Login + optional 2FA, version chip, update banner
- Hosted-panel metrics honesty (cgroup labels, trust badges)
- DR CLI + browser DR viewer
- NeoForge **1.21.x** line — `watchtower-neoforge-1.0.0+mc1.21.jar` · **GPL-3.0-or-later**

[Installation](https://github.com/djinnbanter/WatchTower/wiki/Installation) · [Dashboard](https://github.com/djinnbanter/WatchTower/wiki/Dashboard-Overview) · [Disaster Recovery](https://github.com/djinnbanter/WatchTower/wiki/Disaster-Recovery)

---

## Live vs full report

Watchtower uses **three update kinds** — you do not need a full health report every time you open the dashboard.

| Kind | What it does | When |
| ---- | ------------ | ---- |
| **Watching** (live) | TPS, MSPT, CPU, charts | ~every second |
| **Scanning** (light scan) | Crashes folder, always-on log tail (mod errors, activity, lag) | Background ~60s (`OPS_LOG_SCAN_SEC`) + Refresh buttons |
| **Auditing** (full report) | Complete Issues queue, mod analysis, audit snapshots | Manual, **Run full report**, or [scheduled reports](wiki/Scheduled-Reports.md) |

**Full guide:** [Understanding Data Sources](wiki/Understanding-Data-Sources.md)

**Still needs a scheduled or manual report:** full **Issues** action queue, deep **Mods** analysis, **Session** playtime/window stats, report history, DR audit quality.

**Works without a fresh report:** Live tab, crash folder scan, Activity ledger, lag investigations, mod log scan, backup rescan (after folder chosen).

---

## Planned releases

One theme per release, in order. Details may shift slightly before ship.

### 1.2.0 — Fleet hub

One view across **many servers** — compare TPS, issues, and backups without opening every `:8787` port.

### 1.3.0 — Fabric & alerts

- **Fabric 1.21** mod JAR — same dashboard and reports
- Optional **Discord / webhook alerts** for crashes, lag, stale backups, pregen stalls

### 1.4.0 — NeoForge 1.20.x

Second mod JAR for **1.20.x packs** — pick **`+mc1.20`** or **`+mc1.21`** at download. Same CLI and DR workflow.

---

## Out of scope

**Full player analytics** — retention cohorts, GeoIP, global playtime leaderboards, and whitelist/OP/kick/ban from the dashboard (use your panel or in-game commands).

**GPU / graphics driver crashes** — client-side `hs_err` patterns (NVIDIA, AMD, Intel graphics, OpenGL, audio drivers) don't apply to headless dedicated servers.

Watchtower **does** surface roster, report-window activity, and peak concurrent players for **ops triage** — who was online during lag or crashes — without replacing [Plan](https://www.playeranalytics.net/) or Pterodactyl. Server-wide busy/quiet hours ship on the **Insights** tab in **1.0.0**, not as a Session leaderboard product.

---

## Suggest a change

- [GitHub Issues](https://github.com/djinnbanter/WatchTower/issues)
- [Troubleshooting](https://github.com/djinnbanter/WatchTower/wiki/Troubleshooting)
- [Disaster Recovery](https://github.com/djinnbanter/WatchTower/wiki/Disaster-Recovery)

When a release ships, we update this page, the [wiki Roadmap](wiki/Roadmap.md), the [public Changelog](../CHANGELOG.md), and [wiki Changelog](wiki/Changelog.md).
