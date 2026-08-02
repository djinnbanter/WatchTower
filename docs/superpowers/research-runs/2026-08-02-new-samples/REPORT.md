# Sample gap research report — 2026-08-02-new-samples

## 1. Run metadata

| Field | Value |
| --- | --- |
| **SAMPLE_ROOT** | `samples/new samples 02.08.2026` |
| **RUN_ID** | `2026-08-02-new-samples` |
| **OUT_DIR** | `docs/superpowers/research-runs/2026-08-02-new-samples` |
| **Date** | 2026-08-02 |
| **Agent / human** | Cursor agent (Tasks 1–10, log-sample-gap-research SDD) |

---

## 2. Executive summary

This run audited a Create-heavy NeoForge 1.21.1 dedicated-server sample spanning Jul 29–Aug 2, 2026. Six crash reports and 44 log/sidecar files were inventoried; full-corpus census and crash replay against current WatchTower classifiers completed without changing product code.

Aug 1 was the incident day: five hard crashes driven by an OPAC Better Commands API mismatch (`NoSuchMethodError` on party chat command and listener paths) and a Sable physics body removed during sublevel save. Two watchdog crashes ~60 s later are follow-ups to those tick-loop deaths, not independent root incidents — but replay today classifies them as standalone `watchdog` with `c2me_base` as primary and generic MSPT advice.

Jul 31 Spark shutdown crash is stop-path hygiene, not mid-session instability; replay treats it as generic `mod_runtime`. Log corpus noise is heavy: createfood/KubeJS recipe WARN flood (~108k lines), DISTXFORM client-on-server and loot-parse spam, and Jade/KubeJS sidecar files outside the live LogScanner file set.

Eleven confirmed gaps map to fixture backlog entries FB-01 through FB-11 (zero P0; five P1 crash-intelligence items; six P2/P3 log-ingestion and noise items). Tick-lag chronic `Can't keep up` volume is detected and acceptable by design.

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

Playbook: [`tools/sample-gap-research/README.md`](../../../tools/sample-gap-research/README.md)

---

## 4. Top P0 / P1 recommendations

No P0 items. P1 fixture backlog entries (details and acceptance criteria in `fixture-backlog.md`):

| ID | Title |
| --- | --- |
| **FB-01** | OPAC Better Commands API mismatch — party chat command |
| **FB-02** | OPAC Better Commands API mismatch — party chat listener |
| **FB-03** | Watchdog follow-up after OPAC listener crash (20:43) |
| **FB-04** | Sable body removed on sublevel save |
| **FB-05** | Watchdog follow-up after Sable crash (21:50) |

---

## 5. Product code statement

**No product code changed.** This run produced research artifacts, census/replay JSON, and documentation only. WatchTower classifiers (`CrashClassifier`, `CrashNarrator`, `LogScanner`, etc.) were read and replayed against; no Java or dashboard source was modified.

---

## 6. Next step

Open implementation **writing-plans** from `fixture-backlog.md` — recommended order: FB-01 → FB-05 (P1 crash intelligence), then FB-06–FB-09 (P2 ingestion and noise). Alternatively, hold until additional sample corpora arrive if the operator wants broader coverage before coding.

---

## Verification bar

All items confirmed for this run:

- [x] Every file class on ingestion checklist
- [x] Every crash has ground-truth + replay row
- [x] Full-corpus census completed
- [x] Gap matrix covers confirmed miss types
- [x] Every P0/P1 has fixture backlog entry with acceptance
- [x] No product code changed
