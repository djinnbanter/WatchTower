# Activity Server Diary (1.1.24) Implementation Plan

> Copied from Cursor plan for repo tracking. Execute via subagent-driven-development or executing-plans.

See: `docs/superpowers/specs/2026-08-02-activity-server-diary-design.md`

**Goal:** Activity answers “what changed on this box?” via pack-change scanning + UI.

**Shipped (this branch):** PackChangeActivityScanner, StateManager `pack_change_snapshot`, MAX_LEDGER_EVENTS=1500, OpsScanService.scanPackChanges, Activity UI Changes filter + types, wiki + preview fixtures.
