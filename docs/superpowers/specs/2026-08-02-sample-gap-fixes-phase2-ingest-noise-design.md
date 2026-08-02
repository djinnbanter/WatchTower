# Sample-gap fixes — Phase 2: log ingestion and noise (design)

**Date:** 2026-08-02  
**Status:** Approved for planning (depends on Phase 1 shipping or at least not conflicting)  
**Research:** [`docs/superpowers/research-runs/2026-08-02-new-samples/`](../research-runs/2026-08-02-new-samples/)  
**Backlog:** FB-07, FB-08, FB-09, FB-10  
**Depends on:** Phase 1 optional (independent subsystem); prefer execute after Phase 1 to keep PRs reviewable

## Goal

Stop being blind to Jade and KubeJS sidecar logs, and stop letting recipe / DISTXFORM / loot WARN floods crowd Issues.

## Scope

| In | Out |
| -- | --- |
| FB-07 Jade sidecar multi-exception | Crash classifier changes |
| FB-08 createfood / KubeJS recipe flood deprioritization | FB-11…FB-13 |
| FB-09 kubejs/server.log (+ startup) ingestion | Empty client.log as a required signal |
| FB-10 DISTXFORM + loot-parse spam ranking | UI redesign |

## Current behavior (facts)

- [`GzipLineReader.iterLogFiles`](../../watchtower-core/src/main/java/dev/mcstatus/watchtower/core/collect/GzipLineReader.java) only returns `logs/latest.log`, `logs/debug.log`, and flat `logs/*.log.gz`. No subdirs. No `JadeErrorOutput.txt`.
- KubeJS is only classified when lines appear in those main logs (`ModErrorCategory.KUBEJS_SCRIPT`, silent-fail signatures).
- [`ModLogAnalyzer`](../../watchtower-core/src/main/java/dev/mcstatus/watchtower/core/analyze/ModLogAnalyzer.java) caps 25 mods / 5 recipes / 3 samples; [`ModIssuePeekBuilder`](../../watchtower-core/src/main/java/dev/mcstatus/watchtower/core/ops/ModIssuePeekBuilder.java) keeps top 5 by severity then volume.
- Census-style `Failed to parse recipe` may not match `ModErrorCategory.RECIPE_PARSE` (`Parsing error loading recipe …`), so huge WARN floods can be invisible or mis-bucketed.
- Forensic ground truth: Jade sidecar = **8 INSTANCE** events (5 InvWrapper + Lectern + cauldron + Create ClassCast), not 67 InvWrapper.

## Target behavior

| FB | Behavior |
| -- | -------- |
| FB-07 | Scan `logs/JadeErrorOutput.txt`; emit capped Issues signal `signal_jade_sidecar_compat` (or equivalent mod_issues / silent-fail style), severity informational/non-fatal, covering multi-exception classes |
| FB-09 | Include `logs/kubejs/server.log` and `logs/kubejs/startup.log` in LogScanner file set (prefer mtime window). Empty `client.log` must not fail tests. Evidence tags source path |
| FB-08 | Bulk recipe WARN floods (`createfood`, kubejs recipe parse) get `should_be_issue`-style demotion or lower peek priority so they do not occupy all 5 peek slots when higher-severity rows exist |
| FB-10 | DISTXFORM client-on-server and loot missing-dep bulk spam similarly demoted; still attributable on drill-down |

## Architecture

1. Extend `GzipLineReader.iterLogFiles` (or a sibling `iterExtraLogFiles`) to append:
   - `logs/JadeErrorOutput.txt` if present
   - `logs/kubejs/server.log`, `logs/kubejs/startup.log` if present  
   Keep gzip rotation logic unchanged for flat dir.
2. Add a small `JadeSidecarAnalyzer` (or branch in `LogScanner` / `ModLogAnalyzer`) that counts INSTANCE / exception class buckets and emits one capped optional/mod_log row.
3. Extend `ModErrorCategory` patterns for common recipe WARN phrasings used in this dump if missing.
4. Ranking: in `ModIssuePeekBuilder` (and/or `ModIssueAdvisor`), treat known flood categories (`recipe_parse` flood, `client_on_server`/DISTXFORM, loot_parse) as severity floor or skip when `total` exceeds a threshold unless no higher-signal rows remain.

Live tail (`OpsLogTailScanner`) stays latest.log-only for this phase (YAGNI); full LogScanner / report pass gets the sidecars.

## Testing

- Fixtures under `samples/fixtures/log-intelligence/`:
  - `jade-sidecar-compat/` — trimmed JadeErrorOutput with 8 INSTANCE shape
  - `kubejs-sidecar-ingestion/` — tiny server.log with recipe WARNs + empty client.log
  - `recipe-flood-createfood-kubejs/` — synthetic flood + one real ERROR to prove ranking
  - `distxform-loot-noise/` — synthetic spam + one higher-severity logger_error
- Unit tests for `GzipLineReader` file discovery and peek ranking.

## Constraints

- Advisory only; do not classify Jade as crash/outage.
- Do not download jars from Modrinth.
- Cap memory: do not store 50k recipe IDs; keep existing caps.
- Plain English issue titles.

## Plain English

After Phase 2, WatchTower reads Jade’s error file and KubeJS’s own logs, and recipe/boot spam stops burying the Issues list.
