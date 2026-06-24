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
| `/api/settings` | GET | Schedule, lookback, incremental, backup dirs, external tracking mode, panel, `ops_poll_sec`, `ops_log_scan_sec`, `report_retention_count`, `report_retention_days`, `live_sample_interval_seconds` |
| `/api/settings` | POST | `{ reportIntervalMinutes?, lookbackHours?, incremental? }` |
| `/api/data-sources` | GET | Freshness timestamps for Sources tab: `live_at`, `ops_scan_at`, `full_report_at`, `next_scheduled_minutes`, `ops_log_scan_sec`, `ops_poll_sec` |
| `/api/update/check` | GET | Read-only version check against GitHub Releases / Modrinth |

---

## Live & samples

| Endpoint | Method | Query | Purpose |
|----------|--------|-------|---------|
| `/api/live` | GET | — | Latest snapshot, bandwidth, thermal, pregen |
| `/api/players` | GET | — | Online player roster |
| `/api/samples` | GET | `minutes=` or `hours=`, `max_points=` | Chart time series (TPS, MSPT, CPU, heap, etc.) |

Default `max_points` is 2000 (clamped 100–5000). Client typically requests ~500 for charts.

`/api/samples` includes `mem_used_gb` series (host RAM used, not free) where host metrics exist. RAM charts plot **used** GB on Overview and Live.

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

Reads **L1 local JSON only** — not health-report facts. Also serves `/api/performance/insights`, CSV export, and the Insights tab dashboard.

---

## Performance insights

| Endpoint | Method | Query | Purpose |
|----------|--------|-------|---------|
| `/api/performance/insights` | GET | `window=7d\|30d` | Busy/quiet hours, player bins, outlier minutes, sticky lag episodes, ranked insights (Overview poll) |
| `/api/performance/dashboard` | GET | `window=7d\|30d` | Full Performance tab payload: insights + `hour_of_week`, `daily_series`, `period_compare`, `correlations`, `related_events`, `scorecard_perf` |
| `/api/performance/export` | GET | `window=7d`, `format=csv` | Download minute rollup rows as CSV |

---

## Reports

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/reports/latest` | GET | Newest facts + brief |
| `/api/reports/index` | GET | Report history list |
| `/api/reports/get` | GET | `?facts=<filename>` |
| `/api/reports/status` | GET | In-progress report status |
| `/api/reports/run` | POST | `{ lookbackHours?, incremental? }` → 202 started |

---

## Activity, crashes, mods

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/activity` | GET | `?hours=` — timeline events (ops-cache ledger merged with report events when fresher) |
| `/api/activity/scan` | POST | Incremental log tail → update `ops-cache.json` activity ledger |
| `/api/issues/peek` | GET | Live lag + mod issues from ops cache (`lag_issues[]`, `mod_issues[]`); optional `log_stale` when live stale |
| `/api/mods/scan` | POST | Force unified log scan + running mods → updates ops-cache; returns `{ scanned_at, mod_error_count, running_mod_count, mod_log_errors[], running_mods[], kubejs_failures[] }` |
| `/api/incidents` | GET | List auto + manual lag incident summaries |
| `/api/incidents/get` | GET | `?id=` — full incident JSON |
| `/api/incidents/pin` | POST | `{ note? }` — manual lag pin (same as `/watchtower pin`) |
| `/api/crashes/acks` | GET | Acknowledged crash files |
| `/api/crashes/ack` | POST | Mark crash reviewed |
| `/api/crashes/scan` | POST | Scan `crash-reports/` → update `ops-cache.json`; returns `{ scanned_at, new_count, unreviewed, crashes[] }` |
| `/api/crashes/context` | GET | `?file=&minutes=` — pre-crash TPS/log context |
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
| `/api/backups/external` | POST | External backup setup — session auth; `{ trackingMode?, generateWebhookToken?, backupExternalMarker?, backupSuppressLocalMissing? }` |
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

**Planned — live ops ([WT-024](https://github.com/djinnbanter/WatchTower/blob/main/docs/ROADMAP.md)):**

| Endpoint | Method | Purpose | Version |
|----------|--------|---------|---------|
| `/api/inbox` | GET | Unified notification inbox | 1.0.3 |
| `/api/inbox/dismiss` | POST | Dismiss inbox item → `state.json` | 1.0.3 |

---

## Security headers

Responses include `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, and Content-Security-Policy restricting scripts to same origin.

---

## See also

- [[Dashboard Overview]]
- [[Security and Access]]
- [[Live Charts]]
