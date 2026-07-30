# Dashboard Tabs

Find the right rail tab in under 30 seconds. Each row links to a dedicated guide where one exists.

---

## Rail map

Tabs are grouped as **Monitor**, **Triage**, **Ops**, and **System**. Theme, skin, and collapse sit under System tools. **Visual Lab** is a developer gallery — not covered here. **Welcome** is a skippable tour (`?tab=wizard`); see [[Quick-Start-Checklist]].

---

## When to open

| If you need… | Open |
|--------------|------|
| Health grade, attention queue, where to look next | [[Dashboard-Overview|Overview]] |
| TPS / lag / host right now | [[Live-Charts|Live]] |
| Patterns, weekly digest, world pressure, config health, mod churn, storage trends | [[Insights]] |
| Who is online, peaks, playtime directory, session activity | [[Session]] · [[Join-Clinic]] |
| Last boot verdict and phases | [[Startup]] |
| Fix inbox | [[Issues]] |
| Crash groups and next steps | [[Crashes]] |
| Lag proof from a profiler capture | [[Using-Spark-with-Watchtower|Spark]] |
| Raw log files with filters | [[Logs]] |
| Mod inventory, updates, conflicts | [[Mods]] |
| Backup freshness and setup | [[Backups]] |
| Commands, joins, lag, jobs timeline | [[Activity]] |
| Poller health / next data pull | [[Sources]] |
| Guides and troubleshooting | **Help Center** (this wiki) |
| Thresholds, retention, security, accounts | **Settings** |

---

## Monitor

| Tab | One-line job | Guide |
|-----|--------------|-------|
| **Overview** | Mission control — grade, attention, teasers | [[Dashboard-Overview]] |
| **Live** | Right-now ops console for tick and host signals | [[Live-Charts]] |
| **Insights** | Patterns over a window — not the live second. Sub-views include Patterns, Configs, Mod changes, **World** (entity/chunk pressure), Storage, Digest | [[Insights]] · [[World-Pressure]] |
| **Session** | Online roster, peaks, directory, **Session activity** (joins / leaves / pack-sync rejects) | [[Session]] · [[Join-Clinic]] |
| **Startup** | Last boot, phases, history | [[Startup]] |

---

## Triage

| Tab | One-line job | Guide |
|-----|--------------|-------|
| **Issues** | Active fix inbox | [[Issues]] |
| **Crashes** | Fingerprint groups + Fix / Evidence | [[Crashes]] |
| **Spark** | Read `.sparkprofile` captures during lag | [[Using-Spark-with-Watchtower]] |
| **Logs** | Browse server log files | [[Logs]] |

---

## Ops

| Tab | One-line job | Guide |
|-----|--------------|-------|
| **Mods** | Inventory, updates, conflicts, Modrinth, forensics | [[Mods]] |
| **Backups** | Freshness, archives, Step A/B checklist | [[Backups]] |
| **Activity** | Timeline of commands, joins, lag, jobs | [[Activity]] |
| **Sources** | Watching / Scanning / Support pollers | [[Sources]] |

> **Name clash:** Ops **Sources** = poller health. Spark → **Sources** = which mod owns profile time. Different places.

---

## System — Help Center

| Tab / tool | Job |
|------------|-----|
| **Help Center** | Guides, search, Support pack shortcut |
| **Settings** | General, Monitoring, Backups, Alerts, Security, Accounts, Audit log, Integrations, About |
| **Roadmap** | Works / coming / later / not our job |
| **Welcome** | Skippable tour — not a daily tab |
| Theme / Collapse | Appearance and rail width |

**Settings panels:** General · Monitoring · Backups · Alerts · Security · Accounts · Audit log · Integrations · About (`?tab=settings&panel=<id>`). Accounts is owner-only; Audit log is owner/admin. See [[Accounts-And-Audit-Log]].

---

## Related

- [[Understanding-Data-Sources]] — Watching vs Scanning vs Support
- [[Troubleshooting]] — symptom → tab
- [[Dashboard-Overview]] — first stop after login
