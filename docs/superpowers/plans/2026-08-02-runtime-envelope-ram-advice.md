# Runtime Envelope / Smarter RAM Advice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make RAM advice host-aware: never recommend more `-Xmx` when the JVM already leaves too little room outside Java on this host/container (the classic 6G heap on an 8G box → external OOM path).

**Architecture:** Extend `RamSizingAdvisor` with an envelope classifier (host mem vs `-Xmx`) and merge it into the existing single `ram_sizing` verdict (envelope first, then heap/GC history). Wire host totals through `PerformanceContext` into Insights. Expose a small `ram_envelope` object on the live snapshot so Overview can teaser **critical** only without fetching the Insights dashboard. No launch-script writes.

**Tech Stack:** Java 21 (`watchtower-core`, NeoForge common), Gson JSON, JUnit 5, React Insights/Overview (`web/dashboard`), existing fixtures / `patch-alpha-fixtures.mjs`.

## Global Constraints

- Product spelling in UI: **WatchTower**.
- Advisory only — copy snippets OK; do **not** rewrite panel start scripts / `user_jvm.txt`.
- One merged Insights card (`ram_sizing`); no second conflicting “add RAM” card.
- Envelope safety beats heap “raise Xmx” suggestions.
- Overview teaser only when `envelope == critical` (not `low` / `ok` / `unknown`).
- Keep `headroom_gb` = heap headroom (`xmx − peak`); outside room is `outside_headroom_gb`.
- Align copy with external-kill / OOM Issues (same story: box too small for this Xmx).
- Thresholds (verbatim): critical if `xmx ≥ 0.85×host` OR `outside < 1.0 GB`; low if `xmx ≥ 0.70×host` OR `outside < 1.5 GB`; safe suggest frac `0.65×host`, floor `2.0 GB`.
- Roadmap: `docs/dev/roadmap/versions/1.1.19-1.1.29-change-safety-and-recovery.md` §1.1.26.

## File map

| File | Responsibility |
|------|----------------|
| `watchtower-core/.../analyze/RamSizingAdvisor.java` | Envelope classify + merged evaluate |
| `watchtower-core/.../analyze/PerformanceContext.java` | `hostMemGb` / `ramSource` fields |
| `watchtower-core/.../analyze/PerformanceDashboardBuilder.java` | Pass host into evaluate |
| `watchtower-neoforge-common/.../DashboardHttpServer.java` | Fill host from live sample when building dashboard |
| `watchtower-neoforge-common/.../LiveMetricsService.java` | Attach `ram_envelope` on live response |
| `watchtower-core/.../analyze/RamSizingAdvisorTest.java` | Envelope + clamp + unknown-host tests |
| `web/dashboard/src/features/insights/panels/configs.tsx` | RamSizingCard envelope lines + badge |
| `web/dashboard/src/features/overview/view.tsx` | Critical-only teaser → Insights Configs |
| `web/dashboard/scripts/patch-alpha-fixtures.mjs` | mockRamSizing envelope fields; optional live envelope |
| `docs/wiki/Insights.md` | Short note on host-aware RAM advice |
| `docs/wiki/HTTP-API.md` | Document new `ram_sizing` / live `ram_envelope` fields |

---

### Task 1: Envelope classifier + failing tests (TDD)

**Files:**
- Modify: `watchtower-core/src/main/java/dev/mcstatus/watchtower/core/analyze/RamSizingAdvisor.java`
- Modify: `watchtower-core/src/test/java/dev/mcstatus/watchtower/core/analyze/RamSizingAdvisorTest.java`

**Interfaces:**
- Produces:
  - `public static final String VERDICT_ENVELOPE_TIGHT = "envelope_tight"`
  - `public static final String ENVELOPE_OK|LOW|CRITICAL|UNKNOWN`
  - `public static String classifyEnvelope(double hostMemGb, double xmxGb)` → one of those envelope strings
  - `public static double safeXmxMaxGb(double hostMemGb)` → `max(2.0, floor(host * 0.65))` style rounding used by suggest clamp
  - Overload: `evaluate(window, stats, xmxGb, xmxSource, gcVerdict, hostMemGb, ramSource)`
  - Existing 5-arg `evaluate(...)` delegates with `Double.NaN` host / `null` source

- [ ] **Step 1: Write the failing tests**

Append to `RamSizingAdvisorTest.java`:

```java
@Test
void classifyEnvelopeBands() {
    // 6/8 = 0.75 → low (frac); outside 2.0 is not < 1.5
    assertEquals(RamSizingAdvisor.ENVELOPE_LOW, RamSizingAdvisor.classifyEnvelope(8.0, 6.0));
    // 7/8 = 0.875 → critical
    assertEquals(RamSizingAdvisor.ENVELOPE_CRITICAL, RamSizingAdvisor.classifyEnvelope(8.0, 7.0));
    // outside 0.8 < 1.0 → critical even if frac < 0.85
    assertEquals(RamSizingAdvisor.ENVELOPE_CRITICAL, RamSizingAdvisor.classifyEnvelope(8.0, 7.2));
    assertEquals(RamSizingAdvisor.ENVELOPE_OK, RamSizingAdvisor.classifyEnvelope(16.0, 8.0));
    assertEquals(RamSizingAdvisor.ENVELOPE_UNKNOWN, RamSizingAdvisor.classifyEnvelope(Double.NaN, 8.0));
}

@Test
void eightGigHostSixGigXmxIsEnvelopeTight() {
    JsonObject stats = baseStats(5.0, 40.0);
    JsonObject out = RamSizingAdvisor.evaluate(
            "7d", stats, 6.0, "live", GcAdvisor.VERDICT_HEALTHY, 8.0, "cgroup_v2");
    assertEquals(RamSizingAdvisor.VERDICT_ENVELOPE_TIGHT, out.get("verdict").getAsString());
    assertEquals(RamSizingAdvisor.ENVELOPE_LOW, out.get("envelope").getAsString());
    assertEquals("cgroup_v2", out.get("ram_source").getAsString());
    assertEquals(8.0, out.get("host_mem_gb").getAsDouble(), 0.01);
    assertEquals(2.0, out.get("outside_headroom_gb").getAsDouble(), 0.01);
    assertTrue(out.get("ram_upgrade_blocked").getAsBoolean());
    assertTrue(out.has("suggested_xmx_gb_max"));
    assertTrue(out.get("suggested_xmx_gb_max").getAsLong()
            <= Math.round(RamSizingAdvisor.safeXmxMaxGb(8.0)));
    String advice = out.get("advice").getAsString().toLowerCase();
    assertTrue(advice.contains("oom") || advice.contains("outside") || advice.contains("headroom")
            || advice.contains("container") || advice.contains("-xmx"));
}

@Test
void sevenOfEightIsCriticalEnvelope() {
    JsonObject stats = baseStats(5.0, 40.0);
    JsonObject out = RamSizingAdvisor.evaluate(
            "7d", stats, 7.0, "live", GcAdvisor.VERDICT_HEALTHY, 8.0, "cgroup_v2");
    assertEquals(RamSizingAdvisor.VERDICT_ENVELOPE_TIGHT, out.get("verdict").getAsString());
    assertEquals(RamSizingAdvisor.ENVELOPE_CRITICAL, out.get("envelope").getAsString());
}

@Test
void underProvisionedClampedToEnvelope() {
    JsonObject stats = baseStats(11.0, 92.0);
    JsonObject out = RamSizingAdvisor.evaluate(
            "7d", stats, 12.0, "live", GcAdvisor.VERDICT_HEAP_BOUND, 32.0, "proc");
    assertEquals(RamSizingAdvisor.VERDICT_UNDER, out.get("verdict").getAsString());
    long maxSuggest = out.get("suggested_xmx_gb_max").getAsLong();
    assertTrue(maxSuggest <= Math.round(RamSizingAdvisor.safeXmxMaxGb(32.0)));
}

@Test
void unknownHostKeepsLegacyUnderPath() {
    JsonObject stats = baseStats(11.0, 92.0);
    JsonObject out = RamSizingAdvisor.evaluate(
            "7d", stats, 12.0, "live", GcAdvisor.VERDICT_HEAP_BOUND);
    assertEquals(RamSizingAdvisor.VERDICT_UNDER, out.get("verdict").getAsString());
    assertEquals(RamSizingAdvisor.ENVELOPE_UNKNOWN, out.get("envelope").getAsString());
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `./gradlew :watchtower-core:test --tests "dev.mcstatus.watchtower.core.analyze.RamSizingAdvisorTest" -q`

Expected: FAIL — missing symbols / wrong verdicts.

- [ ] **Step 3: Implement classifier + evaluate merge**

In `RamSizingAdvisor.java`:

```java
public static final String VERDICT_ENVELOPE_TIGHT = "envelope_tight";
public static final String ENVELOPE_OK = "ok";
public static final String ENVELOPE_LOW = "low";
public static final String ENVELOPE_CRITICAL = "critical";
public static final String ENVELOPE_UNKNOWN = "unknown";
public static final double ENVELOPE_CRITICAL_FRAC = 0.85;
public static final double ENVELOPE_LOW_FRAC = 0.70;
public static final double ENVELOPE_CRITICAL_OUTSIDE_GB = 1.0;
public static final double ENVELOPE_LOW_OUTSIDE_GB = 1.5;
public static final double ENVELOPE_SAFE_XMX_FRAC = 0.65;
public static final double ENVELOPE_SAFE_XMX_FLOOR_GB = 2.0;

public static String classifyEnvelope(double hostMemGb, double xmxGb) {
    if (Double.isNaN(hostMemGb) || hostMemGb <= 0 || Double.isNaN(xmxGb) || xmxGb <= 0) {
        return ENVELOPE_UNKNOWN;
    }
    double outside = hostMemGb - xmxGb;
    double frac = xmxGb / hostMemGb;
    if (frac >= ENVELOPE_CRITICAL_FRAC || outside < ENVELOPE_CRITICAL_OUTSIDE_GB) {
        return ENVELOPE_CRITICAL;
    }
    if (frac >= ENVELOPE_LOW_FRAC || outside < ENVELOPE_LOW_OUTSIDE_GB) {
        return ENVELOPE_LOW;
    }
    return ENVELOPE_OK;
}

public static double safeXmxMaxGb(double hostMemGb) {
    if (Double.isNaN(hostMemGb) || hostMemGb <= 0) {
        return Double.NaN;
    }
    return Math.max(ENVELOPE_SAFE_XMX_FLOOR_GB, Math.floor(hostMemGb * ENVELOPE_SAFE_XMX_FRAC));
}
```

Keep 5-arg `evaluate` as:

```java
public static JsonObject evaluate(
        String window, JsonObject stats, double xmxGb, String xmxSource, String gcVerdict) {
    return evaluate(window, stats, xmxGb, xmxSource, gcVerdict, Double.NaN, null);
}
```

In the 7-arg body, **after** copying heap stats / xmx / gc, always emit envelope fields, then **before** under/over logic:

1. Compute `envelope = classifyEnvelope(hostMemGb, xmxGb)`.
2. If host known: set `host_mem_gb`, `ram_source` (default `"unknown"`), `outside_headroom_gb`.
3. Set `envelope`.
4. If envelope is `low` or `critical`: set `verdict=envelope_tight`, `ram_upgrade_blocked=true`, set `suggested_xmx_gb_min/max` toward `safeXmxMaxGb` (min = max(floor, safe-1) style like roadmap 4–5G on 8G), advice plain English e.g. `Host memory ~8 GB (cgroup). Java heap (-Xmx) 6 GB leaves little room outside Java — risk of an external OOM kill. Try -Xmx4G–5G on this host, or a larger plan.` Then **return**.
5. Else run existing upgrade-blocked / under / over / right paths.
6. On **under** path: after computing suggest min/max, if host known, clamp both to `≤ safeXmxMaxGb(host)`; if clamp collapses below current xmx, still block upgrade and explain envelope room.

Insufficient-data path: still attach envelope fields when host+xmx known; if envelope tight, prefer `envelope_tight` even without 7d history (envelope does not need heap history).

- [ ] **Step 4: Run tests to verify they pass**

Run: `./gradlew :watchtower-core:test --tests "dev.mcstatus.watchtower.core.analyze.RamSizingAdvisorTest" -q`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add watchtower-core/src/main/java/dev/mcstatus/watchtower/core/analyze/RamSizingAdvisor.java \
  watchtower-core/src/test/java/dev/mcstatus/watchtower/core/analyze/RamSizingAdvisorTest.java
git commit -m "$(cat <<'EOF'
feat(core): host envelope in RamSizingAdvisor

Keep -Xmx advice inside cgroup/OS headroom so guides cannot push a tight host into external OOM.
EOF
)"
```

---

### Task 2: Wire host mem into PerformanceContext + dashboard

**Files:**
- Modify: `watchtower-core/src/main/java/dev/mcstatus/watchtower/core/analyze/PerformanceContext.java`
- Modify: `watchtower-core/src/main/java/dev/mcstatus/watchtower/core/analyze/PerformanceDashboardBuilder.java` (ram evaluate call ~74–88)
- Modify: `watchtower-neoforge-common/src/main/java/dev/mcstatus/watchtower/DashboardHttpServer.java` (~1760–1875)
- Modify: `RamSizingAdvisorTest.dashboardIncludesRamSizingWithLiveXmx` if context ctor changes

**Interfaces:**
- Consumes: `RamSizingAdvisor.evaluate(..., hostMemGb, ramSource)`
- Produces: `PerformanceContext.hostMemGb(): Double`, `ramSource(): String`
- Full ctor gains `Double hostMemGb, String ramSource` as final two params; shorter overloads pass `null, null`

- [ ] **Step 1: Extend PerformanceContext**

Add fields + getters. Update every existing constructor chain to pass `null, null` into the full ctor. Update the full ctor signature to accept and store them.

- [ ] **Step 2: DashboardHttpServer — read host from live**

Next to the existing Xmx extraction (~1760), also read:

```java
Double hostMemGb = null;
String ramSource = null;
// from liveResp.latest.mem_total_gb / ram_source if present
// else facts.system.mem_total_gb / ram_source
```

Pass into `new PerformanceContext(..., diskIoLatencyWarnMs, hostMemGb, ramSource)`.

- [ ] **Step 3: PerformanceDashboardBuilder**

```java
double hostMemGb = Double.NaN;
String ramSource = null;
if (context != null && context.hostMemGb() != null && context.hostMemGb() > 0) {
    hostMemGb = context.hostMemGb();
    ramSource = context.ramSource();
}
JsonObject ramSizing = RamSizingAdvisor.evaluate(
        win, ramStats, xmxGb, xmxSource, gcVerdict, hostMemGb, ramSource);
```

Ensure `attachAlignedJvmRecommendedFlags` uses envelope-clamped suggest when present (if it already reads `suggested_xmx_gb_*`, verify it cannot paste an over-envelope Xmx).

- [ ] **Step 4: Fix compile + dashboard unit test**

Update `new PerformanceContext(null, List.of(), null, 0, 12.0, "live")` call sites — still valid if 6-arg overload unchanged.

Add assertion in `dashboardIncludesRamSizingWithLiveXmx` optional: with no host, `envelope` is `unknown`.

Run: `./gradlew :watchtower-core:test --tests "dev.mcstatus.watchtower.core.analyze.RamSizingAdvisorTest" :neoforge-1.21:compileJava -q`

Expected: PASS / compile OK.

- [ ] **Step 5: Commit**

```bash
git add watchtower-core/src/main/java/dev/mcstatus/watchtower/core/analyze/PerformanceContext.java \
  watchtower-core/src/main/java/dev/mcstatus/watchtower/core/analyze/PerformanceDashboardBuilder.java \
  watchtower-neoforge-common/src/main/java/dev/mcstatus/watchtower/DashboardHttpServer.java \
  watchtower-core/src/test/java/dev/mcstatus/watchtower/core/analyze/RamSizingAdvisorTest.java
git commit -m "$(cat <<'EOF'
feat(dashboard): pass host memory into ram_sizing

Insights Configs can classify cgroup/OS envelope beside heap history.
EOF
)"
```

---

### Task 3: Live `ram_envelope` for Overview

**Files:**
- Modify: `watchtower-neoforge-common/src/main/java/dev/mcstatus/watchtower/LiveMetricsService.java` (`getLiveResponse` / latest sample assembly)
- Test: add a small unit test if LiveMetricsService is hard to unit-test — prefer testing via a package-visible helper in core:

**Interfaces:**
- Produces on live JSON root or `latest`:

```json
"ram_envelope": {
  "envelope": "critical",
  "host_mem_gb": 8.0,
  "xmx_gb": 7.0,
  "outside_headroom_gb": 1.0,
  "ram_source": "cgroup_v2"
}
```

Use `RamSizingAdvisor.classifyEnvelope` + same field names. Omit object when envelope is `unknown`.

- [ ] **Step 1: Add core helper for the JSON blob**

In `RamSizingAdvisor.java`:

```java
public static JsonObject envelopeSnapshot(double hostMemGb, double xmxGb, String ramSource) {
    JsonObject o = new JsonObject();
    String env = classifyEnvelope(hostMemGb, xmxGb);
    o.addProperty("envelope", env);
    if (!ENVELOPE_UNKNOWN.equals(env)) {
        o.addProperty("host_mem_gb", round2(hostMemGb));
        o.addProperty("xmx_gb", round2(xmxGb));
        o.addProperty("outside_headroom_gb", round2(hostMemGb - xmxGb));
        if (ramSource != null && !ramSource.isBlank()) {
            o.addProperty("ram_source", ramSource);
        }
    }
    return o;
}
```

Test: `envelopeSnapshot(8,7,"cgroup_v2").get("envelope") == critical`.

- [ ] **Step 2: Attach in LiveMetricsService.getLiveResponse**

When building the live payload, if `mem_total_gb` and Xmx are known on latest, `live.add("ram_envelope", RamSizingAdvisor.envelopeSnapshot(...))` (or under `latest` — pick **root-level `ram_envelope`** for easy Overview read; document it).

- [ ] **Step 3: Compile NeoForge module**

Run: `./gradlew :neoforge-1.21:compileJava -q`

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add watchtower-core/src/main/java/dev/mcstatus/watchtower/core/analyze/RamSizingAdvisor.java \
  watchtower-core/src/test/java/dev/mcstatus/watchtower/core/analyze/RamSizingAdvisorTest.java \
  watchtower-neoforge-common/src/main/java/dev/mcstatus/watchtower/LiveMetricsService.java
git commit -m "$(cat <<'EOF'
feat(live): expose ram_envelope for Overview teaser

Critical host/Xmx mismatch is visible without loading Insights.
EOF
)"
```

---

### Task 4: Insights RamSizingCard UI

**Files:**
- Modify: `web/dashboard/src/features/insights/panels/configs.tsx` (`RamSizingCard` ~113–187, `ramSizingBadge`)

**Interfaces:**
- Consumes: `ram.envelope`, `ram.host_mem_gb`, `ram.outside_headroom_gb`, `ram.ram_source`, `ram.verdict === 'envelope_tight'`

- [ ] **Step 1: Badge map**

Extend `ramSizingBadge` (search in same file / shared):

```ts
case 'envelope_tight':
  return { tone: 'danger' /* or warn if envelope===low */, label: 'Tight host' };
```

Use `danger` when `envelope === 'critical'`, `warn` when `low`.

- [ ] **Step 2: Card body lines**

Under the advice paragraph, when `host_mem_gb` is present, render:

```tsx
<div className="... text-xs ...">
  <span>Host <strong>{formatGb(host)}</strong> ({ramSourceLabel})</span>
  <span>Heap (-Xmx) <strong>{formatGb(xmx)}</strong></span>
  <span>Outside heap <strong>{envelope}</strong>
    {outside != null ? ` (${formatGb(outside)})` : ''}</span>
</div>
```

`ramSourceLabel`: `cgroup_v2`/`cgroup_v1` → `cgroup`; `proc` → `host`; else `unknown`.

Keep existing peak / pressure / heap `headroom_gb` metrics.

- [ ] **Step 3: Manual check**

Run: `cd web/dashboard && npm run preview` → Insights → Configs with fixture that has envelope fields (Task 5). Confirm one card, no “raise Xmx” when tight.

- [ ] **Step 4: Commit**

```bash
git add web/dashboard/src/features/insights/panels/configs.tsx
git commit -m "$(cat <<'EOF'
feat(insights): show host envelope on RAM sizing card

Operators see host vs -Xmx headroom next to heap-history advice.
EOF
)"
```

---

### Task 5: Overview critical teaser + fixtures + wiki

**Files:**
- Modify: `web/dashboard/src/features/overview/view.tsx` (mission / attention area near grade teasers ~828+)
- Modify: `web/dashboard/scripts/patch-alpha-fixtures.mjs` (`mockRamSizing`)
- Modify: `docs/wiki/Insights.md`
- Modify: `docs/wiki/HTTP-API.md` (ram_sizing + live ram_envelope bullets)

**Interfaces:**
- Consumes: `live.ram_envelope.envelope === 'critical'`
- Navigates: `navigate({ tab: 'insights', view: 'configs', panel: null })`

- [ ] **Step 1: Overview teaser**

Near Needs attention / grade teasers, if critical:

```tsx
const ramEnv = asRecord(live.ram_envelope);
if (str(ramEnv.envelope) === 'critical') {
  // attention row or compact banner:
  // "Heap leaves too little room on this host — review RAM sizing"
  // button → Insights Configs
}
```

Do **not** show for `low` / `ok` / missing.

- [ ] **Step 2: Fixtures**

Update `mockRamSizing()`:

```js
host_mem_gb: 16,
ram_source: 'cgroup_v2',
outside_headroom_gb: 8,
envelope: 'ok',
```

Add a second fixture path or patch one performance-dashboard JSON to **low-headroom** (8 / 6 / envelope `low`, verdict `envelope_tight`) used by Insights preview. If live fixtures exist, set one pack’s `ram_envelope` to `critical` for Overview preview.

- [ ] **Step 3: Wiki**

Insights.md — one short subsection under Configs / JVM: WatchTower compares host/container RAM to `-Xmx` and will tell you to lower heap or raise the plan instead of adding RAM on a tight box.

HTTP-API.md — document new `ram_sizing` keys and live `ram_envelope`.

- [ ] **Step 4: Verify**

Run: `./gradlew :watchtower-core:test --tests "dev.mcstatus.watchtower.core.analyze.RamSizingAdvisorTest" -q`

Run dashboard preview; Overview with critical fixture shows teaser; Insights card shows host lines.

- [ ] **Step 5: Commit**

```bash
git add web/dashboard/src/features/overview/view.tsx \
  web/dashboard/scripts/patch-alpha-fixtures.mjs \
  docs/wiki/Insights.md docs/wiki/HTTP-API.md
git commit -m "$(cat <<'EOF'
feat(ui): Overview critical RAM envelope teaser

Surface host/Xmx mismatch where admins land first; document API fields.
EOF
)"
```

---

## Spec coverage self-review

| Design requirement | Task |
|--------------------|------|
| Extend RamSizingAdvisor with envelope | 1 |
| Merged verdict, envelope first | 1 |
| Thresholds 0.85 / 0.70 / 1.0 / 1.5 / 0.65 | 1 |
| Clamp under-provisioned suggests | 1 |
| Unknown host = legacy behavior | 1 |
| PerformanceContext + dashboard wire | 2 |
| Insights card host / outside lines | 4 |
| Overview teaser critical only | 3 + 5 |
| Fixtures 8G/6G + ok | 5 |
| No launch script rewrite | Global + all tasks |
| External-kill copy compatible | 1 advice + 5 wiki |

## Placeholder scan

No TBD steps; thresholds and signatures are explicit.

## Type consistency

- Verdict: `envelope_tight`
- Envelope band: `ok` \| `low` \| `critical` \| `unknown`
- Fields: `host_mem_gb`, `ram_source`, `outside_headroom_gb`, `envelope`
- Live: root `ram_envelope` object with the same band field names
- Context getters: `hostMemGb()`, `ramSource()`

---

## Plain-English end user

On a tight host or container, WatchTower says your heap leaves too little room outside Java — lower `-Xmx` or get a bigger plan — instead of “add more RAM” that invites an external kill.
