# Sample-gap fixes Phase 3 — Joinability and GriefLogger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface login disconnect storms (server up but unplayable), MariaDB ACL / GLRA DB-addon failures, and GriefLogger × Create mounted-storage NPEs (FB-11, FB-12, FB-13).

**Architecture:** Extend `LogScanner` aggregates + signature matchers; wire capped Issues via `IssuesLiveEvaluators` / optional report events. Keep FB-11 (boot DB config) distinct from FB-13 (runtime Create compat).

**Tech Stack:** Java 21, JUnit 5, Gson, Gradle `:watchtower-core:test`, fixtures under `samples/fixtures/log-intelligence/` and existing `samples/fixtures/join-clinic/` patterns.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-02-sample-gap-fixes-phase3-join-db-design.md`
- Research: FB-11, FB-12, FB-13
- Advisory only; never mutate MariaDB grants or disable mods
- Plain English; do not fold FB-13 into FB-11
- Prefer after Phase 2; can use main log rotates already scanned

---

### Task 1: Login storm detection (FB-12)

**Files:**
- Modify: `watchtower-core/src/main/java/dev/mcstatus/watchtower/core/collect/LogScanner.java`
- Modify: `watchtower-core/src/main/java/dev/mcstatus/watchtower/core/collect/LogPatterns.java` (add login disconnect pattern if needed)
- Create: `samples/fixtures/log-intelligence/login-storm-0729/excerpt.log`
- Modify or create: `IssuesLiveEvaluators.java` / evaluator feed for new event type
- Test: `LogScannerLoginStormTest.java` (new)

**Interfaces:**
- Produces: staging event `type=login_storm` (or `joinability_login_storm`) when scan sees high login disconnects vs joins
- Threshold (locked): `login_disconnects >= 20` AND `successful_joins * 10 <= login_disconnects` within the scan window (ratio: joins ≤ 10% of login disconnects)

- [ ] **Step 1: Write excerpt fixture**

Synthetic or trimmed lines:
- Many: `... ServerLoginPacketListenerImpl ... Disconnected ...` (or exact phrase from `2026-07-29-7.log.gz`)
- Few/zero: player join success lines

- [ ] **Step 2: Failing test**

```java
@Test
void emitsLoginStormWhenDisconnectsDwarfJoins() throws Exception {
    // write excerpt into temp serverDir/logs/latest.log
    // run LogScanner.scan(...)
    // assert staging/events contains type login_storm (or optional flag)
}
```

- [ ] **Step 3: Implement counters in ScanState**

```java
int loginDisconnects;
int successfulJoins;
```

On each line: increment with patterns. At end of scan (or when threshold crossed once): append event with evidence sample lines, importance high, detail like `"199 login disconnects vs 1 join — server up but unjoinable"`.

- [ ] **Step 4: IssuesLive mapping**

Map event → issue id `signal_login_storm` / `JOINABILITY:login_storm` with Fix: check login/auth mods, firewall, force-spawn, pack sync — plain English “players cannot finish login.”

- [ ] **Step 5: PASS + commit**

```bash
git commit -m "feat(logs): detect login disconnect storm as joinability signal"
```

---

### Task 2: GriefLogger MariaDB ACL / GLRA (FB-11)

**Files:**
- Create: `watchtower-core/src/main/java/dev/mcstatus/watchtower/core/analyze/DbAddonSignatures.java`
- Modify: `ModErrorCategory.java` OR LogScanner branch calling DbAddonSignatures
- Create: `samples/fixtures/log-intelligence/grieflogger-db-addon/excerpt.log`
- Test: `DbAddonSignaturesTest.java`

**Interfaces:**
- Produces hits:
  - `kind=db_addon_acl` primary `grieflogger` when MariaDB **1130** / host ACL disables core
  - `kind=db_addon_connection` primary `griefloggerrollbackaddon` when GLRA connection fails after core recovered

- [ ] **Step 1: Fixture** with ACL 1130 lines + GLRA `Database connection failed` lines (from Jul 29 `-2` / research notes).

- [ ] **Step 2: Failing tests**

```java
@Test
void acl1130AttributesGriefLoggerCore() {
    Hit h = DbAddonSignatures.match("... Host 'x' is not allowed to connect ... 1130 ... grieflogger ...");
    assertEquals("grieflogger", h.modId());
    assertEquals("db_addon_acl", h.kind());
}

@Test
void glraConnectionFailAttributesRollbackAddon() {
    Hit h = DbAddonSignatures.match("... griefloggerrollbackaddon ... Database connection failed ...");
    assertEquals("griefloggerrollbackaddon", h.modId());
}
```

- [ ] **Step 3: Implement matcher** — case-insensitive; prefer more specific GLRA id when present.

- [ ] **Step 4: Wire to Issues** — `signal_db_addon_fail` with Fix mentioning MariaDB host ACL / DB config; not silent generic logger_error only.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(logs): surface GriefLogger MariaDB ACL and GLRA connection failures"
```

---

### Task 3: GriefLogger × Create mounted-storage NPE (FB-13)

**Files:**
- Modify: `DbAddonSignatures.java` **or** separate `GriefLoggerCreateCompatSignatures.java` (prefer separate to avoid mixing with DB)
- Create: `samples/fixtures/log-intelligence/grieflogger-create-npe-0729/excerpt.log`
- Test: `GriefLoggerCreateCompatSignaturesTest.java`

**Interfaces:**
- Produces: `issue_id=signal_gl_create_npe`, primary `grieflogger`, tags Create mounted storage / `contraption_interact` / `menuProvider`

- [ ] **Step 1: Fixture** from Jul 29 `-8` ~21:31 excerpt (ContainerHandler NPE, menuProvider null, Create contraption).

- [ ] **Step 2: Failing test** — match returns compat hit; assert kind ≠ `db_addon_acl`.

- [ ] **Step 3: Implement**

```java
// Match when line/stack blob contains ContainerHandler + menuProvider
// and (contraption_interact OR mounted storage OR create contraption evidence)
```

Fix text: GriefLogger + Create mounted storage compat; FATAL task without crash report; update/disable GL interact logging — advisory only.

- [ ] **Step 4: IssuesLive** — distinct key from FB-11.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(logs): detect GriefLogger Create mounted-storage NPE compat signal"
```

---

### Task 4: Cross-check FB-11 vs FB-13 isolation

**Files:**
- Test: `GriefLoggerSignalsIsolationTest.java`

- [ ] **Step 1: Test** that a combined log with both ACL lines and Create NPE yields **two** issue ids / hits, not one merged row.

- [ ] **Step 2: PASS + commit**

```bash
git commit -m "test: keep GriefLogger DB-addon and Create compat signals distinct"
```

---

### Task 5: Full module test

- [ ] **Step 1:** `./gradlew :watchtower-core:test` PASS
- [ ] **Step 2:** Update research REPORT “Next” only if executing — optional

---

## Spec coverage

| Spec | Task |
| --- | --- |
| Login storm joinability | 1 |
| MariaDB ACL / GLRA | 2 |
| GL×Create NPE | 3 |
| Isolation FB-11 vs FB-13 | 4 |

## Plain English

After this plan, WatchTower flags “nobody can finish login,” broken GriefLogger database setup (with the right addon name), and GriefLogger tripping over Create contraptions — instead of burying them as generic logger noise.
