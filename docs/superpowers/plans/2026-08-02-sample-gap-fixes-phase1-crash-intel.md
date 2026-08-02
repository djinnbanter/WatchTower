# Sample-gap fixes Phase 1 — Crash intelligence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fixture-first TDD so WatchTower classifies OPAC NSM as `api_version_mismatch`, Spark stop-path as `shutdown_noise`, Sable save crashes with save-context Fix, and post-link watchdogs inherit the prior crash primary + Fix (FB-01…FB-06).

**Architecture:** Extend `CrashClassifier` / `CrashNarrator`; after `IncidentChainBuilder.link()`, copy `primary_mod_id` onto the follow-up and call `CrashNarrator.enrichAfterChain` so Fix is rewritten after linking (FactsBuilder currently narrates before link).

**Tech Stack:** Java 21, JUnit 5, Gson, Gradle `:watchtower-core:test`, fixtures under `samples/fixtures/crash-intelligence/`.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-02-sample-gap-fixes-phase1-crash-intel-design.md`
- Research acceptance: `docs/superpowers/research-runs/2026-08-02-new-samples/fixture-backlog.md` FB-01…FB-06
- Advisory only; plain-English Fix; brand WatchTower; no Modrinth downloads; no dashboard redesign
- Product code limited to `watchtower-core` (+ research harness under test)
- Do not edit the Cursor plan file under `.cursor/plans/`

---

### Task 1: Design already on disk — confirm + fixture skeleton

**Files:**
- Read: `docs/superpowers/specs/2026-08-02-sample-gap-fixes-phase1-crash-intel-design.md`
- Create: `samples/fixtures/crash-intelligence/opac-nsm-command.txt` (trimmed from sample)
- Create: `samples/fixtures/crash-intelligence/opac-nsm-listener.txt`
- Create: `samples/fixtures/crash-intelligence/spark-shutdown-profiler.txt`
- Create: `samples/fixtures/crash-intelligence/sable-body-removed-save.txt`
- Create: `samples/fixtures/crash-intelligence/watchdog-opac-followup-2043.txt`
- Create: `samples/fixtures/crash-intelligence/watchdog-sable-followup-2150.txt`

**Interfaces:**
- Consumes: sample paths under `samples/new samples 02.08.2026/crash-reports/`
- Produces: fixture `.txt` files readable by `CrashReportParser` + `CrashClassifier`

- [ ] **Step 1: Copy/trim crash reports into fixtures**

Keep enough of each file for classification: header time, description, exception, stack frames naming OPAC / Spark / Sable / ServerHangWatchdog / thread list (for missing Server thread). Prefer under ~400 lines each if possible; full stacks OK if needed.

Source map:
| Fixture | Source |
| --- | --- |
| `opac-nsm-command.txt` | `crash-2026-08-01_19.24.51-server.txt` |
| `opac-nsm-listener.txt` | `crash-2026-08-01_20.42.00-server.txt` |
| `watchdog-opac-followup-2043.txt` | `crash-2026-08-01_20.43.06-server.txt` |
| `sable-body-removed-save.txt` | `crash-2026-08-01_21.49.17-server.txt` |
| `watchdog-sable-followup-2150.txt` | `crash-2026-08-01_21.50.21-server.txt` |
| `spark-shutdown-profiler.txt` | `crash-2026-07-31_17.27.20-server.txt` |

- [ ] **Step 2: Commit fixtures only**

```bash
git add samples/fixtures/crash-intelligence/
git commit -m "test(fixtures): add sample-gap Phase 1 crash intelligence crash files"
```

---

### Task 2: Failing goldens for OPAC + Spark (today’s wrong kinds)

**Files:**
- Modify: `samples/fixtures/crash-intelligence/expected.json`
- Modify: `watchtower-core/src/test/java/dev/mcstatus/watchtower/core/collect/CrashIntelGoldenTest.java` (only if new cases need paired primary assert later)
- Test: existing golden test

**Interfaces:**
- Consumes: fixture files from Task 1
- Produces: expected cases that **currently fail** until Task 3 implements classifier

- [ ] **Step 1: Add expected cases that assert TARGET kinds (will fail)**

In `expected.json`, add to `failure_kinds` array: `"api_version_mismatch"`, `"shutdown_noise"`.

Add cases:

```json
"opac-nsm-command": {
  "file": "opac-nsm-command.txt",
  "expected": {
    "failure_kind": "api_version_mismatch",
    "primary_mod_id": "opac_better_commands",
    "category": "mod"
  }
},
"opac-nsm-listener": {
  "file": "opac-nsm-listener.txt",
  "expected": {
    "failure_kind": "api_version_mismatch",
    "primary_mod_id": "opac_better_commands",
    "category": "mod"
  }
},
"spark-shutdown-profiler": {
  "file": "spark-shutdown-profiler.txt",
  "expected": {
    "failure_kind": "shutdown_noise",
    "primary_mod_id": "spark",
    "category": "mod"
  }
}
```

- [ ] **Step 2: Run golden test — expect FAIL**

```bash
./gradlew :watchtower-core:test --tests dev.mcstatus.watchtower.core.collect.CrashIntelGoldenTest
```

Expected: FAIL — actual `mod_runtime` vs expected new kinds.

- [ ] **Step 3: Commit failing expectations**

```bash
git add samples/fixtures/crash-intelligence/expected.json
git commit -m "test: golden expectations for OPAC api_version_mismatch and Spark shutdown_noise"
```

---

### Task 3: Implement classifier + narrator for FB-01, FB-02, FB-06

**Files:**
- Modify: `watchtower-core/src/main/java/dev/mcstatus/watchtower/core/analyze/CrashClassifier.java`
- Modify: `watchtower-core/src/main/java/dev/mcstatus/watchtower/core/analyze/CrashNarrator.java`
- Test: `watchtower-core/src/test/java/dev/mcstatus/watchtower/core/CrashClassifierTest.java`
- Test: `watchtower-core/src/test/java/dev/mcstatus/watchtower/core/analyze/CrashNarratorTest.java`

**Interfaces:**
- Produces:
  - `CrashClassifier.FK_API_VERSION_MISMATCH = "api_version_mismatch"`
  - `CrashClassifier.FK_SHUTDOWN_NOISE = "shutdown_noise"`
  - Classification for OPAC NSM + Spark shutdown
  - Narrator plain English / fix hints matching backlog must-include

- [ ] **Step 1: Write unit tests for classifier**

```java
@Test
void opacNoSuchMethodIsApiVersionMismatch() throws Exception {
    Path p = resolveFixture("opac-nsm-command.txt");
    String text = Files.readString(p);
    var parsed = CrashReportParser.parse(text, List.of());
    JsonObject report = new JsonObject();
    parsed.applyTo(report);
    var c = CrashClassifier.classify(report);
    assertEquals(CrashClassifier.FK_API_VERSION_MISMATCH, c.failureKind());
    assertEquals("opac_better_commands", c.primaryModId());
}

@Test
void sparkProfilerInactiveOnStopIsShutdownNoise() throws Exception {
    Path p = resolveFixture("spark-shutdown-profiler.txt");
    // same parse/classify pattern
    var c = CrashClassifier.classify(report);
    assertEquals(CrashClassifier.FK_SHUTDOWN_NOISE, c.failureKind());
    assertEquals("spark", c.primaryModId());
}
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
./gradlew :watchtower-core:test --tests dev.mcstatus.watchtower.core.CrashClassifierTest
```

- [ ] **Step 3: Add FK constants and classify branches**

In `CrashClassifier.java` near other `FK_*`:

```java
public static final String FK_API_VERSION_MISMATCH = "api_version_mismatch";
public static final String FK_SHUTDOWN_NOISE = "shutdown_noise";
```

Before generic `isModRelated` return of `FK_MOD_RUNTIME` (around the mod-related block ~304–318):

1. If scan/combined contains `profiler job no longer active` AND stop-path evidence (`handleserverstopping` or `neoforgeserversparkplugin` / `ondisable` + spark) → return Classification category `mod`, kind `FK_SHUTDOWN_NOISE`, primary `spark`, hints: stop-path / non-issue hygiene.
2. If exception/scan contains `NoSuchMethodError` AND (primary/suspect is `opac_better_commands` OR stack has `opac_better_commands`) AND scan has `xaero.pac` / `getPlayerConfigs` → `FK_API_VERSION_MISMATCH`, primary `opac_better_commands`, hints: align Better Commands with OpenPartiesAndClaims version / remove until compatible.

- [ ] **Step 4: Narrator branches**

In `CrashNarrator`, before generic mod_runtime advice:

- If `FK_SHUTDOWN_NOISE`: plain English about server stop path / low priority; Fix must not say “gameplay instability.”
- If `FK_API_VERSION_MISMATCH`: plain English that Better Commands and OPAC versions don’t match; Fix must include version alignment language.

- [ ] **Step 5: Run goldens + unit tests — expect PASS**

```bash
./gradlew :watchtower-core:test --tests dev.mcstatus.watchtower.core.collect.CrashIntelGoldenTest --tests dev.mcstatus.watchtower.core.CrashClassifierTest --tests dev.mcstatus.watchtower.core.analyze.CrashNarratorTest
```

- [ ] **Step 6: Commit**

```bash
git add watchtower-core/src/main/java/dev/mcstatus/watchtower/core/analyze/CrashClassifier.java \
  watchtower-core/src/main/java/dev/mcstatus/watchtower/core/analyze/CrashNarrator.java \
  watchtower-core/src/test/java/dev/mcstatus/watchtower/core/CrashClassifierTest.java \
  watchtower-core/src/test/java/dev/mcstatus/watchtower/core/analyze/CrashNarratorTest.java
git commit -m "feat(crash): classify OPAC NSM as api_version_mismatch and Spark stop as shutdown_noise"
```

---

### Task 4: Sable body-removed Fix context (FB-04)

**Files:**
- Modify: `CrashNarrator.java`
- Modify: `expected.json` (add sable case — kind stays `mod_runtime`)
- Test: `CrashNarratorTest.java`

**Interfaces:**
- Consumes: `sable-body-removed-save.txt`
- Produces: narrative Fix mentioning sublevel save / stale physics body / Create carriage; primary remains `sable_rapier`

- [ ] **Step 1: Failing narrator test**

```java
@Test
void sableBodyRemovedMentionsSublevelSave() throws Exception {
    // parse sable fixture, classify, narrate
    assertEquals("sable_rapier", c.primaryModId());
    assertEquals(CrashClassifier.FK_MOD_RUNTIME, c.failureKind());
    String plain = n.plainEnglish().toLowerCase(Locale.ROOT);
    assertTrue(plain.contains("sublevel") || plain.contains("body") || plain.contains("save"));
    // fix hints must not be ONLY generic update/remove
    String hints = n.fixHints().toString().toLowerCase(Locale.ROOT);
    assertTrue(hints.contains("sublevel") || hints.contains("save") || hints.contains("carriage")
            || hints.contains("physics"));
}
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement narrator special-case**

When primary/suspect is `sable_rapier` (or stack has Sable) AND text has `Body has been removed` / `SubLevelSerializer`: set plain English + hints about sublevel save / stale body / Create carriage; do not blame `create` as primary.

- [ ] **Step 4: Run PASS + commit**

```bash
git commit -m "feat(crash): Sable body-removed Fix includes sublevel save context"
```

---

### Task 5: Post-link primary rewrite + enrichAfterChain (FB-03, FB-05)

**Files:**
- Modify: `IncidentChainBuilder.java`
- Modify: `CrashNarrator.java` — add `public static void enrichAfterChain(JsonArray summaries)`
- Modify: `FactsBuilder.java` — call enrich after `IncidentChainBuilder.link(summaries)`
- Modify: `IncidentChainBuilderTest.java`
- Modify: `expected.json` paired cases
- Modify: `CrashIntelGoldenTest.java` if paired case assertions need `followup_primary_mod_id`

**Interfaces:**
- Consumes: `link()` already sets `watchdog_followup` + `paired_primary_file`
- Produces: follow-up `primary_mod_id` copied from primary; Fix rewritten for follow-up

- [ ] **Step 1: Extend IncidentChainBuilderTest**

```java
@Test
void followupInheritsPrimaryModId() {
    // same setup as pairsCreateNpeWithWatchdogWithin120s but primary_mod_id create
    IncidentChainBuilder.link(summaries);
    assertEquals("create", watchdog.get("primary_mod_id").getAsString());
    assertEquals(CrashClassifier.FK_WATCHDOG_FOLLOWUP, watchdog.get("failure_kind").getAsString());
}
```

Also add OPAC+watchdog and Sable+watchdog fixture-based tests with real times ~63s apart.

- [ ] **Step 2: Run — expect FAIL** (primary still c2me or unset)

- [ ] **Step 3: In `IncidentChainBuilder.link`, after setting failure_kind**

```java
String primaryMod = strOr(primary, "primary_mod_id", strOr(primary, "suspect_mod_id", ""));
if (!primaryMod.isEmpty()) {
    follow.addProperty("primary_mod_id", primaryMod);
    follow.addProperty("suspect_mod_id", primaryMod);
}
```

Optional: if follow stack/text lacks `"Server thread"`, `follow.addProperty("missing_server_thread", true)`.

- [ ] **Step 4: Add `CrashNarrator.enrichAfterChain`**

```java
public static void enrichAfterChain(JsonArray summaries) {
    if (summaries == null) return;
    for (JsonElement el : summaries) {
        if (!el.isJsonObject()) continue;
        JsonObject row = el.getAsJsonObject();
        if (!CrashClassifier.FK_WATCHDOG_FOLLOWUP.equals(str(row, "failure_kind"))) continue;
        String paired = str(row, "paired_primary_file");
        String mod = str(row, "primary_mod_id");
        // rewrite plain_english + fix_hints to reference prior crash / mod
        // must not lead with c2me_base / Chunky-only advice
        row.addProperty("plain_english",
            "Watchdog follow-up after the prior crash"
                + (mod != null ? " (" + mod + ")" : "")
                + (paired != null ? " — see " + paired : "")
                + ". Fix the earlier crash first; this hang is aftermath, not a separate root cause.");
        JsonArray hints = new JsonArray();
        hints.add("Open the paired crash report and fix that mod first");
        if (row.has("missing_server_thread") && row.get("missing_server_thread").getAsBoolean()) {
            hints.add("Thread dump has no Server thread — tick loop already dead after the prior crash");
        }
        row.add("fix_hints", hints);
    }
}
```

(Use existing field names that `enrichSummary` already writes — match `CrashNarrator` property names exactly.)

- [ ] **Step 5: FactsBuilder after link**

```java
IncidentChainBuilder.link(summaries);
CrashNarrator.enrichAfterChain(summaries);
```

- [ ] **Step 6: Update golden paired case**

```json
"opac-watchdog-2043-pair": {
  "files": ["opac-nsm-listener.txt", "watchdog-opac-followup-2043.txt"],
  "expected": {
    "same_incident_id": true,
    "followup_failure_kind": "watchdog_followup",
    "followup_primary_mod_id": "opac_better_commands"
  }
}
```

Extend `CrashIntelGoldenTest` paired branch to assert `followup_primary_mod_id` when present (run parse→classify→build rows with times→link→enrichAfterChain).

- [ ] **Step 7: Run tests PASS + commit**

```bash
./gradlew :watchtower-core:test --tests dev.mcstatus.watchtower.core.analyze.IncidentChainBuilderTest --tests dev.mcstatus.watchtower.core.collect.CrashIntelGoldenTest
git commit -m "feat(crash): watchdog follow-ups inherit primary mod and Fix after chain link"
```

---

### Task 6: Research harness parity

**Files:**
- Modify: `watchtower-core/src/test/java/dev/mcstatus/watchtower/core/research/SampleCrashReplayHarness.java`
- Test: `SampleCrashReplayHarnessTest.java`

**Interfaces:**
- Produces: `crash-replay.json` rows including post-link `failure_kind`, `primary_mod_id`, `paired_primary_file`

- [ ] **Step 1: Change harness to batch then link**

Parse all crashes into summary `JsonObject`s (include `time` from parsed crash), classify each, narrate each into row fields, add to `JsonArray`, then:

```java
IncidentChainBuilder.link(crashes);
CrashNarrator.enrichAfterChain(crashes);
```

Emit `paired_primary_file` / updated fields in output.

- [ ] **Step 2: Run harness test PASS + commit**

```bash
./gradlew :watchtower-core:test --tests dev.mcstatus.watchtower.core.research.SampleCrashReplayHarnessTest
git commit -m "fix(research): sample crash replay harness runs incident chain + enrichAfterChain"
```

---

### Task 7: Full core test + Phase 1 done marker

- [ ] **Step 1: Run full module tests**

```bash
./gradlew :watchtower-core:test
```

Expected: PASS

- [ ] **Step 2: Optional note in research REPORT** (one line under Next: “Phase 1 implementation plan ready/executed”) — skip if noisy.

- [ ] **Step 3: Final commit if any leftover**

---

## Spec coverage self-check

| Spec requirement | Task |
| --- | --- |
| FK api_version_mismatch + shutdown_noise | 3 |
| OPAC Fix version alignment | 3 |
| Sable save context | 4 |
| Chain primary rewrite + Fix | 5 |
| missing Server thread evidence | 5 (optional detail) |
| Research harness parity | 6 |
| Fixtures / goldens | 1–2, 5 |

## Plain English

After this plan, party-chat OPAC crashes name the version mismatch, Spark-on-stop is shutdown noise, Sable Fix mentions save/sublevel, and the minute-later watchdogs point at those crashes instead of C2ME.
