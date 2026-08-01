# Health Reports

Day-to-day tabs stay current via **Watching** and **Scanning** — [[Understanding-Data-Sources]]. This page is about **Support packs** (shareable zips) and an **optional** legacy schedule.

---

## At a glance

| Mode | Plain English |
|------|----------------|
| **Day-to-day** | Watching + Scanning — no homework |
| **Support pack** | Zip when you need to share with a host or mod author |
| **Optional schedule** | Legacy deep audits — off on new installs |

---

## Day-to-day vs share

| Day-to-day | Share |
|------------|-------|
| Live, Issues, Crashes, Mods stay current | Frozen zip + brief for someone else |
| Open [[Sources]] for freshness | Rail **Build support pack** |

---

## Support pack entry points

Use these (Support lives on the rail — not under Settings → Integrations):

1. Rail footer **Build support pack**
2. Overview **Support pack** card
3. Help Center hub **Build pack**
4. Console: `/watchtower run` or `/watchtower diagnostics`

> **Coming soon:** the in-app downloadable zip may still be finishing on some builds. Console compose and on-disk outputs remain the reliable path when the UI download is not ready yet.

### Chooser (dashboard)

Pick a **pack type** (Quick, Server issue, WatchTower bug, or Full evidence), add an optional note for whoever opens the zip, and download. **Customize files…** is optional if you need specific logs or crashes. There is no separate "what's going on?" step — the pack type is the decision.

Before download, WatchTower checks for a log, mod list, and crash coverage when relevant. Yellow warnings don't block you; **Download anyway** notes them in the zip.

### What goes in a pack (intent)

Environment, redacted ops/config, optional logs/crashes/Spark, synthesized support facts + brief **for the zip only**. Never includes dashboard auth, world data, backups, or mod jars. Spark profiles are binary and unredacted when included.

**How to read the zip:** server issues → `PROBLEM.txt` → `report/brief.txt` → `evidence/`; Watchtower bugs → `environment.json` → redacted conf → ops-cache.

---

## Problem types you might see

In [[Issues]] and `/watchtower issues` (examples):

| ID | Plain English |
|----|----------------|
| `SERVER_DOWN` | Server not running |
| `OOM` | Ran out of memory |
| `CRASH_REPORT` | Crash files on disk |
| `DISK_HIGH` | Disk almost full |
| `TICK_LAG` / `MSPT_HIGH` / `TPS_LOW` | Server struggling |
| `BACKUP_*` | Backup not configured / missing / stale |
| `MOD_UPDATE_CONFLICT` | Mod version problems |

---

## Optional schedule (legacy deep audits)

Automatic legacy deep audits are **optional**. New installs default schedule **Off**. Watching / Scanning cover day-to-day — you do not configure a deep audit schedule in Settings.

| Command | Effect |
|---------|--------|
| `/watchtower schedule show` | Show current mode |
| `/watchtower schedule set 60` | Interval example (minutes) |
| `/watchtower schedule off` | Turn off |

Needs OP level 2 by default. Or edit `watchtower/watchtower.conf`:

| Key | Default (new installs) | Notes |
|-----|------------------------|-------|
| `REPORT_SCHEDULE_MODE` | `off` | `wall_clock`, `interval`, or `off` |
| `REPORT_WALL_CLOCK_HOURS` | `0,12` | Hours 0–23, server local time |
| `REPORT_INTERVAL_MINUTES` | `720` | When mode is `interval` |

Scheduled runs write legacy `watchtower-facts-*.json` / `watchtower-brief-*.txt`. They do **not** replace Live charts. Upgrades keep existing schedules unless you turn them off.

---

## Related

- [[Understanding-Data-Sources]]
- [[Sources]]
- [[Commands]]
- [[Configuration]]
- [[Troubleshooting]]
