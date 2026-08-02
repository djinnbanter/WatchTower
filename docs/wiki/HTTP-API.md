# HTTP API

**Most owners can skip this page.** Use the dashboard and `/watchtower` commands for normal ops. This API is for developers, scripts, and automation.

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

Session JSON (`GET /api/auth/session` and login responses) includes `role` (`owner` / `admin` / `viewer`) when authenticated. When a Minecraft player is linked, it also includes `minecraft_uuid` and `minecraft_name`. Appearance prefs (`ui_theme`, `ui_accent`) are included when set on the account. Viewers get 403 `read_only_account` on every non-GET `/api/*` write except self-service routes such as `/api/accounts/me/minecraft` and `/api/accounts/me/appearance`. Account-management routes need `owner` or return 403 `owner_required`. If auth failed to initialize, protected routes return 503 `auth_unavailable` (recovery: `/watchtower dashboard reset-password`).

---

## Accounts & audit log (1.1.18)

| Endpoint | Method | Who | Purpose |
|----------|--------|-----|---------|
| `/api/accounts` | GET | owner | `{ accounts: [{ id, username, role, disabled, totp_enabled, created_at, last_login_at, is_you, minecraft_uuid?, minecraft_name? }] }` |
| `/api/accounts` | POST | owner | `{ username, role }` → `{ ok, id, username, role, temp_password }` (temp password shown once) |
| `/api/accounts/update` | POST | owner | `{ id, role?, disabled?, minecraft_uuid?, minecraft_name?, clear_minecraft? }` — role/disable ends sessions; Minecraft fields are optional |
| `/api/accounts/me/minecraft` | POST | any signed-in | `{ uuid, name }` or `{ clear: true }` — link/unlink self only (viewers allowed) |
| `/api/accounts/me/appearance` | PUT | any signed-in | `{ theme, accent }` — `theme`: `light`\|`dark`\|`black`\|`system`; `accent`: `signal`\|`amber`\|`teal`\|`violet`\|`rose`\|`green`\|`coral`\|`slate` (viewers allowed) |
| `/api/accounts/reset-password` | POST | owner | `{ id, clear_2fa? }` → `{ ok, temp_password }`; ends that account’s sessions |
| `/api/accounts/delete` | POST | owner | `{ id }` — refuses self-delete and last owner |
| `/api/audit-log` | GET | owner or admin | `?limit=` (default 200, max 2000) → `{ entries, truncated, retention_days: 90, max_entries: 2000 }` |

See [[Accounts-And-Audit-Log]].

---

## Config & settings

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/config` | GET | `live_sample_interval_sec`, `live_retention_hours`, `embedded`, `hostname`, `bind_exposed` |
| `/api/settings` | GET | Schedule, lookback, incremental, `modrinth_lookup`, `modrinth_auto_scan_on_mod_changes`, `spark_enabled`, `spark_mod_loaded`, `spark_auto_capture_on_lag`, `spark_auto_capture_window_sec`, `spark_auto_capture_cooldown_sec`, backup dirs, external tracking mode, panel, `ops_poll_sec`, `ops_log_scan_sec`, `report_retention_count`, `report_retention_days`, `live_sample_interval_seconds` |
| `/api/settings` | POST | `{ reportIntervalMinutes?, lookbackHours?, incremental?, modrinthLookup?, modrinthAutoScanOnModChanges?, sparkAutoCaptureOnLag?, … }` |
| `/api/data-sources` | GET | Freshness timestamps for Sources tab: `live_at`, `ops_scan_at`, `full_report_at`, `issues_live_at`, `next_scheduled_minutes`, `ops_log_scan_sec`, `ops_poll_sec` |
| `/api/update/check` | GET | Read-only version check against GitHub Releases / Modrinth |

---

## Onboarding (setup wizard)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/onboarding/discovery/start` | POST | Start blocking Initial discovery (**deep audit baseline**). Returns 202 / 409 if already running. |
| `/api/onboarding/discovery/status` | GET | Discovery progress: `stage`, `stage_label`, `stage_detail`, `progress`, `counts`, `running`, `success`. |
| `/api/onboarding/audit` | POST | Alias that starts Initial discovery (prefer `/discovery/*` for progress). |
| `/api/config-audit` | GET | Read-only launch & config audit (`server.properties` verdicts + JVM summary from live/report). Same shape as facts `optional.config_launch_audit`. Kill-switch: `CONFIG_AUDIT_ENABLED=false` → `status: disabled`. |
| `/api/weekly-digest` | GET | Bounded weekly ops digest history from `ops-cache.json` → `weekly_digest` (`history[]` newest-first, capped by `WEEKLY_DIGEST_HISTORY_MAX`). Empty `{ "history": [] }` when none yet. |
| `/api/weekly-digest` | POST | Body `{ "action": "generate_now" }` — build and persist a digest now (`trigger: "manual"`). Returns `{ "ok": true, "digest": … }` or `409` with `{ "ok": false, "reason": "disabled" }` when `WEEKLY_DIGEST_ENABLED=false`. |

---

## Live & samples

| Endpoint | Method | Query | Purpose |
|----------|--------|-------|---------|
| `/api/live` | GET | — | Latest snapshot, bandwidth, thermal, pregen |
| `/api/players` | GET | — | Online player roster |
| `/api/samples` | GET | `minutes=` or `hours=`, `max_points=` | Chart time series (TPS, MSPT, CPU, heap, etc.) |

Default `max_points` is 2000 (clamped 100–5000). Client typically requests ~500 for charts.

`/api/samples` includes `mem_used_gb` series (host RAM used, not free) where host metrics exist. RAM charts plot **used** GB on Overview and Live. When thermal sensors are available, samples also include `thermal_package` and `thermal_ambient` (°C) for Live System dials. Live snapshots may include `jvm_gc` (pause % of wall), `heap_mb.pressure_pct`, `gc_pause_pct` series, and `jvm_health_live` (flags profile, verdict, advice, optional `recommended_flags`). Live may also include root-level `ram_envelope` (`envelope` = `ok|low|critical`, plus `host_mem_gb`, `xmx_gb`, `outside_headroom_gb`, `ram_source`) when host memory and `-Xmx` are known — Overview teasers use `critical` only. L1 rollup rows may include `heap_pressure_pct_avg`, `heap_pressure_pct_max`, `heap_used_gb_max`, `gc_pause_pct_avg`, and disk fields `disk_use_pct_avg`, `disk_free_gb_avg`, `disk_write_mb_s_avg`, `disk_write_await_ms_avg`. Live `disk_io` may include `write_await_ms` and `latency_source` (`diskstats` | `fsync_probe` | `unavailable`). Report facts expose `optional.jvm_health`, `optional.disk_projection`, and may raise issues `GC_PRESSURE` and `DISK_FILL_PROJECTED`. `GET /api/performance/dashboard` includes `ram_sizing` (heap window + host envelope fields: `envelope`, `host_mem_gb`, `outside_headroom_gb`, `ram_source`; verdict may be `envelope_tight`), `baseline_regression`, and `disk_projection` plus optional `disk_io_lag_align` insight.

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
  "rows": [ { "ts": "…", "tps_avg": 19.2, "mspt_avg": 8.1, "entities_max": 4210, "chunks_max": 1180, "unattended_chunks_max": 800, "low_tps_flag": false } ]
}
```

Minute rows may also include `entities_max`, `chunks_max`, and `unattended_chunks_max` when the world-pressure census has run (see [[World-Pressure]]). Ops-cache `world_pressure` (same `/api/ops-cache` payload) holds the latest census dimensions, quiet-hours baseline (classifier-only), MSPT correlation, and sustained classifiers. `GET /api/performance/dashboard` also includes `world_pressure_compare` (`busy` p95 + window `peak`) for the selected `7d`/`30d` Insights window.

Reads **L1 local JSON only** — not health-report facts. Also serves `/api/performance/insights`, CSV export, and the **Insights** tab dashboard.

---

## Performance insights (Insights tab)

| Endpoint | Method | Query | Purpose |
|----------|--------|-------|---------|
| `/api/performance/insights` | GET | `window=7d\|30d` | Busy/quiet hours, player bins, outlier minutes, sticky lag episodes, ranked insights (Overview poll) |
| `/api/performance/dashboard` | GET | `window=7d\|30d` | Full **Insights** tab payload: insights + `hour_of_week`, `daily_series`, `period_compare`, `correlations`, `related_events`, `scorecard_perf`, `ram_sizing`, `baseline_regression`, `disk_projection`, `world_pressure_compare` |
| `/api/performance/baseline` | POST | `{ "action": "set_now" }` | Freeze a new performance baseline from recent L1 history; returns `baseline` + fresh `baseline_regression` |
| `/api/performance/export` | GET | `window=7d`, `format=csv` | Download minute rollup rows as CSV |

---

## Spark profiles

| Endpoint | Method | Query / body | Purpose |
|----------|--------|--------------|---------|
| `/api/spark/profiles` | GET | — | List `.sparkprofile` files on disk (newest first, capped). Includes `profiles`, `skipped`, `search_dirs`, report/auto-selected paths, and the `auto_capture` status envelope |
| `/api/spark/profile` | GET | `path=` | Parse one profile on demand. Parsed results are cached by normalized path + mtime + size |
| `/api/spark/tree` | GET | `path=`, optional `thread`, `window`, `source`, `search`, `min_share`, `max_nodes` | Return the bounded v2 call tree or a legacy flat-method fallback, with truncation metadata |
| `/api/spark/compare` | GET | `baseline=`, `target=` | Deterministic normalized comparison. `compatible=false` explains sampler-mode or thread-scope mismatches |
| `/api/spark/import` | POST | `{ "url": "https://spark.lucko.me/…" }` | Download a bytebin sampler into `watchtower/spark-upload/{key}.sparkprofile` (allowlisted hosts only) |
| `/api/spark/upload` | POST | `name=` and raw `.sparkprofile` request body | Validate and save a local profile under the configured upload directory (64 MB maximum) |

The parsed profile keeps legacy summary aliases while adding `analysis_version: 2`, mode-aware units, source own/involvement shares, deterministic evidence, and bounded tree data. See [[Using-Spark-with-Watchtower]] for capture and interpretation rules.

---

## Reports & support

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/reports/latest` | GET | Newest legacy facts + brief (excludes `-support-` artifacts) |
| `/api/reports/index` | GET | Report history list |
| `/api/reports/get` | GET | `?facts=<filename>` |
| `/api/reports/status` | GET | Compose status (`running`, `zip_ready`, `zip_path`, `success`, `message`) |
| `/api/reports/run` | POST | Alias for support compose (Quick preset unless body has `preset`) → 202 |
| `/api/support/catalog` | GET | Builder catalog (logs, crashes, spark, stores, presets, budgets) |
| `/api/support/compose` | POST | Start async support compose with builder options JSON → 202 / 409 |
| `/api/support/bundle` | GET | Download ready support zip (`?path=` optional basename under `watchtower/`) |
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

Canonical `failure_kind` values: `mod_runtime`, `mod_load_dependency`, `mod_load_script`, `mod_load_mixin`, `mod_load_mixin_conflict`, `mod_load_duplicate`, `mod_load_config`, `mod_load_asset`, `mod_load_worldgen`, `mod_load_compat`, `mod_load_ecosystem`, `platform_mismatch`, `env_lock`, `world_nbt_corrupt`, `watchdog`, `watchdog_followup`, `watchdog_pregen`, `host_resource`, `external_kill`, `loader`, `unknown`.

`external_kill` rows may include `details.external_kill_subtype` of `oom` or `panel_watchdog` (no crash report on disk — synthetic Crashes entry).

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
| `/api/activity` | GET | `?hours=` — timeline events (ops-cache ledger merged with report events when fresher) plus `incident_stories[]` when correlated |
| `/api/activity/scan` | POST | Incremental log tail → update `ops-cache.json` activity ledger (also rebuilds incident stories) |
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
| `/api/mods/disable` | POST | Soft-disable top-level jar under `mods/` — `{ jar, confirm_world_risk? }` → rename to `*.jar.disabled` (admin+; `MOD_DISABLE_ENABLED`; 400 `world_risk_confirm_required` when high risk and confirm missing) |
| `/api/mods/enable` | POST | Re-enable — `{ jar }` basename of `*.jar.disabled` (or `*.disabled`) → rename back to `*.jar` |
| `/api/mods/configs` | GET | List files under `config/` (`files[]`: `path`, `size`, `mtime`, `has_backup`, `secret_hint`). With `?path=` — read one file (`content`, `mtime`, `parse_warnings[]`, `editor`: `form`\|`raw`, and `fields[]` when `editor=form`). Requires `MOD_CONFIG_EDIT_ENABLED` (default true); otherwise 403 |
| `/api/mods/configs` | PUT | Save — `{ path, expected_mtime, content? }` or `{ path, expected_mtime, fields? }` → backup then write (admin+). Prefer `fields` for TOML form saves (server serializes). `409` on mtime conflict; max 512 KiB. Audit `config_saved` (path only) |
| `/api/mods/configs/undo` | POST | `{ path }` — restore newest backup (admin+). Audit `config_undone` |
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
| `/api/logs/index` | GET | Alias of `/api/logs/list` (older dashboard builds) |
| `/api/logs/content` | GET | `?file=&tail=` — tail of a log file (plain or gzip); returns `{ file, content, truncated, size, lines }` |
| `/api/ops-cache` | GET | L2.5 ops cache (`crashes`, `scorecard`, `activity`, `lag_issues`, `incident_stories`, `mod_log_errors`, `running_mods`, `mod_issues`, `silent_fails`, `join_clinic`, `world_pressure`, `right_now`, `log_stale`, `backups_live`, `issues_live[]` continuous issue ledger, `startup_profile`, `mods_light`, `player_directory`, reconcile timestamps) |
| `/api/client-mods/ignores` | GET | Ignored client-only mods |
| `/api/client-mods/ignore` | POST | Ignore/unignore client mod |

---

## Backups & filesystem

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/backups/scan` | POST | Rescan backup inventory; persists `backups_live` in ops-cache |
| `/api/backups/verify` | POST | Light integrity verify — `{ path }` under configured backup dirs; updates inventory `verify` (admin+) |
| `/api/backups/test-restore` | POST | Start async extract under `watchtower/restore-verify/<id>/` — `{ path }` (`BACKUP_TEST_RESTORE_ENABLED`) |
| `/api/backups/test-restore/status` | GET | Current test-restore job |
| `/api/backups/test-restore/cleanup` | POST | Delete sandbox — `{ id? }` |
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

`GET /api/overview/meta` adds `mod_tldr`, `right_now`, `performance_insights_tldr`, `baseline_regression_tldr` (when active; also prefers into `performance_insights_tldr`), `safe_restart`, `restart_hygiene`, `log_stale_tldr`, `mods_changed_tldr`, `disk_jump_tldr`, `disk_projection` / `disk_projection_tldr`, `backup_mode`, `backup_external_tldr`, `backup_poll_active`, `backups_scanned_at`, and related ops fields.

### `restart_hygiene` (1.1.6)

Advisory payload on overview meta. Never mutates the server.

When suppressed:

```json
{ "active": false, "suppressed_reason": "disabled|low_uptime|healthy_metrics|insufficient_metrics", "checked_at": "2026-07-28T19:00:00Z" }
```

When active:

```json
{
  "active": true,
  "severity": "info",
  "headline": "Consider a maintenance restart",
  "uptime_sec": 136800,
  "signals": [
    { "id": "gc_rising", "current": 4.2, "prior": 2.8, "delta_pct": 50.0 },
    { "id": "heap_stable", "current": 71.0 }
  ],
  "quiet_window": {
    "next_start_at": "2026-07-29T03:00:00Z",
    "next_end_at": "2026-07-29T05:00:00Z",
    "avg_players": 0.2,
    "avg_mspt": 24.0,
    "sample_minutes": 42
  },
  "checked_at": "2026-07-28T19:00:00Z"
}
```

`quiet_window.next_start_at` / `next_end_at` are UTC ISO-8601 instants (no local-time formatting from the API). Dashboard Settings timezone preference converts them for display. Kill-switch: `RESTART_HYGIENE_ENABLED`.

---

## Security headers

Responses include `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, and Content-Security-Policy restricting scripts to same origin.

### Common auth error codes

| HTTP | `error` code | Meaning |
|------|--------------|---------|
| 403 | `read_only_account` | Viewer tried a write |
| 403 | `owner_required` | Non-owner hit an `/api/accounts*` route |
| 503 | `auth_unavailable` | Auth store did not initialize — use `/watchtower dashboard reset-password` |

---

## See also

- [[Dashboard Overview]]
- [[Security and Access]]
- [[Accounts And Audit Log]]
- [[Live Charts]]
- [[Using-Spark-with-Watchtower]]
