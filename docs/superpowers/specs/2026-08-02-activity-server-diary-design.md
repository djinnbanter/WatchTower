# 1.1.24 — Activity feed → server diary (design)

**Status:** Approved  
**Date:** 2026-08-02  
**Roadmap:** `docs/dev/roadmap/versions/1.1.19-1.1.29-change-safety-and-recovery.md` §1.1.24

## Product job

Activity answers **“what changed on this box?”** for pack-level changes (mod jars and config touches), without becoming player analytics.

Audit log stays separate: **Audit** = who did WatchTower writes; **Activity** = what happened on the server.

## Scope (ship-when)

**In:**

- `mod_jar_added` / `mod_jar_removed` / `mod_jar_updated` (filesystem poll)
- Existing `mod_disabled` / `mod_enabled` (dashboard soft-toggle; already emitted)
- `config_changed` (relative path under `config/`; no file diffs)
- Raise activity ledger cap **500 → 1500**
- Activity UI: labels, icons, **Changes** filter chip, deep links to Mods
- Filters so join/command noise can be hidden

**Out (later / rejected):**

- Backup verify, crash/soft-hang, restart, pack-drift diary rows
- Separate `activity-diary.jsonl`
- NIO `WatchService`
- Config content diffs
- Before/after MSPT “change notebook”
- Player chat / kills / playtime
- Restoring `incident_stories` on the Activity tab

## Approach

**Snapshot poll on ops cadence** (dedicated `PackChangeActivityScanner` in `watchtower-core`).

On each ops poll (~60s):

1. Read previous `pack_change_snapshot` from `.watchtower-state.json`
2. Walk `mods/` (top-level jars + `*.jar.disabled`) and `config/` (recursive files)
3. If no prior snapshot → write baseline only, **emit nothing**
4. Else emit typed activity events; merge via `OpsCacheWriter.applyActivityBackfillChunk` with `source: "scan"`
5. Persist next snapshot

## Event types

| `type` | Source | Detail |
|--------|--------|--------|
| `mod_jar_added` | scan | jar basename |
| `mod_jar_removed` | scan | jar basename |
| `mod_jar_updated` | scan | jar basename (same path, size and/or mtime changed) |
| `config_changed` | scan | relative path `config/...` |
| `mod_disabled` / `mod_enabled` | dashboard | jar before → after |

Common fields: `time` (ISO), `type`, `detail`, `source` (`scan` \| `dashboard`), optional `path`.

## Soft-disable rule

Pair `foo.jar` ↔ `foo.jar.disabled` (`ModJarDisable`): suppress false `mod_jar_removed` + `mod_jar_added`. Do **not** emit `mod_disabled`/`mod_enabled` from the scanner — dashboard owns those rows.

## Config policy

- First snapshot after start: silent baseline
- Per-path cooldown: **300 seconds**
- Detail = relative path only (no diffs)
- Skip names ending in `.tmp`, `.bak`, or `~`

## Snapshot schema (`pack_change_snapshot`)

```json
{
  "captured_at_epoch": 0,
  "mods": { "foo.jar": { "size": 1, "mtime": 2, "disabled": false } },
  "configs": { "config/a.toml": { "size": 1, "mtime": 2 } },
  "config_last_emit_epoch": { "config/a.toml": 0 }
}
```

## Retention

Stay in `ops-cache.activity.events`. Cap **1500**. No separate diary file. Joins/commands can still crowd older rows — document that and ship filters.

## Ship when

- [ ] Soft-disable jar → Activity row within one ops poll
- [ ] Drop new jar into `mods/` → `mod_jar_added` without dashboard
- [ ] Touch under `config/` (after baseline) → `config_changed` with path
- [ ] Viewer can read Activity; WatchTower actors stay on Audit

## Testing

Unit tests in core: baseline silent, jar add/remove/update, soft-disable suppress, config cooldown, ledger cap constant, StateManager round-trip.

## Plain English

Operators open Activity and see when jars were dropped, removed, or replaced, when configs were touched, and when soft-disable toggled — so “what changed on this box?” is answerable without digging folders or the audit log.
