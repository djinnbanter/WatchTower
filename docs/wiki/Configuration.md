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
| **General** | Identity (read-only), update check, metrics banner, legacy lookback / incremental |
| **Monitoring** | TPS / MSPT thresholds, performance baseline, Spark auto-capture on lag, ops/log scan intervals |
| **Backups** | Local folder + external panel tracking |
| **Alerts** | Disk warn / fill / write latency, report retention |
| **Security** | Your password, username, 2FA |
| **Accounts** | Owner-only: add people, change roles, reset passwords ([[Accounts-And-Audit-Log]]) |
| **Audit log** | Who changed settings, acks, suppressions, accounts, and sign-ins (owner/admin) |
| **Integrations** | Modrinth lookup / auto-scan, Spark enabled |
| **About** | Install facts + relaunch setup wizard |

Deep link: `?tab=settings&panel=monitoring` (and other panel ids). Older links `panel=rules` / `panel=advanced` redirect to **Alerts** / **Integrations**.

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

## Weekly ops digest

Local weekly summary on [[Insights]] → Digest and a dismissible [[Dashboard-Overview]] teaser. Keys live in `watchtower/watchtower.conf` (defaults are fine for most servers):

| Key | Default | Meaning |
|-----|---------|---------|
| `WEEKLY_DIGEST_ENABLED` | `true` | Kill-switch — set `false` to stop auto and manual generate |
| `WEEKLY_DIGEST_INTERVAL_DAYS` | `7` | Minimum days between automatic digests |
| `WEEKLY_DIGEST_HISTORY_MAX` | `8` | Max digests kept in `ops-cache.json` (newest first) |

HTTP: `GET` / `POST /api/weekly-digest` — see [[HTTP-API]].

---

## Pack drift and client-only Issues

| Key | Default | Meaning |
|-----|---------|---------|
| `MOD_JAR_DRIFT_ENABLED` | `true` | Hash jars (SHA-512) and raise `MOD_JAR_DRIFT` when the same filename + version gets a different hash |
| `CLIENT_ON_SERVER_ISSUES_ENABLED` | `true` | Promote high-confidence `likely_removable` side scores into continuous Issues (`CLIENT_ON_SERVER:{mod_id}`) |

See [[Issues]] (Jar drift / Client-only jars) and [[Mods]].

---

## External kill detection

| Key | Default | Meaning |
|-----|---------|---------|
| `EXTERNAL_KILL_DETECT_ENABLED` | `true` | After an abrupt stop (no clean shutdown, no crash report), classify OS OOM-killer vs panel force-kill on the next boot |

Surfaces on the Crashes tab as `failure_kind: external_kill` (Killed chip) and as Issues `EXTERNAL_KILL:{subtype}`. Fix text for OOM points at Insights → Configs (RAM advisor); panel subtype points at stop/watchdog timeout settings.

---

## Restart hygiene advisor

| Key | Default | Meaning |
|-----|---------|---------|
| `RESTART_HYGIENE_ENABLED` | `true` | Correlate long JVM uptime with rising GC/heap vs the prior 12h and suggest the next quiet window on Overview |

Advisory only — Watchtower never starts or schedules a restart. Suppresses when uptime is under 36h, metrics look healthy, or sample coverage is thin. Quiet-window timestamps in the API are UTC ISO instants.

### Dashboard timezone (browser-local)

Settings → **Timezone** stores `{ mode, zone }` under `wt-timezone` in the browser (modes: `browser`, `utc`, `iana`). It does **not** change server config or rollup storage — Insights Schedule heatmaps and Overview restart-hygiene times convert UTC cells for display. Invalid IANA values fall back to the browser zone. Relative ages (“3h ago”) are unchanged.

---

## Silent-fail detection (scripts / datapacks)

| Key | Default | Meaning |
|-----|---------|---------|
| `SILENT_FAIL_DETECT_ENABLED` | `true` | Raise continuous Issues for KubeJS, CraftTweaker, datapack JSON parse, and `/reload` failure signatures in `latest.log` |

Surfaces on Issues as `SILENT_FAIL:{kind}:…` under **Script & datapack failures**. Path/line is captured only when present on the same trigger line. Does not edit scripts. See [[Script-Failed-Silently]].

---

## World pressure (entity / chunk census)

| Key | Default | Meaning |
|-----|---------|---------|
| `WORLD_PRESSURE_ENABLED` | `true` | Per-dimension entity/chunk census + farm/chunk-loader classifiers as Issues and Insights → World |

## Join clinic (pack sync rejections)

| Key | Default | Meaning |
|-----|---------|---------|
| `JOIN_CLINIC_ENABLED` | `true` | Surfaces Forge/NeoForge/Fabric join rejections as Session → Join clinic + Issues (`JOIN_SYNC`) — read-only |
| `liveWorldCensusIntervalSeconds` | `60` | NeoForge mod config — how often the tick-thread census runs (30–600) |

Read-only: never kills entities or unloads chunks. Classifiers use sustained windows vs quiet-hours baselines. See [[World-Pressure]].

---

## Related

- [[Sources]]
- [[Backups]]
- [[Security-and-Access]]
- [[Accounts-And-Audit-Log]]
- [[On-disk-Files]]
- [[Commands]]
