# Sample-gap fixes Phase 2 — Log ingestion and noise Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scan Jade and KubeJS sidecar logs, and demote recipe / DISTXFORM / loot WARN floods so they stop crowding Issues (FB-07, FB-08, FB-09, FB-10).

**Architecture:** Extend `GzipLineReader` discovery; add a small Jade sidecar analyzer; ensure recipe WARN patterns classify; demote known flood categories in `ModIssuePeekBuilder` (and advisor if needed). Live `OpsLogTailScanner` stays latest-only (YAGNI).

**Tech Stack:** Java 21, JUnit 5, Gson, Gradle `:watchtower-core:test`, fixtures under `samples/fixtures/log-intelligence/`.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-02-sample-gap-fixes-phase2-ingest-noise-design.md`
- Research: FB-07, FB-08, FB-09, FB-10 in `fixture-backlog.md`
- Advisory only; Jade is non-fatal/info; no crash classification for sidecars
- Do not store unbounded recipe IDs; keep ModLogAnalyzer caps
- Prefer execute after Phase 1 for reviewability; no hard code dependency on Phase 1

---

### Task 1: GzipLineReader discovers sidecars

**Files:**
- Modify: `watchtower-core/src/main/java/dev/mcstatus/watchtower/core/collect/GzipLineReader.java`
- Test: `watchtower-core/src/test/java/dev/mcstatus/watchtower/core/collect/GzipLineReaderTest.java` (create if missing)

**Interfaces:**
- Consumes: `iterLogFiles(String serverDir, int gzipCount, double windowStart)`
- Produces: same list **plus** existing sidecars when present:
  - `logs/JadeErrorOutput.txt`
  - `logs/kubejs/server.log`
  - `logs/kubejs/startup.log`
  - Does **not** require `client.log`

- [ ] **Step 1: Failing test**

```java
@Test
void iterLogFilesIncludesJadeAndKubejsSidecars() throws Exception {
    Path server = Files.createTempDirectory("wt-logs");
    Path logs = Files.createDirectories(server.resolve("logs"));
    Files.writeString(logs.resolve("latest.log"), "x\n");
    Files.writeString(logs.resolve("JadeErrorOutput.txt"), "INSTANCE\n");
    Path kjs = Files.createDirectories(logs.resolve("kubejs"));
    Files.writeString(kjs.resolve("server.log"), "WARN recipe\n");
    Files.writeString(kjs.resolve("startup.log"), "ok\n");
    Files.writeString(kjs.resolve("client.log"), ""); // empty OK

    List<Path> found = GzipLineReader.iterLogFiles(server.toString(), 1, Instant.now().getEpochSecond());
    assertTrue(found.stream().anyMatch(p -> p.getFileName().toString().equals("JadeErrorOutput.txt")));
    assertTrue(found.stream().anyMatch(p -> p.toString().replace('\\','/').endsWith("kubejs/server.log")));
    assertTrue(found.stream().anyMatch(p -> p.toString().replace('\\','/').endsWith("kubejs/startup.log")));
}
```

- [ ] **Step 2: Run — expect FAIL**

```bash
./gradlew :watchtower-core:test --tests dev.mcstatus.watchtower.core.collect.GzipLineReaderTest
```

- [ ] **Step 3: Implement discovery append**

At end of `iterLogFiles`, after gzip loop:

```java
Path jade = base.resolve("JadeErrorOutput.txt");
if (Files.isRegularFile(jade)) {
    files.add(jade);
}
Path kjsServer = base.resolve("kubejs").resolve("server.log");
Path kjsStartup = base.resolve("kubejs").resolve("startup.log");
if (Files.isRegularFile(kjsServer)) {
    files.add(kjsServer);
}
if (Files.isRegularFile(kjsStartup)) {
    files.add(kjsStartup);
}
```

- [ ] **Step 4: Run PASS + commit**

```bash
git commit -m "feat(logs): discover JadeErrorOutput and kubejs server/startup sidecars"
```

---

### Task 2: Jade sidecar analyzer (FB-07)

**Files:**
- Create: `watchtower-core/src/main/java/dev/mcstatus/watchtower/core/analyze/JadeSidecarAnalyzer.java`
- Modify: `LogScanner.java` (or FactsBuilder optional path) to call analyzer when file is Jade sidecar
- Create: `samples/fixtures/log-intelligence/jade-sidecar-compat/JadeErrorOutput.txt`
- Test: `JadeSidecarAnalyzerTest.java`

**Interfaces:**
- Produces: `JsonObject` summary e.g. `{ "issue_id": "signal_jade_sidecar_compat", "primary_mod": "jade", "instance_count": 8, "exception_classes": [...], "severity": "info" }`

- [ ] **Step 1: Write fixture** with 8 INSTANCE-shaped blocks (or copy trimmed real sidecar from sample). Include InvWrapper NPE + at least one Lectern/cauldron/Create ClassCast line so tests reject InvWrapper-only framing.

- [ ] **Step 2: Failing test**

```java
@Test
void countsMultiExceptionJadeInstances() throws Exception {
    String text = Files.readString(fixture);
    JsonObject out = JadeSidecarAnalyzer.analyze(text);
    assertEquals("jade", out.get("primary_mod").getAsString());
    assertTrue(out.get("instance_count").getAsInt() >= 1);
    assertFalse(out.get("crash_or_outage").getAsBoolean());
}
```

- [ ] **Step 3: Implement analyzer** — parse INSTANCE / exception class labels; cap samples to 5; never set crash severity.

- [ ] **Step 4: Wire into LogScanner** when path ends with `JadeErrorOutput.txt` — skip normal ModLogAnalyzer recipe path or run both carefully; write into optional `mod_log_errors` or dedicated `optional.jade_sidecar`.

- [ ] **Step 5: IssuesLive** — if live path uses mod_issues peek, ensure one capped jade info entry can appear (`IssuesLiveEvaluators` / peek builder). Prefer report optional first if live wiring is heavy; minimum = report optional + unit test.

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(logs): analyze JadeErrorOutput as non-fatal multi-exception compat signal"
```

---

### Task 3: Recipe WARN pattern + flood demotion (FB-08)

**Files:**
- Modify: `ModErrorCategory.java` — add pattern(s) for dump-style recipe WARNs if missing
- Modify: `ModIssuePeekBuilder.java` — demote flood rows
- Create: `samples/fixtures/log-intelligence/recipe-flood-createfood-kubejs/`
- Test: `ModIssuePeekBuilderTest` or new test

**Interfaces:**
- Produces: peek list where a single logger_error / higher severity outranks 50k recipe WARNs collapsed into one flood row

- [ ] **Step 1: Confirm current RECIPE_PARSE**

Read `ModErrorCategory.RECIPE_PARSE`. If `Failed to parse recipe` / KubeJS recipe WARN lines from fixture do not match, add alternate pattern returning same category or a `RECIPE_WARN_FLOOD` hit with low severityRank.

- [ ] **Step 2: Failing ranking test**

Build synthetic `mod_log_errors` array: createfood total=50000 category recipe; kubejs total=1000 recipe; othermod logger_error total=3. Assert peek top entry is othermod (or jade), not createfood alone occupying all slots without room for ERROR.

- [ ] **Step 3: Implement demotion**

In `ModIssuePeekBuilder`, after severity sort, apply:

```java
private static boolean isRecipeFlood(JsonObject row) {
    // true if top category is recipe_parse (or new flood flag) AND total >= 100
}
```

When building peek: skip flood rows until non-flood rows are considered, then allow at most one flood row if slots remain. Or force flood severityRank to 0.

- [ ] **Step 4: PASS + commit**

```bash
git commit -m "feat(logs): demote recipe WARN floods in Issues peek ranking"
```

---

### Task 4: DISTXFORM / loot spam demotion (FB-10)

**Files:**
- Modify: `ModIssuePeekBuilder.java` and/or `ModErrorCategory.java`
- Create: `samples/fixtures/log-intelligence/distxform-loot-noise/`
- Test: same peek test class

- [ ] **Step 1: Failing test** — synthetic distxform/loot totals huge + one real ERROR; peek prefers ERROR.

- [ ] **Step 2: Extend `isNoiseFlood` helper** to include client_on_server / loot_parse categories when total ≥ threshold (e.g. 50).

- [ ] **Step 3: PASS + commit**

```bash
git commit -m "feat(logs): demote DISTXFORM and loot-parse boot spam in Issues peek"
```

---

### Task 5: KubeJS sidecar content path (FB-09)

**Files:**
- Modify: `LogScanner.java` — when scanning kubejs path, set evidence `source` / relative path including `kubejs/server.log`
- Test: integration-style temp dir with only kubejs/server.log recipe lines → mod_log_errors includes kubejs attribution

- [ ] **Step 1: Failing test** — serverDir with only kubejs/server.log (no latest.log optional: still create empty latest if scanner requires). Assert analyzer sees WARN lines attributed to kubejs.

- [ ] **Step 2: Ensure LogScanner uses iterLogFiles list and relative path evidence includes `logs/kubejs/server.log`.

- [ ] **Step 3: Acceptance: empty client.log not required** — unit test must not open client.log.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(logs): attribute KubeJS signals from kubejs/server.log sidecar"
```

---

### Task 6: Full `:watchtower-core:test`

- [ ] **Step 1:** `./gradlew :watchtower-core:test` PASS
- [ ] **Step 2:** Final commit if needed

---

## Spec coverage

| Spec | Task |
| --- | --- |
| Jade discovery + multi-exception | 1, 2 |
| kubejs server/startup | 1, 5 |
| recipe flood demotion | 3 |
| DISTXFORM/loot demotion | 4 |

## Plain English

After this plan, WatchTower reads Jade’s error file and KubeJS’s logs, and recipe/boot spam stops burying real Issues.
