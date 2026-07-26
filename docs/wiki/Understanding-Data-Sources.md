# Understanding Data Sources

Watchtower updates information in **two continuous layers**, plus **Support compose** when you ask for a zip. You do **not** need a manual deep audit for day-to-day dashboard use.

---

## At a glance

| Kind | Plain English | When it updates |
| ---- | ------------- | --------------- |
| **Watching** | Charts and vitals | Every ~1 second while the **server** runs (dashboard open or not) |
| **Scanning** | Logs, crashes, activity, continuous Issues, mods deltas | About once a minute while the server runs |
| **Support compose** | Frozen support zip + synthesized brief for sharing | On request — rail **Build support pack**, Overview / Help Center **Support pack**, `/watchtower run`, or `/watchtower diagnostics` |

**Short version:** Watching + Scanning keep the dashboard useful. Support compose is for sharing a snapshot with your host or mod authors — not day-to-day tab truth.

Open the **Sources** tab to see when each layer and job last updated, and when the next pull is due. How-to: [[Sources]]. Theory lives on this page.

### First-run Initial discovery

On first setup, after you change the default account, Welcome can enable Modrinth (optional), then may run a **blocking Initial discovery** — a full deep audit baseline before you continue. **Next** stays locked until it finishes. After that, Watching + Scanning keep tabs current with deltas.

---

## Which tabs use which layer?

| Tab / feature | Watching | Scanning | Support compose |
| ------------- | -------- | -------- | --------------- |
| Live charts / Overview vitals | Yes | — | No |
| Issues Active fix list | Live peeks | Ledger | Optional export |
| Crashes list + Fix hints | — | Yes | Zip adds extra context |
| Activity timeline | — | Yes | Optional |
| Mods inventory / updates | — | Yes | Optional |
| Session online roster | Poll | Playtime deepens | Optional |
| Backups freshness | — | Scan job | Optional |
| Share zip with host | — | — | **Yes** |

Legacy deep-audit facts on disk (older installs or optional schedule) are still read when present, but day-to-day tabs do not depend on them. Optional schedule: [[Health-Reports]].

---

## In the dashboard

| Where to look | What it shows |
| ------------- | ------------- |
| **Sources** tab | Watching / Scanning / Support compose freshness + job grid |
| Badges on cards | Live / Scanning / Mixed |
| Rail **Build support pack** | Compose a support bundle |
| Help Center / Overview Support card | Same compose flow |
| **Settings → Monitoring** | Intervals and retention |

> **Do not confuse** Ops **Sources** (pollers) with Spark → **Sources** (which mod owns profile time). Spark details: [[Using-Spark-with-Watchtower]].

---

## Technical details

### Files on disk

| File | Layer | Written by |
| ---- | ----- | ---------- |
| `live-history.json` | Watching | Metrics while server samples |
| `performance-rollups.json` | Minute history | Once per minute |
| `ops-cache.json` | Scanning | Log/crash/issues_live (~60s) + delta jobs |
| `incidents/*.json` | Lag snapshots | Auto lag detection |
| `watchtower-facts-support-*.json` | Support compose only | Not BAU dashboard master |
| `watchtower-facts-*.json` (legacy) | Old deep audits | Upgrades / optional schedule only |

### Settings that control timing

| What | Where to change |
| ---- | --------------- |
| Live chart sample rate | `config/watchtower-server.toml` (restart required) |
| Background scan interval | `watchtower/watchtower.conf` or Settings → Monitoring |
| Activity gap backfill | `ACTIVITY_GAP_*` in `watchtower.conf` |
| Mods deep delta jobs | `MODS_DEEP_*` in `watchtower.conf` |
| Legacy report schedule | `watchtower.conf` or `/watchtower schedule` (new installs default **Off**) |

---

## Glossary (short)

| Term | Meaning |
| ---- | ------- |
| **Watching** | Live telemetry layer for charts and vitals |
| **Scanning** | ~60s ops layer for logs, crashes, Issues, mods |
| **Support compose** | On-demand zip for sharing |
| **Help Center** | Built-in guides (rail tab) |
| **TPS** | Ticks per second — 20 is healthy |
| **Tick lag (MSPT)** | Milliseconds per tick — lower is better |
| **Heap** | Java memory the game uses |
| **Issues** | Fix inbox from continuous Scanning |
| **Sources (Ops)** | Poller health and next pull |
| **Spark profile** | Capture of where server time went during lag |
| **Spark Sources** | Profile sub-tab — mod/source attribution (not Ops Sources) |
| **Freshness** | How recently a layer or job updated |
| **Poller** | Background job that pulls one kind of data |
| **Welcome tour** | Skippable first-run walkthrough (`?tab=wizard`) |
| **Backup tracking** | Folder / webhook Watchtower watches — or Not tracking |
| **Crash group** | Fingerprinted crash family on Crashes |
| **Modrinth lookup** | Optional online mod metadata |
| **Config audit** | Startup / Insights check of JVM and conf |
| **DR bundle** | Disaster-recovery zip from the CLI tool |
| **Ops scan** | One Scanning cycle writing ops-cache |

---

## Related

- [[Sources]] — freshness how-to
- [[Health-Reports]] — Support packs & optional schedule
- [[Dashboard-Tabs]] — where to click
- [[Commands]] — `/watchtower run` and diagnostics
