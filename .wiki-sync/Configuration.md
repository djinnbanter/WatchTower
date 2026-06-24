# Configuration

Most settings are changed in the dashboard **Settings** menu. A few advanced options live in config files on disk.

---

## Two places settings live

| Where | Restart needed? | How to edit |
|-------|-----------------|-------------|
| **Settings (gear icon)** | No | Dashboard UI |
| `watchtower/watchtower.conf` | No | Settings or text editor |
| `config/watchtower-server.toml` | **Yes** | Text editor only |

**Rule of thumb:** schedule, backups, warnings → Settings or `watchtower.conf`. Dashboard port and live chart speed → TOML file + restart.

---

## Change in Settings (no restart)

Open **Settings** for:

- **General** — report schedule, how far back to look, TPS/lag warning levels
- **Backups** — where backups live (folder or panel)
- **Security** — password, 2FA
- **Monitoring** — read-only view of check intervals

These save to `watchtower/watchtower.conf` immediately.

---

## What needs a server restart

Edit `config/watchtower-server.toml` for:

| Setting | What it controls |
|---------|------------------|
| `dashboardPort` | Dashboard port (default 8787) |
| `dashboardBindHost` | `127.0.0.1` on public servers; `0.0.0.0` on LAN |
| `liveSampleIntervalSeconds` | How often live metrics are recorded |
| `liveRetentionHours` | How long chart history is kept (default 90 days) |
| `commandPermissionLevel` | Minimum OP level for `/watchtower` commands |

Restart the Minecraft server after editing TOML.

---

## Common tasks

| I want to… | Do this |
|------------|---------|
| Turn on automatic reports | **Settings → General** |
| Point at backup folder | **Backups** tab or **Settings → Backups** |
| Set up panel/cloud backups | **Settings → Backups** wizard |
| Fix wrong hosting panel detection | `PANEL` in `watchtower.conf` — see [[Hosting Panels]] |
| Hide dashboard from the internet | `dashboardBindHost = "127.0.0.1"` in TOML — see [[Security and Access]] |

---

## Technical details — `watchtower.conf` keys

### Reports and schedule

| Key | Purpose |
|-----|---------|
| `REPORT_INTERVAL_MINUTES` | Minutes between reports (0 = off) |
| `REPORT_SCHEDULE_MODE` | `wall_clock`, `interval`, or `off` |
| `REPORT_WALL_CLOCK_HOURS` | Hours to run (e.g. `0,12`) |
| `LOOKBACK_HOURS` | Log window per report (1–720) |
| `INCREMENTAL` | Only scan since last report |

### Background checks

| Key | Default | Purpose |
|-----|---------|---------|
| `OPS_LOG_SCAN_SEC` | `60` | Log and crash folder check interval |
| `OPS_POLL_SEC` | `60` | Extra refresh while dashboard open |
| `REPORT_RETENTION_COUNT` | `30` | Keep last N reports |
| `REPORT_RETENTION_DAYS` | `90` | Max report age |

### Backups

| Key | Purpose |
|-----|---------|
| `BACKUP_DIRS` | Comma-separated backup folders |
| `BACKUP_WEBHOOK_TOKEN` | Panel heartbeat after backup |
| `BACKUP_EXTERNAL_MARKER` | Path to status JSON file |
| `PANEL` | `auto`, `none`, or panel id |

### Warning thresholds

`TPS_WARN`, `MSPT_WARN`, `DISK_WARN_PCT`, `LOG_STALE_MINUTES`, and others — see [watchtower.conf.example](https://github.com/djinnbanter/WatchTower/blob/main/tools/watchtower.conf.example).

Full TOML table: see previous maintainer docs in repository `watchtower-server.toml` defaults.

---

## See also

- [[Scheduled Reports]]
- [[Hosting Panels]]
- [[Security and Access]]
