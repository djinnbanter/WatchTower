# Sample gap research toolkit

Reusable corpus → gap audit → fixture backlog helpers for WatchTower.

## Inputs
- `--sample` / `SAMPLE_ROOT`: folder with `logs/` and optional `crash-reports/`
- `--out` / `OUT_DIR`: `docs/superpowers/research-runs/<RUN_ID>/`
- Java: `-Dwt.sample.root=...` `-Dwt.research.out=...`

## Spec / plan
- docs/superpowers/specs/2026-08-02-log-sample-gap-research-design.md
- docs/superpowers/plans/2026-08-02-log-sample-gap-research.md

## Verification bar

Before closing a run (`REPORT.md`), confirm all of the following:

- [ ] Every file class on ingestion checklist
- [ ] Every crash has ground-truth + replay row
- [ ] Full-corpus census completed
- [ ] Gap matrix covers confirmed miss types
- [ ] Every P0/P1 has fixture backlog entry with acceptance
- [ ] No product code changed

Tick these in the run's `REPORT.md` when true.

## Do not
- Change product classifiers in a research run
- Reuse an existing RUN_ID folder
- Double-count files inside mega.tar.gz / nested archives that already exist as peers

## Agent prompt (copy/paste)

Run the log sample gap research playbook on `SAMPLE_ROOT_HERE` with
`RUN_ID=YYYY-MM-DD-label` per
`docs/superpowers/specs/2026-08-02-log-sample-gap-research-design.md` and
`docs/superpowers/plans/2026-08-02-log-sample-gap-research.md`.

If `tools/sample-gap-research/` already exists and matches the plan, skip Tasks 1–4
and execute Tasks 5–11 for the new run only. Write artifacts under
`docs/superpowers/research-runs/<RUN_ID>/`. Do not change product classifiers.
