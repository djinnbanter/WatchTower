# Sample gap research toolkit

Reusable corpus → gap audit → fixture backlog helpers for WatchTower.

## Inputs
- `--sample` / `SAMPLE_ROOT`: folder with `logs/` and optional `crash-reports/`
- `--out` / `OUT_DIR`: `docs/superpowers/research-runs/<RUN_ID>/`
- Java: `-Dwt.sample.root=...` `-Dwt.research.out=...`

## Spec / plan
- docs/superpowers/specs/2026-08-02-log-sample-gap-research-design.md
- docs/superpowers/plans/2026-08-02-log-sample-gap-research.md

## Ground truth rule

**Census scripts are not enough.** Every run must also:

1. AI forensic deep-read of **every** non-duplicate scannable file (start→end, every line)
2. Write `forensic/files/*.md` notes + `forensic/manifest.json` (`read_complete: true`)
3. Three-way cross-check in `forensic/cross-check.md` (AI ↔ census ↔ WatchTower)
4. Refresh timeline / gap-matrix / fixture-backlog / REPORT from that triangulation

See plan Tasks **F1–F6**.

## Verification bar

Before closing a run (`REPORT.md`), confirm all of the following:

- [ ] Every file class on ingestion checklist
- [ ] Every crash has ground-truth + replay row
- [ ] Full-corpus census completed
- [ ] Every non-duplicate scannable file has forensic `read_complete: true` + note
- [ ] `forensic/cross-check.md` documents AI ↔ census ↔ WT
- [ ] Gap matrix covers confirmed miss types
- [ ] Every P0/P1 has fixture backlog entry with acceptance
- [ ] No product code changed

Tick these in the run's `REPORT.md` when true.

## Do not
- Change product classifiers in a research run
- Reuse an existing RUN_ID folder
- Double-count files inside mega.tar.gz / nested archives that already exist as peers
- Treat census or crash-replay alone as a substitute for reading every file

## Agent prompt (copy/paste)

Run the log sample gap research playbook on `SAMPLE_ROOT_HERE` with
`RUN_ID=YYYY-MM-DD-label` per
`docs/superpowers/specs/2026-08-02-log-sample-gap-research-design.md` and
`docs/superpowers/plans/2026-08-02-log-sample-gap-research.md`.

If `tools/sample-gap-research/` already exists and matches the plan, skip Tasks 1–4.
Execute Tasks 5–11 and **Tasks F1–F6** (AI forensic deep-read of every file
start-to-end, every line; three-way cross-check AI vs census vs WatchTower;
refresh timeline/gaps/backlog/REPORT). Write artifacts under
`docs/superpowers/research-runs/<RUN_ID>/`. Do not change product classifiers.
Do not treat census alone as ground truth.
