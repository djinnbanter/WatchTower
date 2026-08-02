# Spark fixture gap report

Generated from parser output of real CPU profiles under `samples/fixtures/spark/` (and `fixtures/spark/examples/` when present). Golden JSON lives in `samples/fixtures/spark/expected-*.json`.

## Fixture summary (parser output)

| Fixture | Loader / engine | Grade | TPS 1m | MSPT p95 | Top actionable hint | Timeline | Distinctive signals |
|---------|-----------------|-------|--------|----------|---------------------|----------|---------------------|
| H5BVV4Annz | NeoForge / async | critical | ~10.1 | ~121 | sable | 1 window | Entity hotspots, sable hints |
| uUrbLpnMju | NeoForge / async | critical | ~7.7 | ~144 | sable | 2 windows | Same family as H5 |
| CXrvhrNd1R | NeoForge / async | degraded→critical* | ~19.3 | ~62 | create | 2 windows | Unattended nether hotspots; stall grading |
| VBK9P8wiBc | NeoForge / async | degraded | ~17.7 | ~71 | create (low %) | 2 windows | create / entity composition |
| ZSz5E2HnRb | NeoForge / async | degraded | ~17.5 | ~68 | create (low %) | 2 windows | create / entity composition |
| profile-2026-07-23_20.37.29 | NeoForge / async | critical | ~12.0 | ~123 | create (~8%) | **10 windows** (~10 min) | `shopping_district`; automation_cluster ~51% |
| homestead-prod …12.59.52 | **Fabric / java** | critical | ~11.0 | high | **create** (pehkui demoted) | 1 window | mushlings + items; `otherside`; datapacks |
| homestead-prod …13.30.25 | **Fabric / java** | degraded | ~13.7 | mid | create / actionable | **2 windows** | hanging_wire; multi-window Fabric |
| homestead-staging …07.25.40 | **Fabric / java** | healthy | 20.0 | ~2 | (quiet) | 1 window | 0 players; **marker crowd**; unattended suppressed |

\*CXR may grade critical when worst hitch thresholds fire despite mid TPS.

**Note:** `mod_rollups[0]` is often `minecraft` because vanilla frames aggregate heavily; use `mod_hints` and non-vanilla rollups for mod attribution narrative. Infrastructure libs (`pehkui`, `forgeconfigapiport`, Fabric API jars, `architectury`, `mixinextras`, …) stay in full rollups but are demoted from operator-facing hints / own-share picks.

## Homestead Fabric family (what it locks)

| Area | Homestead signal | Disposition |
|------|------------------|-------------|
| Entity composition Create-only | mushlings / markers dominate counts | **Fixed** — `dominant_custom_*`, `markers` / `marker_share_pct`, `notable_entities[]`; composition finding cites them |
| Hint noise (pehkui / FCAP / Fabric API) | pehkui topped hints over Create | **Fixed** — infrastructure denylist for hints + own-share / involvement picks |
| Datapacks opaque in `platform.extra` | 30–40 packs as JSON blob | **Fixed** — `context.datapacks` + `capture.datapacks` `{id,name,source}`; Technical UI; soft finding when many world/unknown packs |
| No Fabric / `java`-engine fixtures in CI | coverage hole | **Fixed** — three curated goldens + character tests + alpha/legacy mocks + smoke |
| Healthy empty hotspot noise | staging 20 TPS still pushed unattended | **Fixed** — suppress `unattended_hotspots` + soften hotspot/concentration when healthy + 0 players + excellent MSPT; marker-aware copy |
| Create under-communicated at ~2.5% own | below own-share threshold | **Fixed** — soft `spark.source.create.present` info finding |
| Allocation / `.sparkheap` / `threads_other` | still absent | **Deferred** — same as prior NeoForge set |

## What’s different in `profile-2026-07-23_20.37.29`

| Area | This capture | Typical older fixtures |
|------|--------------|------------------------|
| Duration / windows | ~10 min, 10 timeline windows | ~60–90s, 1–2 windows |
| Mode | execution / async | same |
| Worlds | includes custom `shopping_district` | usually vanilla dims only |
| Composition | automation_cluster ~50% (items-heavy) | similar schema, smaller totals |
| Viewer URL | none (dated filename ≠ bytebin id) | often present for 10-char keys |
| `threads_other` / heap | absent | absent |

## Gaps this profile surfaced (and disposition)

| Gap | Disposition |
|-----|-------------|
| Timeline UI preferred `mspt_max` over `mspt_median` (charts looked like constant hitch peaks) | **Fixed** — alpha `timeline()` uses median first; table shows Typical + Peak |
| Multi-window captures lacked CPU column / range strip / time-labeled windows | **Fixed** — Timeline tab when `cpu_process` present |
| `automation_share_pct` in golden unused in World UI | **Fixed** — Fact under composition pie |
| No fixture character lock for this capture | **Fixed** — `SparkFixtureAuditTest` case |
| Allocation mode / `heap_summary` / `threads_other` | **Deferred** — not present in this file |
| createbigcannons / mannequin as separate rollups | **Deferred** — not dominant in parser output; create remains top non-vanilla |

## Parser → mock → UI gaps (v1)

| Parser field | In parser golden? | Rendered in UI (after fix) |
|--------------|-------------------|----------------------------|
| `timeline` (+ `cpu_process`, `start_at`, `end_at`) | All | Yes — multi-window chart, typical/peak ms, optional CPU |
| `system.disk.used_pct` | All | Yes — host stats + warn when >85% |
| `platform.spark_version` | All | Yes — Capture details |
| `capture.server_configurations` | All | Yes — config snapshot |
| `threads_analyzed` | All | Yes — Capture details |
| `mod_hints` (all entries) | All (up to 5, infra demoted) | Yes — Mod signals section |
| `mod_catalog` | All | Mod friendly labels |
| `context.jvm_heap` | When present | Yes — MSPT KPI footnote |
| `heap_summary` | Only with `.sparkheap` | Yes — tier 3 Deep dive |
| `recommendations` workflow category | All | Yes — no longer filtered |
| `deep.top_methods` | All | Yes — tier 3 Deep dive |
| `threads_other` | Some | Yes — tier 3 Deep dive |
| `entity_hotspots` | When in metadata | Yes — World pressure |
| `entity_composition.automation_*` | All with world stats | Yes — pie parts + automation share fact |
| `entity_composition.dominant_custom_*` / `markers` | When world stats present | Yes — World facts; findings copy |
| `context.datapacks` / `capture.datapacks` | When Spark extra present | Yes — Technical section; Overview count when ≥8 |

## Filename mapping

| Original (examples/) | Tracked copy (`samples/fixtures/spark/`) | Mock `source_path` |
|----------------------|------------------------------------------|-------------------|
| `H5BVV4Annz.sparkprofile` | same | `watchtower/spark-upload/H5BVV4Annz.sparkprofile` |
| `CXrvhrNd1R.sparkprofile` | same | `watchtower/spark-upload/CXrvhrNd1R.sparkprofile` |
| `VBK9P8wiBc.sparkprofile` | same | `watchtower/spark-upload/VBK9P8wiBc.sparkprofile` |
| `ZSz5E2HnRb.sparkprofile` | same | `watchtower/spark-upload/ZSz5E2HnRb.sparkprofile` |
| `uUrbLpnMju (1).sparkprofile` | `uUrbLpnMju.sparkprofile` (renamed) | `watchtower/spark-upload/uUrbLpnMju.sparkprofile` |
| `profile-2026-07-23_20.37.29.sparkprofile` | same | `watchtower/spark-upload/profile-2026-07-23_20.37.29.sparkprofile` |
| `homestead-prod_profile-2026-07-13_12.59.52.sparkprofile` | same | `watchtower/spark-upload/homestead-prod_profile-2026-07-13_12.59.52.sparkprofile` |
| `homestead-prod_profile-2026-07-13_13.30.25.sparkprofile` | same | `watchtower/spark-upload/homestead-prod_profile-2026-07-13_13.30.25.sparkprofile` |
| `homestead-staging_profile-2026-07-13_07.25.40.sparkprofile` | same | `watchtower/spark-upload/homestead-staging_profile-2026-07-13_07.25.40.sparkprofile` |

## Regeneration

```bash
./gradlew :watchtower-core:sparkAuditFixtures
node web/dashboard/scripts/generate-spark-mocks.mjs
node web/dashboard/scripts/generate-spark-mocks.mjs
```
