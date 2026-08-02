# Activity

**Activity** is the server diary — a timeline of pack changes (jars, soft-disable, config touches) plus commands, joins, lag, and jobs from the latest ops scan. Use it for “what changed on this box?” and “what happened around then?”

It is **not** player analytics (no chat, kills, or playtime).

---

## When to open it

- Someone dropped or removed a mod jar and you want the timestamp
- A config file was touched and you need the path
- Overview’s incident story needs more detail
- Correlating a lag window with joins/commands
- Checking whether background jobs ran

---

## Activity vs Insights vs Issues vs Audit

| Tab | Job |
|-----|-----|
| **Activity** | Event timeline / server diary |
| **Insights** | Patterns over days/weeks |
| **Issues** | Fix inbox to act on |
| **Settings → Audit** | Who did WatchTower writes (logins, settings, soft-disable actor) |

---

## What you’ll see

- KPI summary including **Pack changes**
- Typed timeline with filter chips (including **Changes** to hide player noise)
- Deep links into Mods, Issues, Backups, and Logs

### Pack-change event types (1.1.24)

| Type | Meaning |
|------|---------|
| `mod_jar_added` / `mod_jar_removed` / `mod_jar_updated` | Jar appeared, left, or size/mtime changed under `mods/` |
| `mod_disabled` / `mod_enabled` | Soft-toggle from the dashboard (`*.jar` ↔ `*.jar.disabled`) |
| `config_changed` | File under `config/` touched (path only; no diff) |

Jar/config rows come from a snapshot poll on the ops cadence (~60s). The first poll after start only seeds a baseline (no flood of “changed”). Config rows use a short per-path cooldown so save-spam does not fill the feed.

### Other event types

Joins, leaves, commands, tick lag, lag incidents, backup jobs, restart notices, performance spikes — still from log scanning and related writers.

---

## Retention

Events live in `ops-cache.json` under `activity.events`, capped at **1500**. Busy join/command traffic can push older diary rows out — use the **Changes** filter when you only care about pack edits.

---

## What to do next

1. Click **Changes** (or search) to focus on jar/config rows
2. Follow deep links into [[Mods]], [[Crashes]], or [[Backups]]
3. If the timeline is thin, wait for Scanning or the next ops poll

---

## Related

- [[Dashboard-Overview]]
- [[Insights]]
- [[Issues]]
- [[Crashes]]
- [[Mods]]
- [[Backups]]
