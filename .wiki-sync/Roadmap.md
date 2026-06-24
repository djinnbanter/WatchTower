# Roadmap

**What Watchtower does today and what is planned next** — in plain terms. Everything runs on your server; no cloud account required.

Releases ship when ready (no fixed dates). **Latest:** **1.0.0** · [[Downloads and Releases]] · [[Changelog]]

**Platform today:** NeoForge **1.21.x**. Fabric and older NeoForge lines are planned later.

---

## 1.0.0 — Shipped

First public release — the complete ops toolkit:

- Live dashboard (`:8787`) — Overview, Live, Insights, Issues, Crashes, Mods, Backups, Activity, Session, Spark, Sources
- **Docs** tab — bundled operator wiki with search
- **Setup wizard** — first-run audit, backups, schedule, optional 2FA
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

### 1.0.1 — Smarter mod list

- Stop flagging Create (and similar server mods) as removable
- Optional Modrinth lookup for ambiguous jars — off by default
- Dependency tree — see why a mod is protected

### 1.0.2 — Crash & DR intelligence

- Fewer “unknown” crashes — real NeoForge stack attribution
- Watchdog stalls explained — pregen, contraptions, map render
- DR Fix tab matches the crash across dashboard, CLI, and DR viewer
- Startup boot profile — boot time, slowest phase, warnings trend

### 1.0.3 — Crash inbox

- Group identical crashes into one row
- Mark all reviewed in one click
- Notification bell on Overview (precursor to Discord alerts in **1.2.0**)

### 1.0.4 — Release engineering

Internal only — shared mod module for multiple Minecraft JARs. No operator-facing changes.

### 1.0.5 — Boot & mixin intelligence

Names boot-time failures (mixin, loader, ecosystem patterns) as facts and brief text — mixin owner, conflicting mixins, duplicate jars, corrupt TOML, Create/Epic Fight/AzureLib fingerprints, and more.

### 1.0.6 — Mod forensics

Find owning jar from stack trace, corrupt jar detection, broken serverconfig scan, MCreator/Fabric-in-jar badges.

### 1.0.7 — Custom crash rules

YAML rule packs under `config/watchtower/rules/`, builtin corpus, issue suppressions, `watchtower rules validate` CLI.

### 1.1.0 — Fleet hub

One view across many servers — compare TPS, issues, and backups.

### 1.2.0 — Fabric & alerts

Fabric 1.21 mod JAR; optional Discord/webhook alerts for crashes, lag, stale backups.

### 1.3.0 — NeoForge 1.20.x

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
