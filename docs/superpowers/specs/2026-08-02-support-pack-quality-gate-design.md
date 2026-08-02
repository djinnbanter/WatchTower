# 1.1.21 — Support pack quality gate

**Status:** Approved for planning (2026-08-02)  
**Roadmap:** [1.1.19–1.1.29 change safety](../../dev/roadmap/versions/1.1.19-1.1.29-change-safety-and-recovery.md#1121--support-pack-quality-gate)  
**Size:** Small–medium

## Problem

Helpers still get incomplete support zips (no log, wrong time window, crash incident without a crash report). The Support Bundle Builder downloads immediately after compose with no preflight.

## Goal

Before download in the dashboard Support pack modal: run a checklist, show green / yellow / skip rows, allow **Download anyway**, and record gate results in every zip’s `manifest.json` (including CLI compose).

## Decisions (locked)

| Decision | Choice |
| -------- | ------ |
| Missing `latest.log` / selected log | **Strong yellow**, never hard-block |
| Gate timing | **Preflight API** before compose; re-evaluate on compose for the manifest |
| Interactive gate surface | **Dashboard builder only** |
| CLI / `/watchtower diagnostics` | Compose as today; **always embed** `quality_gate` in manifest (no interactive `--force`) |
| Redaction on anyway path | **Always** still run `SupportRedactor` |
| Soft-hang dump check | **Stub** (`skipped` / `not_applicable`) until 1.1.22 |

## Architecture

```text
Dashboard picks (preset / customize / note)
    → POST /api/support/quality-gate  (same options body as compose)
    → SupportQualityGate.evaluate(serverDir, catalog, options)
    → Checklist UI (pass | warn | skip)
    → Build & download  OR  Download anyway (override=true)
    → POST /api/support/compose (+ override flag)
    → SupportComposer → SupportQualityGate again → SupportBundlePackager
    → manifest.json includes quality_gate
```

Shared evaluator lives in `watchtower-core` so UI and zip helpers see the same truth.

## Checklist rows (v1)

| id | Fail severity | Pass when | Skip when |
| -- | ------------- | --------- | --------- |
| `log_present` | warn | ≥1 selected log file exists on disk | Logs intentionally off |
| `mod_list` | warn | Mods inventory present (ops-cache / mods_light) | — |
| `java_loader` | warn | Environment reports Java + loader | — |
| `secrets_redacted` | warn only if redactor path unavailable | Redaction will apply on compose | — |
| `crash_if_relevant` | warn | Crash selected when category/preset implies crash, or no crashes in catalog | Preset does not imply crash and none selected |
| `incident_window` | warn | Selected crash time covered by selected log coverage (± grace) | No crash selected |
| `hang_dump` | — | — | Always skip until 1.1.22 hang dumps exist |

No blocking (`fail` / red) statuses in 1.1.21. `required` is always `false` for v1 rows (reserved for future hard rules).

### Incident window (v1 heuristic)

- Input: selected crash file’s mtime (from catalog) when present.
- Compare against selected log file mtimes / known coverage hints from catalog.
- Grace: ±2 hours default (constant in gate; no conf knob unless needed later).
- If insufficient metadata: `skip` with message “Could not verify log coverage for this crash.”

## API

### `POST /api/support/quality-gate`

- **Auth:** Same as compose (write / admin as today’s support compose).
- **Body:** Same options shape as `POST /api/support/compose` (preset, logs, crashes, include flags, note, category).
- **Response:**

```json
{
  "ok": true,
  "override_allowed": true,
  "summary": { "pass": 5, "warn": 1, "skip": 1 },
  "checks": [
    {
      "id": "log_present",
      "status": "warn",
      "message": "No log file selected — Discord helpers usually need latest.log.",
      "required": false
    }
  ]
}
```

`status` ∈ `pass` | `warn` | `skip`.

### Compose override

Compose body may include:

```json
{ "quality_gate_override": true }
```

When true, packager sets `quality_gate.override: true` in the manifest. Gate is still evaluated and embedded.

### Fixture preview

`fixture-api-core` stubs quality-gate with realistic pass/warn mix so the modal works offline.

## Manifest (`manifest.json`)

```json
"quality_gate": {
  "evaluated_at": "2026-08-02T12:00:00Z",
  "override": false,
  "summary": { "pass": 5, "warn": 1, "skip": 1 },
  "checks": [ /* same objects as API */ ]
}
```

Always present on support compose zips after this release (empty checks only if evaluator throws — prefer fail-open warn row instead).

## UI (Support Bundle Builder modal)

1. Existing steps: pack type, note, customize files, size hint — unchanged.
2. Primary path: **Check pack** runs preflight (or Build always runs preflight first — prefer one button flow: Build → if warns, show checklist + confirm).
3. Recommended UX:
   - Click **Build support pack** → call quality-gate.
   - If all `pass`/`skip`: proceed to compose + download immediately.
   - If any `warn`: show checklist panel; primary **Download anyway**; secondary **Back** to edit picks.
4. Plain English messages only (no stack traces).
5. Preview mode: simulate gate + compose message (no zip), same as today.

## Files & modules

| Path | Role |
| ---- | ---- |
| `watchtower-core/.../report/SupportQualityGate.java` | Pure evaluator |
| `watchtower-core/.../report/SupportComposer.java` | Re-run gate; pass to packager |
| `watchtower-core/.../report/SupportBundlePackager.java` | Embed `quality_gate` in manifest |
| `watchtower-core/.../report/SupportComposeOptions.java` | Optional `qualityGateOverride` |
| `watchtower-neoforge-common/.../DashboardHttpServer.java` | `POST /api/support/quality-gate` |
| `web/dashboard/src/features/support/bundle-builder-modal.tsx` | Checklist + anyway |
| `web/dashboard/src/features/support/support.css` | Gate panel styles |
| `web/dashboard/src/api/client.ts` | `supportQualityGate` |
| `web/dashboard/scripts/fixture-api-core.ts` | Preview stub |
| `watchtower-core/src/test/.../SupportQualityGateTest.java` | Unit tests |
| `SupportComposerTest` / packager tests | Manifest assertions |
| `samples/fixtures/support-gate/` (optional) | Synthetic catalog + options cases |
| Wiki `docs/wiki/Health-Reports.md` | Short “checklist before download” note |

## Config

No new `watchtower.conf` keys for v1 (grace constant in code). Master kill-switch deferred unless needed.

## Out of scope

- Hard-blocking download
- Discord two-audience / player-safe explain (parked support sharing polish)
- Soft-hang dump as required evidence (1.1.22)
- Interactive CLI gate / `--force`
- New incident-time picker UI (use crash mtime heuristic)

## Ship when

- [ ] Missing selected log → strong yellow; Download anyway still works
- [ ] Crash-relevant pack without crash report → warning
- [ ] Secrets still redacted on anyway path
- [ ] Manifest lists checks + `override` when used
- [ ] Fixture preview shows checklist
- [ ] Core tests cover missing log, crash gap, window miss, all-green

## Operator-visible impact

Fewer useless Discord zips. Same builder, smarter gate. Plain English: “what’s missing” before you send it.
