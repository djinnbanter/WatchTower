# On-disk Files

**Where Watchtower saves things** on your server. Most files live in `<server>/watchtower/`. You rarely need to edit them by hand — use the dashboard and Settings instead.

---

## Quick reference

| Path | In plain English |
|------|------------------|
| `watchtower/watchtower.conf` | Backups, warnings, optional legacy schedule — most keys via **Settings**; schedule via conf or `/watchtower schedule` |
| `config/watchtower/rules/*.yaml` | Optional crash rule packs — [[Crash-Rule-Packs]] |
| `config/watchtower-server.toml` | Dashboard port, chart speed — needs restart |
| `watchtower/watchtower-facts-*.json` | Health report data for the dashboard |
| `watchtower/watchtower-brief-*.txt` | Human-readable report summary |
| `watchtower/live-history.json` | Live chart history (seconds) |
| `watchtower/performance-rollups.json` | Minute-by-minute history for **Insights** |
| `watchtower/dashboard-auth.json` | Named accounts (schema 2, hashed) — **Settings → Security** / **Accounts** |
| `watchtower/audit-log.jsonl` | Settings / ack / account / sign-in / mod disable ledger — **Settings → Audit log** |
| `mods/*.jar.disabled` | Soft-disabled jars (WatchTower **Mods → Disable**; loader ignores until Enable + restart) |
| `watchtower/restore-verify/` | Test-restore sandboxes only (1.1.20); never the live world |
| `watchtower/DR-README.txt` | Emergency recovery command — updated each report |

---

## `watchtower/` folder layout

```text
watchtower/
  dashboard-auth.json       # Schema 2 accounts + 2FA (do not edit by hand)
  audit-log.jsonl           # Append-only audit ledger (2000 / 90 days)
  watchtower.conf           # Settings file
  snapshot.json             # Quick TPS/lag snapshot
  live-history.json         # Live chart data
  performance-rollups.json  # Insights history
  watchtower-brief-*.txt    # Report summaries
  watchtower-facts-*.json   # Report data for dashboard
  ops-cache.json            # Background scan cache (incl. weekly_digest history, external_kill verdict)
  DR-README.txt             # Recovery instructions
  .watchtower-state.json    # Internal state (acks, cursors)
```

---

## What not to delete casually

| File | If deleted |
|------|------------|
| `dashboard-auth.json` | Default owner login recreated on next start |
| `audit-log.jsonl` | Audit history starts empty |
| `.watchtower-state.json` | Loses crash review marks, incremental progress |
| `live-history.json` | Live charts start empty (rebuild over time) |
| `watchtower-facts-*.json` | That report disappears from dashboard history |

---

## Technical details

### `dashboard-auth.json`

Schema 2: `accounts[]` with per-person username, role (`owner` / `admin` / `viewer`), PBKDF2 password hash, optional encrypted TOTP secret, recovery codes. Top-level fields still mirror the owner so a rolled-back pre-1.1.18 jar can sign that person in. First upgrade also writes `dashboard-auth.json.pre-1.1.18.bak` once. See [[Accounts-And-Audit-Log]].

### `audit-log.jsonl`

Append-only JSON lines for settings changes, acknowledgements, suppressions, account management, and auth events. Pruned to newest 2000 entries and 90 days on append. Not included in support packs.

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
- [[Accounts And Audit Log]]
