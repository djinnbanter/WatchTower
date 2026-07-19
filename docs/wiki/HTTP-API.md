# HTTP API

**For developers and automation** — scripts, external tools, or custom integrations. Server owners can use the dashboard and `/watchtower` commands instead; you do not need this page for normal use.

The dashboard exposes a REST API on the same port as the UI (default **8787**). All endpoints except `/api/config` and `/api/auth/*` require a valid session after login (+ 2FA if enabled).

---

## At a glance

- **Base URL:** `http://<server>:8787`
- **Auth:** session cookie after `POST /api/auth/login`
- **Public:** `/api/config`, `/api/auth/session`, login/logout flows
- **Rate limit:** 5 failed logins per IP per 15 minutes → HTTP 429

---

## Authentication

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/auth/session` | GET | Session status (public) |
| `/api/auth/login` | POST | `{ username, password, remember? }` |
| `/api/auth/totp` | POST | `{ code, recovery? }` — complete 2FA |
| `/api/auth/logout` | POST | End session |
| `/api/auth/change-password` | POST | `{ current_password, new_password }` |
| `/api/auth/change-username` | POST | `{ username }` |
| `/api/auth/totp/setup` | POST | Begin 2FA — returns QR |
| `/api/auth/totp/confirm` | POST | `{ code }` — enable 2FA + recovery codes |
| `/api/auth/totp/disable` | POST | `{ password, code }` |
| `/api/auth/recovery/regenerate` | POST | `{ password, code }` — new recovery codes |

---

## Config & settings

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/config` | GET | `live_sample_interval_sec`, `live_retention_hours`, `embedded`, `hostname`, `bind_exposed` |
| `/api/settings` | GET | Schedule, lookback, incremental, `modrinth_lookup`, `modrinth_auto_scan_on_mod_changes`, backup dirs, external tracking mode, panel, `ops_poll_sec`, `ops_log_scan_sec`, `report_retention_count`, `report_retention_days`, `live_sample_interval_seconds` |
| `/api/settings` | POST | `{ reportIntervalMinutes?, lookbackHours?, incremental?, modrinthLookup?, modrinthAutoScanOnModChanges?, … }` |
| `/api/data-sources` | GET | Freshness timestamps for Sources tab: `live_at`, `ops_scan_at`, `full_report_at`, `next_scheduled_minutes`, `ops_log_scan_sec`, `ops_poll_sec` |
| `/api/update/check` | GET | Read-only version check against GitHub Releases / Modrinth |

---

## Onboarding (setup wizard)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/onboarding/audit` | POST | Live discovery only (activity / crashes / mods / backup scans). Returns operator flags such as `backup_configured`, `has_facts_report`, `schedule_summary`. Does **not** start a 30-day report — the wizard (or Run Report) starts that separately. |

---

## Live & samples

| Endpoint | Method | Query | Purpose |
|----------|--------|-------|---------|
| `/api/live` | GET | — | Latest snapshot, bandwidth, thermal, pregen |
| `/api/players` | GET | — | Online player roster |
| `/api/samples` | GET | `minutes=` or `hours=`, `max_points=` | Chart time series (TPS, MSPT, CPU, heap, etc.) |

Default `max_points` is 2000 (clamped 100–5000). Client typically requests ~500 for charts.

`/api/samples` includes `mem_used_gb` series (host RAM used, not free) where host metrics exist. RAM charts plot **used** GB on Overview and Live. When thermal sensors are available, samples also include `thermal_package` and `thermal_ambient` (°C) for Live System dials.

---

## Performance rollups

**L1 minute history** — `GET /api/performance/rollups?hours=24`

| Endpoint | Method | Query | Purpose |
|----------|--------|-------|---------|
| `/api/performance/rollups` | GET | `hours=1`–`2160` (capped by L1 retention) | Summary + minute rows from `performance-rollups.json` |

Response shape:

```json
{
  "enabled": true,
  "hours": 24,
  "summary": { "tps_avg": 18.4, "mspt_avg": 41.0, "low_tps_minutes": 3, "sample_minutes": 1440 },
  "rows": [ { "ts": "…", "tps_avg": 19.2, "mspt_avg": 8.1, "low_tps_flag": false } ]
}
```

Reads **L1 local JSON only** — not health-report facts. Also serves `/api/performance/insights`, CSV export, and the **Insights** tab dashboard.

---

## Performance insights (Insights tab)

| Endpoint | Method | Query | Purpose |
|----------|--------|-------|---------|
| `/api/performance/insights` | GET | `window=7d\|30d` | Busy/quiet hours, player bins, outlier minutes, sticky lag episodes, ranked insights (Overview poll) |
| `/api/performance/dashboard` | GET | `window=7d\|30d` | Full **Insights** tab payload: insights + `hour_of_week`, `daily_series`, `period_compare`, `correlations`, `related_events`, `scorecard_perf` |
| `/api/performance/export` | GET | `window=7d`, `format=csv` | Download minute rollup rows as CSV |

---

## Spark profiles

| Endpoint | Method | Query | Purpose |
|----------|--------|-------|---------|
| `/api/spark/profiles` | GET | — | List `.sparkprofile` files on disk (newest first, capped) |
| `/api/spark/profile` | GET | `path=` | Parse one profile on demand — used by Spark tab dropdown |

See [[Using-Spark-with-Watchtower]] for capture workflow.

---

## Reports

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/reports/latest` | GET | Newest facts + brief |
| `/api/reports/index` | GET | Report history list |
| `/api/reports/get` | GET | `?facts=<filename>` |
| `/api/reports/status` | GET | In-progress report status (`running`, `started_at`, `finished_at`, `success`, `message`, `facts_path`; while running also `stage` / `stage_label`: `window`, `collect`, `analyze`, `enrich`, `write`, `finalize`) |
| `/api/reports/run` | POST | `{ lookbackHours?, incremental? }` → 202 started |
| `/api/modrinth/status` | GET | Dedicated Modrinth scan status (`enabled`, `running`, `stage`, `stage_label`, `stage_detail`, `progress`, `batch`, `eta_seconds`, `last_run`, `stats`, `success`, `error`) |
| `/api/modrinth/scan` | POST | Start Modrinth scan → 202 started; 400 if lookup disabled; 409 if already running |

### Facts `optional` — crash intelligence (1.0.13)

Report JSON (`/api/reports/latest`, `/api/reports/get`) may include these blocks under `optional`:

**`optional.crash_summaries[]`** — classified crash rows (also drives the Crashes tab):

```json
{
  "file": "crash-2026-06-20_06.53.26-server.txt",
  "failure_kind": "watchdog_pregen",
  "primary_mod_id": "squaremap",
  "stall_mod_id": "squaremap",
  "watchdog_tick_ms": 60000,
  "confidence": "high",
  "fix_hints": [
    "Pause Chunky pregen or reduce radius",
    "Defer squaremap full render until pregen completes"
  ],
  "incident_id": null,
  "paired_primary_file": null
}
```

Canonical `failure_kind` values: `mod_runtime`, `mod_load_dependency`, `mod_load_script`, `mod_load_mixin`, `mod_load_mixin_conflict`, `mod_load_duplicate`, `mod_load_config`, `mod_load_asset`, `mod_load_worldgen`, `mod_load_compat`, `mod_load_ecosystem`, `platform_mismatch`, `env_lock`, `world_nbt_corrupt`, `watchdog`, `watchdog_followup`, `watchdog_pregen`, `host_resource`, `loader`, `unknown`.

**`optional.startup_profile`** — last boot window (Startup tab / Overview boot card):

```json
{
  "total_sec": 142.3,
  "done_at": "2026-06-20T00:37:12Z",
  "status": "warnings",
  "phases": [
    { "id": "registry", "label": "Registry freeze", "sec": 38.1 }
  ],
  "slowest": [{ "phase": "registry", "sec": 38.1 }],
  "warnings": [{ "id": "loot_parse", "count": 538 }],
  "errors": [{ "mod_id": "pride", "kind": "mod_corrupt", "blocking": false }],
  "compare_to_last_boot": { "delta_sec": 12.4, "direction": "slower" }
}
```

**`optional.fml_issues[]`** — ranked NeoForge `-- Mod loading issue --` blocks:

```json
[
  {
    "rank": 1,
    "mod_id": "examplemod",
    "kind": "mod_load_dependency",
    "message": "Missing dependency: cloth_config",
    "file": "examplemod-1.0.jar"
  }
]
```

---

## Activity, crashes, mods

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/activity` | GET | `?hours=` — timeline events (ops-cache ledger merged with report events when fresher) |
| `/api/activity/scan` | POST | Incremental log tail → update `ops-cache.json` activity ledger |
| `/api/issues/peek` | GET | Live lag + mod issues from ops cache (`lag_issues[]`, `mod_issues[]`); optional `log_stale` when live stale |
| `/api/issues/acks` | GET | Acknowledged Issues-tab keys (`acknowledged_issues`) |
| `/api/issues/ack` | POST | `{ id, reviewed?: true }` — mark/unmark an issue reviewed (`issue:…`, `lag:…`, `mod:…`, `backup:…`, `modrinth:…`, `log_stale`) |
| `/api/issues/acknowledge-all` | POST | `{ ids: string[] }` — bulk mark reviewed |
| `/api/issues/suppressions` | GET | Conf ∪ state issue suppressions |
| `/api/issues/suppress` | POST | `{ issue_id }` — hide from Issues Active (persisted in state) |
| `/api/issues/unsuppress` | POST | `{ issue_id }` — restore |
| `/api/rules` | GET | Loaded crash rule packs + rule ids + priorities |
| `/api/rules/get` | GET | `?id=` rule id or `packId/ruleId` (sanitized detail) |
| `/api/rules/validate` | POST | Body YAML or `{ yaml }` → `{ valid, errors[] }` |
| `/api/mods/scan` | POST | Force unified log scan + running mods → updates ops-cache; returns `{ scanned_at, mod_error_count, running_mod_count, mod_log_errors[], running_mods[], kubejs_failures[] }` |
| `/api/mods/tree` | GET | `?mod_id=` — nested dependency tree from latest report (`dependents` + `dependencies`, max depth 6) |
| `/api/mods/forensics/status` | GET | Mod forensics index/status (`index.state`: `ready`\|`idle`\|`skipped`\|`error`; `config.mod_forensics_scan` / `corrupt_jar_walk`; stale cache reported without jar walk) |
| `/api/mods/forensics/find-class` | POST | `{ class, include_nested? }` → owning jar matches (rate limit 10/min); builds cache on demand |
| `/api/mods/forensics/find-package` | POST | `{ package, mode?: prefix\|exact_package }` → package ownership matches |
| `/api/mods/forensics/scan-corrupt` | POST | Top-level zip walk when `FORENSICS_CORRUPT_JAR_WALK=true` |
| `/api/mods/forensics/config-health` | GET | Last L3 `config_health[]` (or live scan fallback) |
| `/api/incidents` | GET | List auto + manual lag incident summaries |
| `/api/incidents/get` | GET | `?id=` — full incident JSON |
| `/api/incidents/pin` | POST | `{ note? }` — manual lag pin (same as `/watchtower pin`) |
| `/api/crashes` | GET | Fingerprint-grouped crashes (`groups[]`, `count`, `unreviewed`, `unreviewed_groups`, `scanned_at?`) |
| `/api/crashes/acks` | GET | Acknowledged crash files |
| `/api/crashes/ack` | POST | Mark crash reviewed |
| `/api/crashes/acknowledge-all` | POST | `{ scope?: "unreviewed", fingerprint? }` — bulk mark reviewed |
| `/api/crashes/scan` | POST | Scan `crash-reports/` → update `ops-cache.json`; returns `{ scanned_at, new_count, unreviewed, crashes[] }` |
| `/api/crashes/context` | GET | `?file=&minutes=` — pre-crash TPS/log context |
| `/api/crashes/report` | GET | `?file=` — raw crash report text (`{ file, content, truncated, size }`) |
| `/api/inbox` | GET | Notification inbox items (`crash_group`, `update_check`) |
| `/api/inbox/dismiss` | POST | `{ id }` — dismiss inbox item → `state.json` |
| `/api/logs/list` | GET | List `logs/latest.log`, `debug.log`, and `*.log.gz` (`{ files:[{ name, size, mtime, gz }] }`) |
| `/api/logs/content` | GET | `?file=&tail=` — tail of a log file (plain or gzip); returns `{ file, content, truncated, size, lines }` |
| `/api/ops-cache` | GET | L2.5 ops cache (`crashes`, `scorecard`, `activity`, `lag_issues`, `mod_log_errors`, `running_mods`, `mod_issues`, `right_now`, `log_stale`, `backups_live`, reconcile timestamps) |
| `/api/client-mods/ignores` | GET | Ignored client-only mods |
| `/api/client-mods/ignore` | POST | Ignore/unignore client mod |

---

## Backups & filesystem

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/backups/scan` | POST | Rescan backup inventory; persists `backups_live` in ops-cache |
| `/api/backups/dirs` | POST | `{ dirs: ["path"] }` — save paths + scan + `backups_live` |
| `/api/backups/heartbeat` | POST | External backup webhook — requires `BACKUP_WEBHOOK_TOKEN`; Bearer or `X-Watchtower-Backup-Token` |
| `/api/backups/external` | POST | External backup setup — session auth; `{ trackingEnabled?, trackingMode?, generateWebhookToken?, backupExternalMarker?, backupSuppressLocalMissing? }`. `trackingEnabled: false` writes `BACKUP_TRACKING_ENABLED=false`, clears external signals, and silences backup Issues/alerts (dirs kept). |
| `/api/backups/external/test` | POST | Test panel backup signal from dashboard — **Settings → Backups: Test it worked**; session auth; updates `backup_external` ops-cache |
| `/api/fs/roots` | GET | Browse roots for folder picker |
| `/api/fs/list` | GET | `?path=` — directory listing |

**Ops scans:**

- **Always-on** — `OPS_LOG_SCAN_SEC` runs unified log tail, running mod list, log-stale check, and crash folder mtime scan
- **Performance insights** — `GET /api/performance/insights`, `GET /api/performance/dashboard`, and CSV export read minute rollups
- **External backup poll** — reads `backup-heartbeat.json` / webhook → `backup_external` ops-cache
- **Backup slow poll** — `BACKUP_POLL_MIN` rescans backup folders → `backups_live`
- **Session-gated (optional)** — `OPS_POLL_SEC` runs extra crash folder refreshes while ≥1 dashboard session is open

`GET /api/overview/meta` adds `mod_tldr`, `right_now`, `performance_insights_tldr`, `log_stale_tldr`, `mods_changed_tldr`, `disk_jump_tldr`, `backup_mode`, `backup_external_tldr`, `backup_poll_active`, `backups_scanned_at`, and related ops fields.

---

## Security headers

Responses include `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, and Content-Security-Policy restricting scripts to same origin.

---

## See also

- [[Dashboard Overview]]
- [[Security and Access]]
- [[Live Charts]]
- [[Using-Spark-with-Watchtower]]
