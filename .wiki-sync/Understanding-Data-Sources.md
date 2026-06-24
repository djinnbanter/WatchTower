# Understanding Data Sources

Watchtower updates information in **three ways**. You do **not** need to run a full health report every time you open the dashboard.

---

## At a glance

| Kind | Plain English | When it updates |
| ---- | ------------- | --------------- |
| **Live** | Charts while you watch | Every few seconds while the dashboard is open |
| **Background scan** | Logs, crashes, recent activity | About once a minute while the server runs |
| **Full report** | Complete fix list and deep mod check | When you run a report or on a schedule |

**Short version:** charts refresh while you are looking. The server keeps checking logs and crashes in the background even when nobody has the dashboard open. A **full report** is the deep check — run it on a schedule (e.g. every hour), not every visit.

Open the **Sources** tab to see when each layer last updated on your server.

---

## What needs a full report?

| Feature | Background enough? | Needs full report? |
| ------- | ------------------ | ------------------ |
| Live charts | Yes | No |
| Crash list (basic) | Yes | Deeper details from last report |
| Recent activity | Yes | Older history from reports |
| Lag spike notes | Yes | No |
| **Issues — full fix list** | No | **Yes** |
| **Mods — full list and conflicts** | Partial (log errors) | **Yes** for deep analysis |
| Who is online now | Yes | Playtime stats from report |
| Backups (after setup) | Yes (rescan) | First setup from report |
| Report history | No | **Yes** |

---

## In the dashboard

| Where to look | What it shows |
| ------------- | ------------- |
| **Sources tab** | When live, background scan, and last report ran |
| **Badges on cards** | Live / Scanned / Report / Mixed |
| **Text under tab titles** | One-line explanation of where data comes from |
| **Settings → Monitoring** | Read-only list of intervals and retention |

---

## Technical details

### Files on disk

| File | Layer | Written by |
| ---- | ----- | ---------- |
| `live-history.json` | Live | Metrics while dashboard samples |
| `performance-rollups.json` | Minute history | Once per minute |
| `ops-cache.json` | Background scan | Log and crash checks (~60s) |
| `incidents/*.json` | Lag snapshots | Auto lag detection |
| `watchtower-facts-*.json` | Full report | Manual or scheduled report |

### Settings that control timing

| What | Where to change |
| ---- | --------------- |
| Live chart sample rate | `config/watchtower-server.toml` (restart required) |
| Background scan interval | `watchtower/watchtower.conf` or Settings |
| Report schedule | **Settings → General** |

---

## See also

- [[Health Reports]] — what a full report contains
- [[Scheduled Reports]] — automate full reports
- [[Dashboard Tabs]] — per-tab behaviour
- [[Roadmap]] — upcoming improvements
