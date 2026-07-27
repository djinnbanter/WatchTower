package dev.mcstatus.watchtower.core.analyze;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.collect.JvmFlagsClassifier;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class GcAdvisorTest {

    @Test
    void healthyWhenHeapAndGcFine() {
        JsonObject r = GcAdvisor.evaluate(input(45, 2, 30, JvmFlagsClassifier.PROFILE_AIKARS));
        assertEquals(GcAdvisor.VERDICT_HEALTHY, r.get("verdict").getAsString());
        assertFalse(r.get("raise_gc_pressure_issue").getAsBoolean());
        assertTrue(r.get("recommended_flags").isJsonNull());
        assertEquals(GcAdvisor.ACTION_KEEP, r.get("recommend_action").getAsString());
    }

    @Test
    void healthyDefaultStillGetsBaselinePaste() {
        JsonObject r = GcAdvisor.evaluate(input(45, 2, 30, JvmFlagsClassifier.PROFILE_DEFAULT));
        assertEquals(GcAdvisor.VERDICT_HEALTHY, r.get("verdict").getAsString());
        assertEquals(GcAdvisor.ACTION_ADOPT_BASELINE, r.get("recommend_action").getAsString());
        assertFalse(r.get("recommended_flags").isJsonNull());
        assertTrue(r.get("recommended_flags").getAsString().contains("UseG1GC"));
        assertTrue(r.get("advice").getAsString().toLowerCase().contains("best starting setup")
                || r.get("advice").getAsString().toLowerCase().contains("aikar"));
    }

    @Test
    void g1BasicListsMissingAndCompletesBaseline() {
        JsonObject in = input(40, 2, 30, JvmFlagsClassifier.PROFILE_G1_BASIC);
        JsonArray missing = new JsonArray();
        missing.add("AlwaysPreTouch");
        missing.add("InitiatingHeapOccupancyPercent=15");
        missing.add("aikars.marker");
        in.add("missing_flags", missing);
        JsonObject r = GcAdvisor.evaluate(in);
        assertEquals(GcAdvisor.ACTION_COMPLETE_BASELINE, r.get("recommend_action").getAsString());
        assertFalse(r.get("recommended_flags").isJsonNull());
        assertTrue(r.get("missing_flags").getAsJsonArray().size() >= 2);
        assertTrue(r.get("advice").getAsString().contains("AlwaysPreTouch")
                || r.get("advice").getAsString().toLowerCase().contains("incomplete"));
    }

    @Test
    void heapBoundWhenPressureHigh() {
        JsonObject r = GcAdvisor.evaluate(input(92, 3, 40, JvmFlagsClassifier.PROFILE_AIKARS));
        assertEquals(GcAdvisor.VERDICT_HEAP_BOUND, r.get("verdict").getAsString());
        assertTrue(r.get("raise_gc_pressure_issue").getAsBoolean());
        assertTrue(r.get("advice").getAsString().toLowerCase().contains("memory")
                || r.get("advice").getAsString().toLowerCase().contains("heap"));
    }

    @Test
    void gcBoundWhenPauseHighAndHeapNotFull() {
        JsonObject in = input(50, 15, 40, JvmFlagsClassifier.PROFILE_DEFAULT);
        in.addProperty("xmx_gb", 8);
        in.addProperty("pause_source", "delta");
        JsonObject r = GcAdvisor.evaluate(in);
        assertEquals(GcAdvisor.VERDICT_GC_BOUND, r.get("verdict").getAsString());
        assertTrue(r.get("raise_gc_pressure_issue").getAsBoolean());
        assertFalse(r.get("recommended_flags").isJsonNull());
        assertTrue(r.get("recommended_flags").getAsString().contains("UseG1GC"));
        assertTrue(r.get("recommended_flags").getAsString().contains("MaxGCPauseMillis=200"));
        assertEquals(GcAdvisor.ACTION_ADOPT_BASELINE, r.get("recommend_action").getAsString());
    }

    @Test
    void gcBoundDoesNotRaiseIssueFromUptimeCumulativeAlone() {
        JsonObject in = input(50, 15, 40, JvmFlagsClassifier.PROFILE_DEFAULT);
        in.addProperty("pause_source", "uptime_cumulative");
        JsonObject r = GcAdvisor.evaluate(in);
        assertEquals(GcAdvisor.VERDICT_GC_BOUND, r.get("verdict").getAsString());
        assertFalse(r.get("raise_gc_pressure_issue").getAsBoolean());
    }

    @Test
    void singleThreadBoundWhenMsptHighAndMemoryFine() {
        JsonObject r = GcAdvisor.evaluate(input(40, 2, 80, JvmFlagsClassifier.PROFILE_AIKARS));
        assertEquals(GcAdvisor.VERDICT_SINGLE_THREAD, r.get("verdict").getAsString());
        assertFalse(r.get("raise_gc_pressure_issue").getAsBoolean());
        assertTrue(r.get("advice").getAsString().toLowerCase().contains("main game thread")
                || r.get("advice").getAsString().toLowerCase().contains("mod work")
                || r.get("advice").getAsString().toLowerCase().contains("mods"));
    }

    @Test
    void customProfileNeverGetsFlagShameIssue() {
        JsonObject r = GcAdvisor.evaluate(input(40, 2, 30, JvmFlagsClassifier.PROFILE_CUSTOM));
        assertEquals(GcAdvisor.VERDICT_HEALTHY, r.get("verdict").getAsString());
        assertFalse(r.get("raise_gc_pressure_issue").getAsBoolean());
        assertTrue(r.get("recommended_flags").isJsonNull());
        assertEquals(GcAdvisor.ACTION_KEEP_ADVANCED, r.get("recommend_action").getAsString());
        assertTrue(r.get("advice").getAsString().toLowerCase().contains("custom")
                || r.get("advice").getAsString().toLowerCase().contains("advanced"));
    }

    @Test
    void meowiceHealthyStaysNeutralNoAikarOverwrite() {
        JsonObject r = GcAdvisor.evaluate(input(40, 2, 30, JvmFlagsClassifier.PROFILE_G1_MEOWICE));
        assertEquals(GcAdvisor.VERDICT_HEALTHY, r.get("verdict").getAsString());
        assertTrue(r.get("recommended_flags").isJsonNull());
        assertEquals(GcAdvisor.ACTION_KEEP_ADVANCED, r.get("recommend_action").getAsString());
        assertTrue(r.get("advice").getAsString().toLowerCase().contains("meowice")
                || r.get("advice").getAsString().toLowerCase().contains("advanced"));
    }

    @Test
    void bruceHealthyStaysNeutral() {
        JsonObject r = GcAdvisor.evaluate(input(40, 2, 30, JvmFlagsClassifier.PROFILE_G1_BRUCE));
        assertTrue(r.get("recommended_flags").isJsonNull());
        assertEquals(GcAdvisor.ACTION_KEEP_ADVANCED, r.get("recommend_action").getAsString());
        assertTrue(r.get("advice").getAsString().toLowerCase().contains("bruce")
                || r.get("advice").getAsString().toLowerCase().contains("advanced"));
    }

    @Test
    void largeHeapMismatchRecommendsOverrides() {
        JsonObject in = input(40, 2, 30, JvmFlagsClassifier.PROFILE_AIKARS);
        in.addProperty("large_heap_overrides_ok", false);
        in.addProperty("xmx_gb", 16);
        JsonObject r = GcAdvisor.evaluate(in);
        assertEquals(GcAdvisor.ACTION_APPLY_LARGE_OVERRIDES, r.get("recommend_action").getAsString());
        assertFalse(r.get("recommended_flags").isJsonNull());
        assertTrue(r.get("recommended_flags").getAsString().contains("G1HeapRegionSize=16M"));
        assertTrue(r.get("advice").getAsString().contains("12G")
                || r.get("advice").getAsString().contains("≥12"));
        assertEquals("large_heap", r.get("baseline_variant").getAsString());
    }

    @Test
    void java21RequiredBeforeFlagsOnModernMc() {
        JsonObject in = input(40, 2, 30, JvmFlagsClassifier.PROFILE_DEFAULT);
        in.addProperty("java_major", 17);
        in.addProperty("mc_version", "1.21.1");
        JsonObject r = GcAdvisor.evaluate(in);
        assertEquals(GcAdvisor.ACTION_FIX_JAVA_FIRST, r.get("recommend_action").getAsString());
        assertTrue(r.get("recommended_flags").isJsonNull());
        assertTrue(r.get("advice").getAsString().contains("Java 21"));
    }

    @Test
    void contextIncludesLoaderAndMc() {
        JsonObject in = input(40, 2, 30, JvmFlagsClassifier.PROFILE_DEFAULT);
        in.addProperty("mc_version", "1.21.1");
        in.addProperty("loader", "neoforge");
        JsonObject r = GcAdvisor.evaluate(in);
        assertTrue(r.has("context"));
        assertEquals("1.21.1", r.getAsJsonObject("context").get("mc_version").getAsString());
        assertEquals("neoforge", r.getAsJsonObject("context").get("loader").getAsString());
        assertTrue(r.get("advice").getAsString().contains("NeoForge")
                || r.get("advice").getAsString().contains("1.21.1"));
    }

    @Test
    void aikarsSnippetUsesPaperIhop20OnLarge() {
        String s = GcAdvisor.aikarsSnippet(true);
        assertTrue(s.contains("InitiatingHeapOccupancyPercent=20"));
        assertTrue(s.contains("G1HeapRegionSize=16M"));
        assertFalse(s.toLowerCase().contains("meowice"));
        assertFalse(s.contains("CompilerConfiguration"));
    }

    @Test
    void aikarBaselineGapsDetectsMissingPretouch() {
        JsonObject gaps = JvmFlagsClassifier.aikarBaselineGaps(
                List.of("-Xms8G", "-Xmx8G", "-XX:+UseG1GC", "-XX:MaxGCPauseMillis=200",
                        "-XX:G1NewSizePercent=30", "-XX:G1MaxNewSizePercent=40",
                        "-XX:G1HeapRegionSize=8M", "-XX:InitiatingHeapOccupancyPercent=15",
                        "-XX:+ParallelRefProcEnabled", "-XX:+DisableExplicitGC"),
                8.0);
        JsonArray missing = gaps.getAsJsonArray("missing_flags");
        boolean found = false;
        for (int i = 0; i < missing.size(); i++) {
            if ("AlwaysPreTouch".equals(missing.get(i).getAsString())) {
                found = true;
                break;
            }
        }
        assertTrue(found);
        assertTrue(gaps.getAsJsonObject("flags_coverage").get("expected").getAsInt() >= 10);
    }

    @Test
    void buildJvmHealthMergesCollector() {
        JsonObject sample = new JsonObject();
        sample.addProperty("java_version", "21.0.2");
        sample.addProperty("java_major", 21);
        sample.addProperty("sampled_at", "2026-07-20T00:00:00Z");
        JsonObject flags = new JsonObject();
        flags.addProperty("flags_profile", JvmFlagsClassifier.PROFILE_DEFAULT);
        flags.addProperty("xms_equals_xmx", true);
        flags.addProperty("large_heap_overrides_ok", true);
        flags.addProperty("xmx_gb", 8);
        JsonArray missing = new JsonArray();
        missing.add("UseG1GC");
        missing.add("AlwaysPreTouch");
        flags.add("missing_flags", missing);
        sample.add("flags", flags);
        JsonObject heap = new JsonObject();
        heap.addProperty("pressure_pct", 50);
        heap.addProperty("used_mb", 4096);
        heap.addProperty("max_mb", 8192);
        sample.add("heap", heap);
        JsonObject gc = new JsonObject();
        gc.addProperty("pause_pct_of_wall", 2.0);
        sample.add("jvm_gc", gc);
        sample.addProperty("current_flags", "-Xmx8G -XX:+UseG1GC");
        sample.addProperty("flags_source", "runtime_mxbean");

        JsonObject advisorIn = new JsonObject();
        advisorIn.addProperty("mc_version", "1.21.1");
        advisorIn.addProperty("loader", "neoforge");
        JsonObject health = GcAdvisor.buildJvmHealth(sample, advisorIn);
        assertEquals(GcAdvisor.VERDICT_HEALTHY, health.get("verdict").getAsString());
        assertEquals(JvmFlagsClassifier.PROFILE_DEFAULT, health.get("flags_profile").getAsString());
        assertFalse(health.get("recommended_flags").isJsonNull());
        assertEquals(GcAdvisor.ACTION_ADOPT_BASELINE, health.get("recommend_action").getAsString());
        assertTrue(health.has("context"));
        assertTrue(health.has("missing_flags"));
        assertEquals("-Xmx8G -XX:+UseG1GC", health.get("current_flags").getAsString());
        assertEquals("runtime_mxbean", health.get("flags_source").getAsString());
        assertTrue(health.has("missing_flags_paste"));
        assertTrue(health.getAsJsonArray("missing_flags_paste").size() > 0);
    }

    private static JsonObject input(double heap, double pause, double mspt, String profile) {
        JsonObject in = new JsonObject();
        in.addProperty("heap_pressure_pct", heap);
        in.addProperty("gc_pause_pct_of_wall", pause);
        in.addProperty("mspt", mspt);
        in.addProperty("flags_profile", profile);
        in.addProperty("java_major", 21);
        in.addProperty("xms_equals_xmx", true);
        in.addProperty("large_heap_overrides_ok", true);
        in.addProperty("xmx_gb", 8);
        return in;
    }
}
