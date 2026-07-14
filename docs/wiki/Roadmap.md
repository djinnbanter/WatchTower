# Roadmap

**What Watchtower does today and what is planned next** — in plain terms. Everything runs on your server; no cloud account required.

Releases ship when ready (no fixed dates). **Latest:** **1.1.0** · [[Downloads and Releases]] · [[Changelog]]

**Platform today:** NeoForge **1.21.x**. Fabric and older NeoForge lines are planned later.

---

## 1.1.0 — Shipped

Ops intelligence and dashboard polish since **1.0.0** / **1.0.0a** (former planned **1.0.1–1.0.8** themes):

- Smarter mod list, crash/DR intelligence, Startup profile, crash inbox
- Mod forensics, crash rule packs, glass UI, Backups setup + **Not tracking**
- Overview welcome, Insights Patterns sub-panels, Session roster polish
- Issues Reviewed tab, Logs viewer, setup wizard audit, short guided tour

Artifacts: `watchtower-neoforge-1.1.0+mc1.21.jar` · `watchtower-cli-1.1.0.jar`

---

## 1.0.0 — Shipped

First public release — the complete ops toolkit:

- Live dashboard (`:8787`) — Overview, Live, Insights, Issues, Crashes, Mods, Backups, Activity, Session, Spark, Sources
- **Docs** tab — bundled operator wiki with search
- **Setup wizard** — first-run audit, backup discovery, schedule, optional 2FA
- Scheduled health reports (default twice daily) with report retention
- Always-on background scan (~60s) for logs, crashes, mod errors, activity, lag spikes
- Performance history and **Insights** tab (busy/quiet hours, heatmaps, CSV export)
- Spark profiler integration — Spark tab with on-demand profile parsing
- External backup heartbeat for panel/cloud backups (**Settings → Backups** wizard)
- Login + optional 2FA, version chip, update banner
- Hosted-panel metrics honesty (cgroup labels, trust badges)
- DR CLI + [[DR Viewer]]
- NeoForge **1.21.x** — `watchtower-neoforge-1.0.0+mc1.21.jar` · **GPL-3.0-or-later**

[[Installation]] · [[Dashboard Overview]] · [[Disaster Recovery]]

---

## Live vs full report

Watchtower uses **three update kinds** — you do not need a full health report every time you open the dashboard.

| Kind | Plain English | When |
| ---- | ------------- | ---- |
| **Live** | Charts while you watch | Every few seconds while dashboard is open |
| **Background scan** | Logs, crashes, recent activity | About once a minute while server runs |
| **Full report** | Complete fix list and deep mod check | When you run a report or on a schedule |

Open the **Sources** tab to see when each layer last updated. See [[Understanding-Data-Sources]].

**Still needs a full report:** complete **Issues** queue, deep **Mods** analysis, **Session** playtime stats, report history.

**Works without a fresh report:** Live tab, crash folder scan, Activity ledger, lag investigations, mod log scan, backup rescan.

---

## Planned releases

### 1.2.0 — Fleet hub

One view across many servers — compare TPS, issues, and backups.

### 1.3.0 — Fabric & alerts

Fabric 1.21 mod JAR; optional Discord/webhook alerts for crashes, lag, stale backups.

### 1.4.0 — NeoForge 1.20.x

Second mod JAR for **1.20.x packs** — pick `+mc1.20` or `+mc1.21` at download.

---

## Out of scope

**Full player analytics** — retention cohorts, GeoIP, global playtime leaderboards, whitelist/OP/kick/ban from the dashboard.

**GPU / graphics driver crashes** — client-side patterns don't apply to headless dedicated servers.

Watchtower **does** surface roster, report-window activity, and peak concurrent players for **ops triage** — who was online during lag or crashes — without replacing [Plan](https://www.playeranalytics.net/) or Pterodactyl. Server-wide busy/quiet hours live on the **Insights** tab in **1.0.0**.

---

## Suggest a change

- [GitHub Issues](https://github.com/djinnbanter/WatchTower/issues)
- [[Troubleshooting]]
- [[Disaster Recovery]]
