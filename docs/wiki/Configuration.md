# Configuration

Most settings live in the dashboard **Settings** menu. A few advanced options live in files on disk.

---

## Two places settings live

| Where | Restart needed? | How to edit |
|-------|-----------------|-------------|
| **Settings** (gear) | Usually no | Dashboard UI |
| `watchtower/watchtower.conf` | No | Settings or text editor |
| `config/watchtower-server.toml` | **Yes** | Text editor only |

**Rule of thumb:** backups and warnings → Settings or `watchtower.conf`. Optional legacy schedule → conf or `/watchtower schedule`. Dashboard port and live chart speed → TOML + restart.

---

## Settings panels

| Panel | What you can do |
|-------|-----------------|
| **General** | TPS / lag warning levels |
| **Monitoring** | Intervals, Modrinth lookup, retention (as shown) |
| **Backups** | Status + link to [[Backups]] tab |
| **Rules** | Crash / issue rule options |
| **Security** | Password, username, 2FA |
| **Advanced** | Advanced options |
| **About** | Version, Welcome tour entry |

Deep link: `?tab=settings&panel=monitoring` (and other panel ids).

Monitoring cadence also surfaces from [[Sources]] → Open monitoring settings.

---

## What needs a server restart

Edit `config/watchtower-server.toml` for:

| Setting | What it controls |
|---------|------------------|
| `dashboardPort` | Dashboard port (default 8787) |
| `dashboardBindHost` | `127.0.0.1` on public servers; `0.0.0.0` on LAN |
| `liveSampleIntervalSeconds` | How often live metrics are recorded |
| `liveRetentionHours` | How long chart history is kept |
| `commandPermissionLevel` | Minimum OP level for `/watchtower` commands |

Restart Minecraft after editing TOML.

---

## Optional legacy schedule

New installs default schedule **Off**. Day-to-day uses Watching + Scanning. If you still want legacy deep audits, see [[Health-Reports#Optional schedule (legacy deep audits)]].

---

## Related

- [[Sources]]
- [[Backups]]
- [[Security-and-Access]]
- [[On-disk-Files]]
- [[Commands]]
