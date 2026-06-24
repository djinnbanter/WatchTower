# On-disk Files

**Where Watchtower saves things** on your server. Most files live in `<server>/watchtower/`. You rarely need to edit them by hand — use the dashboard and Settings instead.

---

## Quick reference

| Path | In plain English |
|------|------------------|
| `watchtower/watchtower.conf` | Schedule, backups, warnings — edit via **Settings** |
| `config/watchtower-server.toml` | Dashboard port, chart speed — needs restart |
| `watchtower/watchtower-facts-*.json` | Health report data for the dashboard |
| `watchtower/watchtower-brief-*.txt` | Human-readable report summary |
| `watchtower/live-history.json` | Live chart history (seconds) |
| `watchtower/performance-rollups.json` | Minute-by-minute history for **Insights** |
| `watchtower/dashboard-auth.json` | Login accounts (hashed) — use **Settings → Security** |
| `watchtower/DR-README.txt` | Emergency recovery command — updated each report |

---

## `watchtower/` folder layout

```text
watchtower/
  dashboard-auth.json       # Login + 2FA (do not edit by hand)
  watchtower.conf           # Settings file
  snapshot.json             # Quick TPS/lag snapshot
  live-history.json         # Live chart data
  performance-rollups.json  # Insights history
  watchtower-brief-*.txt    # Report summaries
  watchtower-facts-*.json   # Report data for dashboard
  ops-cache.json            # Background scan cache
  DR-README.txt             # Recovery instructions
  .watchtower-state.json    # Internal state (acks, cursors)
```

---

## What not to delete casually

| File | If deleted |
|------|------------|
| `dashboard-auth.json` | Default login recreated on next start |
| `.watchtower-state.json` | Loses crash review marks, incremental progress |
| `live-history.json` | Live charts start empty (rebuild over time) |
| `watchtower-facts-*.json` | That report disappears from dashboard history |

---

## Technical details

### `dashboard-auth.json`

Username, bcrypt password hash, TOTP secrets (encrypted), recovery codes.

### `snapshot.json`

Lightweight TPS/MSPT snapshot every ~60s (`sampleIntervalSeconds` in TOML).

### `live-history.json`

One sample per second with tiered retention; flushed per `liveFlushIntervalSeconds`.

### `.watchtower-state.json`

Last report time for incremental scans, acknowledged crashes, ignored client mods, trend samples for `/watchtower status`.

### `config/watchtower-server.toml`

NeoForge mod config — restart required. See [[Configuration]].

---

## See also

- [[Configuration]]
- [[Health Reports]]
- [[Security and Access]]
