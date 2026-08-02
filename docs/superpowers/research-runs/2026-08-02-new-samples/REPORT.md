# Sample gap research report — 2026-08-02-new-samples

## 1. Run metadata

| Field | Value |
| --- | --- |
| **SAMPLE_ROOT** | `samples/new samples 02.08.2026` |
| **RUN_ID** | `2026-08-02-new-samples` |
| **OUT_DIR** | `docs/superpowers/research-runs/2026-08-02-new-samples` |
| **Date** | 2026-08-02 |
| **Agent / human** | Cursor agent (Tasks 1–11 census + Tasks F1–F6 forensic) |
| **Pass status** | **Forensic complete** (supersedes census-only pass) |

---

## 2. Executive summary

This run audited a Create-heavy NeoForge 1.21.1 dedicated-server sample spanning Jul 29–Aug 2, 2026. Six crash reports and 44 log/sidecar files were inventoried.

**Pass history:** The first pass was census/scripts + crash replay only. That draft is **superseded** by the forensic pass: every non-duplicate scannable file was deep-read (47/47 notes + `read_complete` in the manifest), then triangulated against census and WatchTower replay in `forensic/cross-check.md`. Timeline, gap matrix, and fixture backlog were updated in place — no duplicate active findings.

Aug 1 was the incident day: five hard crashes driven by an OPAC Better Commands API mismatch (`NoSuchMethodError` on party chat command and listener paths) and a Sable physics body removed during sublevel save. Two watchdog crashes ~60 s later are follow-ups to those tick-loop deaths — dumps lack a `"Server thread"` (249 / 288 named threads), which strengthens the chain story over a standalone lag/watchdog read. Replay today still classifies them as standalone `watchdog` with `c2me_base` as primary and generic MSPT advice.

Jul 31 Spark shutdown crash is stop-path hygiene; the ISE is crash-report-only (rotate-body gap before Jul 31 `-2`; clean Spark stops never log it). Replay treats it as generic `mod_runtime`.

**Headline corrections from forensic deep-read:**

- Jade sidecar: **8 INSTANCE** events (not 67 InvWrapper NPEs) — census overcounted plugin-load / DEBUG matches
- Watchdog dumps: **missing `"Server thread"`** — chain evidence for follow-ups after tick death
- Spark: **rotate gap** — ISE absent from Jul 31 rotate bodies; crash file is the source of truth

Log corpus noise remains heavy: createfood/KubeJS recipe WARN flood, DISTXFORM and loot-parse spam, Jade/KubeJS sidecars outside the live LogScanner file set. Two Jul 29 signals became new backlog rows: login disconnect storm (FB-12) and GriefLogger × Create mounted-storage NPE (FB-13).

**Reconciliation (from `forensic/cross-check.md`):** confirmed **11** · revised **12** · rejected **0** · superseded **0** · new **2** (FB-12 / FB-13 added). Backlog is now **FB-01…FB-13** (zero P0; top P1 still FB-01…FB-05). Tick-lag chronic `Can't keep up` volume is detected and acceptable by design.

**Next:** open implementation writing-plans from `fixture-backlog.md` (start P1 FB-01–FB-05) or wait for more samples before coding.

---

## 3. Artifact pointers

| Artifact | Path |
| --- | --- |
| Timeline | [`timeline.md`](./timeline.md) |
| Gap matrix | [`gap-matrix.md`](./gap-matrix.md) |
| Fixture backlog | [`fixture-backlog.md`](./fixture-backlog.md) |
| Ingestion checklist | [`ingestion-checklist.md`](./ingestion-checklist.md) |
| Crash replay | [`crash-replay.json`](./crash-replay.json) |
| Full-corpus census | [`census.json`](./census.json) |
| File inventory | [`inventory.json`](./inventory.json) |
| Code map | [`code-map.md`](./code-map.md) |
| Forensic manifest | [`forensic/manifest.json`](./forensic/manifest.json) |
| Forensic cross-check | [`forensic/cross-check.md`](./forensic/cross-check.md) |
| Forensic per-file notes | [`forensic/files/`](./forensic/files/) |

Playbook: [`tools/sample-gap-research/README.md`](../../../tools/sample-gap-research/README.md)

---

## 4. Top P0 / P1 recommendations

No P0 items. Top P1 fixture backlog entries remain FB-01…FB-05 (details and acceptance in `fixture-backlog.md`). Full backlog is now **FB-01…FB-13** (FB-12 / FB-13 added from Jul 29 forensic signals).

| ID | Title |
| --- | --- |
| **FB-01** | OPAC Better Commands API mismatch — party chat command |
| **FB-02** | OPAC Better Commands API mismatch — party chat listener |
| **FB-03** | Watchdog follow-up after OPAC listener crash (20:43) |
| **FB-04** | Sable body removed on sublevel save |
| **FB-05** | Watchdog follow-up after Sable crash (21:50) |

---

## 5. Product code statement

**No product code changed.** This run produced research artifacts, census/replay JSON, forensic notes, and documentation only. WatchTower classifiers (`CrashClassifier`, `CrashNarrator`, `LogScanner`, etc.) were read and replayed against; no Java or dashboard source under `watchtower-core/src/main` (or elsewhere) was modified.

---

## 6. Next step

Open implementation **writing-plans** from `fixture-backlog.md` — recommended order: FB-01 → FB-05 (P1 crash intelligence), then FB-06–FB-09 / FB-12 (P2), then FB-10 / FB-11 / FB-13 (P3). Alternatively, hold until additional sample corpora arrive if the operator wants broader coverage before coding.

---

## Verification bar

All items confirmed for this run:

### Census / toolkit (prior pass — still done)

- [x] Every file class on ingestion checklist
- [x] Every crash has ground-truth + replay row
- [x] Full-corpus census completed
- [x] Gap matrix covers confirmed miss types
- [x] Every P0/P1 has fixture backlog entry with acceptance
- [x] No product code changed

### Forensic (F1–F6 — complete)

- [x] 47/47 forensic notes + manifest `read_complete`
- [x] Cross-check with prior-pass reconciliation
- [x] Timeline / gap-matrix / fixture-backlog updated in place (no duplicate active findings)
