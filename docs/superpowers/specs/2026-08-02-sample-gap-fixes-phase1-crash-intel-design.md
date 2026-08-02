# Sample-gap fixes — Phase 1: crash intelligence (design)

**Date:** 2026-08-02  
**Status:** Approved for planning (approach A: fixture-first TDD)  
**Research:** [`docs/superpowers/research-runs/2026-08-02-new-samples/`](../research-runs/2026-08-02-new-samples/)  
**Backlog:** FB-01 … FB-06  
**Follow-on:** Phase 2 ingest/noise, Phase 3 join/DB

## Goal

Make WatchTower tell the truth about the Aug 1 / Jul 31 hard crashes: name OPAC version mismatch, treat Spark stop-path as shutdown noise, give Sable save-context Fix text, and chain ~60s watchdogs to the prior crash with the right primary and Fix (not `c2me_base` + MSPT-only advice).

## Scope

| In | Out |
| -- | --- |
| FB-01 OPAC NSM command | FB-07…FB-13 |
| FB-02 OPAC NSM listener | Dashboard redesign |
| FB-03 Watchdog follow-up after OPAC | Auto-restart / jar mutation |
| FB-04 Sable body-removed advice | Fabric loader work |
| FB-05 Watchdog follow-up after Sable | |
| FB-06 Spark shutdown_noise | |

## Current behavior (facts)

- `CrashClassifier` has no `api_version_mismatch` or `shutdown_noise`. NSM → `mod_runtime`. Spark stop ISE → `mod_runtime`.
- `IncidentChainBuilder.link()` already pairs `mod_runtime`/`category=mod` → watchdog within 120s and sets `failure_kind=watchdog_followup` + `paired_primary_file` + `incident_id`.
- `FactsBuilder` calls `CrashNarrator.narrate` **before** `link()`, and `link()` does **not** rewrite `primary_mod_id` or Fix. Follow-ups keep `c2me_base` and generic watchdog narrative.
- Research `SampleCrashReplayHarness` never calls `link()`, so research JSON understated live kind-linking.

## Target behavior

| FB | failure_kind | primary | Fix must include |
| -- | ------------ | ------- | ---------------- |
| FB-01 / FB-02 | `api_version_mismatch` | `opac_better_commands` | Align Better Commands with installed OPAC version; or remove until compatible |
| FB-03 | `watchdog_followup` (after link) | `opac_better_commands` (from primary) | Link to prior OPAC crash; paired file; not c2me-as-root |
| FB-04 | `mod_runtime` | `sable_rapier` | Sublevel save / stale body / Create carriage context |
| FB-05 | `watchdog_followup` | `sable_rapier` | Link to prior Sable crash |
| FB-06 | `shutdown_noise` | `spark` | Stop-path hygiene; non-issue / low priority framing |

Optional detail: when watchdog dump text has no `"Server thread"`, set `details.missing_server_thread=true` and mention it in follow-up Fix as chain evidence.

## Architecture

```
CrashClassifier.classify
  → CrashNarrator.narrate
  → IncidentChainBuilder.link   (kind + paired_primary_file + copy primary_mod_id)
  → CrashNarrator.enrichAfterChain(summaries)  // rewrite follow-up plain_english / fix_hints
```

New constants on `CrashClassifier`:

- `FK_API_VERSION_MISMATCH = "api_version_mismatch"`
- `FK_SHUTDOWN_NOISE = "shutdown_noise"`

Classifier placement: after NBT/watchdog/OOM early exits, before or inside mod-related branch — detect:

1. Spark: `Profiler job no longer active` + stop-path frames (`handleServerStopping` / `NeoForgeServerSparkPlugin.onDisable` / similar).
2. NSM: `NoSuchMethodError` + primary/suspect in OPAC Better Commands family calling into `xaero.pac` / `openpartiesandclaims` API — kind `api_version_mismatch`, hints version-align.

Sable: keep kind; narrator special-case on `Body has been removed` + `SubLevelSerializer` / Sable sublevel + Create carriage evidence.

## Testing

- Extend `samples/fixtures/crash-intelligence/` with trimmed copies from `samples/new samples 02.08.2026/crash-reports/`.
- Update `expected.json` schema `failure_kinds` list; add cases; extend `CrashIntelGoldenTest` for paired cases to assert follow-up `primary_mod_id`.
- Unit tests: `CrashClassifierTest`, `CrashNarratorTest`, `IncidentChainBuilderTest`.
- Fix `SampleCrashReplayHarness` for research parity.

## Constraints

- Advisory only; plain English Fix; brand WatchTower.
- NeoForge 1.21 / Java 21; `watchtower-core` only for product code.
- Do not invent Modrinth downloads.
- YAGNI: no generic “any NoSuchMethodError between any two mods” mega-framework beyond evidence-backed heuristics that cover this dump and obvious same-pattern cases.

## Plain English

After Phase 1, operators see: “these two OPAC mods don’t match,” “this watchdog is the aftermath of that crash,” “Sable blew up on save,” and “Spark glitched while stopping — not mid-play instability.”
