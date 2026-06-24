# Spark fixture gap report

Generated from parser output of five real CPU profiles in `fixtures/spark/examples/` (JOKRisBest / NeoForge 1.21.1). Golden JSON lives in `samples/fixtures/spark/expected-*.json`.

## Fixture summary (parser output)

| Fixture | Grade | TPS 1m | MSPT p95 | Top non-vanilla mod | Timeline | Deep methods | Mod hints |
|---------|-------|--------|----------|---------------------|----------|--------------|-----------|
| H5BVV4Annz | critical | ~10.1 | ~121 | sable | 1 window | 30 | 5 |
| uUrbLpnMju | critical | ~7.7 | ~144 | sable | 2 windows | 30 | 5 |
| CXrvhrNd1R | degraded | ~19.3 | ~62 | create (low %) | 2 windows | 30 | 5 |
| VBK9P8wiBc | degraded | ~17.7 | ~71 | create (low %) | 2 windows | 30 | 5 |
| ZSz5E2HnRb | degraded | ~17.5 | ~68 | create (low %) | 2 windows | 30 | 5 |

**Note:** `mod_rollups[0]` is often `minecraft` because vanilla frames aggregate heavily; use `mod_hints` and non-vanilla rollups for mod attribution narrative.

## Parser → mock → UI gaps (v1)

| Parser field | In parser golden? | Rendered in UI (after fix) |
|--------------|-------------------|----------------------------|
| `timeline` (+ `cpu_process`, `start_at`, `end_at`) | All 5 | Yes — tier 2 timeline with optional CPU/time columns |
| `system.disk.used_pct` | All 5 | Yes — host stats + warn when >85% |
| `platform.spark_version` | All 5 | Yes — Capture details |
| `capture.server_configurations` | All 5 | Yes — config snapshot |
| `threads_analyzed` | All 5 | Yes — Capture details |
| `mod_hints` (all entries) | All 5 (up to 5) | Yes — Mod signals section |
| `mod_catalog` | All 5 | Mod friendly labels |
| `context.jvm_heap` | When present | Yes — MSPT KPI footnote |
| `heap_summary` | Only with `.sparkheap` | Yes — tier 3 Deep dive |
| `recommendations` workflow category | All 5 | Yes — no longer filtered |
| `deep.top_methods` | All 5 | Yes — tier 3 Deep dive |
| `threads_other` | Some | Yes — tier 3 Deep dive |
| `entity_hotspots` | When in metadata | Yes — World pressure |

## Filename mapping

| Original (examples/) | Tracked copy (`samples/fixtures/spark/`) | Mock `source_path` |
|----------------------|------------------------------------------|-------------------|
| `H5BVV4Annz.sparkprofile` | same | `watchtower/spark-upload/H5BVV4Annz.sparkprofile` |
| `CXrvhrNd1R.sparkprofile` | same | `watchtower/spark-upload/CXrvhrNd1R.sparkprofile` |
| `VBK9P8wiBc.sparkprofile` | same | `watchtower/spark-upload/VBK9P8wiBc.sparkprofile` |
| `ZSz5E2HnRb.sparkprofile` | same | `watchtower/spark-upload/ZSz5E2HnRb.sparkprofile` |
| `uUrbLpnMju (1).sparkprofile` | `uUrbLpnMju.sparkprofile` (renamed) | `watchtower/spark-upload/uUrbLpnMju.sparkprofile` |

## Regeneration

```bash
./gradlew :watchtower-core:sparkAuditFixtures
node web/dashboard/scripts/generate-spark-mocks.mjs
```
