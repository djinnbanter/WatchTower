# Health Reports

A **health report** is Watchtower’s main check: it reads logs, crashes, mods, backups, and server stats, then writes a short summary and detailed data files.

---

## At a glance

- **Run one:** **Run Report** in the dashboard, `/watchtower run`, or on a schedule — [[Scheduled Reports]]
- **Output files:** `watchtower-brief-*.txt` (readable) and `watchtower-facts-*.json` (for the dashboard) in `<server>/watchtower/`
- **Powers:** **Issues** fix list, deep **Mods** analysis, **Activity** history, and more
- **Faster reruns:** “Incremental” mode only scans since the last report when enabled in Settings

---

## What happens during a report

1. Watchtower scans your server’s logs, crash folder, mod list, backups, and machine stats
2. Rule-based checks find problems (no AI, no cloud)
3. A text summary and JSON file are saved with a timestamp
4. `DR-README.txt` is updated with recovery instructions

---

## How to run a report

| Method | When to use |
|--------|-------------|
| **Run Report** button | Easiest — in the dashboard top bar |
| **Setup wizard** initial audit | First visit — 30-day baseline report runs automatically |
| `/watchtower run [hours]` | From console — optional hours of history |
| Scheduled reports | Hands-off — Settings → General |

**Recommended first report:** 30 days — use the setup wizard on first login, or `/watchtower run 720`, or **Run Report** with a 720h lookback in Settings.

---

## Output files

| File | Purpose |
|------|---------|
| `watchtower-brief-*.txt` | Human-readable summary — start here |
| `watchtower-facts-*.json` | Data the dashboard loads |
| `DR-README.txt` | Emergency recovery command |

In-game summary: `/watchtower brief`

---

## Reports vs live charts vs background scan

| Type | What it does |
|------|----------------|
| **Live charts** | Updates while dashboard is open |
| **Background scan** | Logs, crashes, recent activity ~every minute |
| **Full report** | Complete fix list and deep analysis — run on a schedule |

You do not need a full report every visit, but schedule them regularly for a useful **Issues** tab and history.

---

## Incremental reports

When **Incremental scans** is on in **Settings → General**:

- Only new logs/events since the last report are scanned
- Faster on large servers
- Small overlap prevents gaps at boundaries

---

## Problem types you might see

In **Issues** and `/watchtower issues`:

| ID | Plain English |
|----|----------------|
| `SERVER_DOWN` | Server not running |
| `OOM` | Ran out of memory |
| `CRASH_REPORT` | Crash files on disk |
| `DISK_HIGH` | Disk almost full |
| `TICK_LAG` / `MSPT_HIGH` / `TPS_LOW` | Server struggling to keep up |
| `BACKUP_NOT_CONFIGURED` | Backup location not set |
| `BACKUP_STALE` | No recent backup |
| `MOD_UPDATE_CONFLICT` | Mod version problems |

Full list in technical appendix below.

---

## Technical details

### Facts JSON sections

| Section | Contains |
|---------|----------|
| `meta` | Hostname, time, lookback |
| `health` | Overall status |
| `issues` | Problems with fix steps |
| `events` | Activity timeline data |
| `minecraft` | TPS, MSPT, players, mods |
| `system` | CPU, RAM, disk |

### All issue IDs

`SERVER_DOWN`, `ABNORMAL_STOP`, `OOM`, `CRASH_REPORT`, `DISK_HIGH`, `MEM_LOW`, `TICK_LAG`, `MSPT_HIGH`, `TPS_LOW`, `LOG_STALE`, `PANEL_DOWN`, `MOD_LOAD_FAILED`, `MOD_UPDATE_CONFLICT`, `BACKUP_NOT_CONFIGURED`, `BACKUP_NOT_FOUND`, `BACKUP_STALE`, `MANUAL_REBOOT`, `DH_PREGEN_THROTTLE`, `DH_PREGEN_STALL`. DR-only: `CRASH_LOOP`, `MISSING_CRASH_REPORT`.

---

## See also

- [[Commands]]
- [[Scheduled Reports]]
- [[Dashboard Tabs#Issues]]
- [[On-disk Files]]
