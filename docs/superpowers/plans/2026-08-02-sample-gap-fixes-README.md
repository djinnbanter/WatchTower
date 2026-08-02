# Sample-gap product fixes — umbrella (Phases 1–3)

Use this when you want **one Cursor plan / one agent session** to implement all research gaps FB-01…FB-13. Specs and bite-sized plans already exist; do not reinvent them.

## Research source

- Run: [`docs/superpowers/research-runs/2026-08-02-new-samples/`](../research-runs/2026-08-02-new-samples/)
- Backlog: [`fixture-backlog.md`](../research-runs/2026-08-02-new-samples/fixture-backlog.md)
- Cross-check: [`forensic/cross-check.md`](../research-runs/2026-08-02-new-samples/forensic/cross-check.md)

## Specs (design)

| Phase | Spec | FB ids |
| --- | --- | --- |
| 1 Crash intel | [`../specs/2026-08-02-sample-gap-fixes-phase1-crash-intel-design.md`](../specs/2026-08-02-sample-gap-fixes-phase1-crash-intel-design.md) | FB-01…FB-06 |
| 2 Ingest + noise | [`../specs/2026-08-02-sample-gap-fixes-phase2-ingest-noise-design.md`](../specs/2026-08-02-sample-gap-fixes-phase2-ingest-noise-design.md) | FB-07…FB-10 |
| 3 Join + DB | [`../specs/2026-08-02-sample-gap-fixes-phase3-join-db-design.md`](../specs/2026-08-02-sample-gap-fixes-phase3-join-db-design.md) | FB-11…FB-13 |

## Implementation plans (execute in order)

| Order | Plan | Verify |
| --- | --- | --- |
| 1 | [`2026-08-02-sample-gap-fixes-phase1-crash-intel.md`](./2026-08-02-sample-gap-fixes-phase1-crash-intel.md) | `./gradlew :watchtower-core:test` |
| 2 | [`2026-08-02-sample-gap-fixes-phase2-ingest-noise.md`](./2026-08-02-sample-gap-fixes-phase2-ingest-noise.md) | `./gradlew :watchtower-core:test` |
| 3 | [`2026-08-02-sample-gap-fixes-phase3-join-db.md`](./2026-08-02-sample-gap-fixes-phase3-join-db.md) | `./gradlew :watchtower-core:test` |

## Suggested Cursor mega-plan prompt

```text
Implement all three sample-gap fix phases in order using subagent-driven-development.
Do not edit Cursor plan files under .cursor/plans/.
Follow these plans exactly (checkboxes, TDD, commits per task):
1. docs/superpowers/plans/2026-08-02-sample-gap-fixes-phase1-crash-intel.md
2. docs/superpowers/plans/2026-08-02-sample-gap-fixes-phase2-ingest-noise.md
3. docs/superpowers/plans/2026-08-02-sample-gap-fixes-phase3-join-db.md
Specs are the design source of truth under docs/superpowers/specs/2026-08-02-sample-gap-fixes-phase*-design.md.
Research acceptance: docs/superpowers/research-runs/2026-08-02-new-samples/fixture-backlog.md.
After each phase: ./gradlew :watchtower-core:test must pass before starting the next.
No dashboard redesign. Advisory only. Brand WatchTower.
```

## Approach locked in brainstorming

- Scope: all FB-01…FB-13, **phased**
- Phase 1 method: **fixture-first TDD (A)**
- Watchdog chain: extend existing `IncidentChainBuilder` (rewrite primary + Fix after link); do not invent linking from scratch

## Plain English

Three shippable slices: (1) tell the truth about crashes and chained watchdogs, (2) read Jade/KubeJS sidecars and quiet log spam, (3) flag login storms and GriefLogger DB/Create problems.
