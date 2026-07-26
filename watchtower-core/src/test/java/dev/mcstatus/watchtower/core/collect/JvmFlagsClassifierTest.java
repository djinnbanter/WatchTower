package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonObject;
import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class JvmFlagsClassifierTest {

    private static final List<String> AIKARS_STANDARD = List.of(
            "-Xms8G", "-Xmx8G",
            "-XX:+UseG1GC", "-XX:+ParallelRefProcEnabled", "-XX:MaxGCPauseMillis=200",
            "-XX:+UnlockExperimentalVMOptions", "-XX:+DisableExplicitGC", "-XX:+AlwaysPreTouch",
            "-XX:G1NewSizePercent=30", "-XX:G1MaxNewSizePercent=40", "-XX:G1HeapRegionSize=8M",
            "-XX:G1ReservePercent=20", "-XX:G1HeapWastePercent=5", "-XX:G1MixedGCCountTarget=4",
            "-XX:InitiatingHeapOccupancyPercent=15", "-XX:G1MixedGCLiveThresholdPercent=90",
            "-XX:G1RSetUpdatingPauseTimePercent=5", "-XX:SurvivorRatio=32",
            "-XX:+PerfDisableSharedMem", "-XX:MaxTenuringThreshold=1",
            "-Dusing.aikars.flags=https://mcflags.emc.gs", "-Daikars.new.flags=true"
    );

    private static final List<String> FLAGS_SH_LARGE = List.of(
            "-Xms12288M", "-Xmx12288M",
            "-XX:+UseG1GC", "-XX:+ParallelRefProcEnabled", "-XX:MaxGCPauseMillis=200",
            "-XX:+UnlockExperimentalVMOptions", "-XX:+DisableExplicitGC", "-XX:+AlwaysPreTouch",
            "-XX:G1HeapWastePercent=5", "-XX:G1MixedGCCountTarget=4",
            "-XX:InitiatingHeapOccupancyPercent=15", "-XX:G1MixedGCLiveThresholdPercent=90",
            "-XX:G1RSetUpdatingPauseTimePercent=5", "-XX:SurvivorRatio=32",
            "-XX:+PerfDisableSharedMem", "-XX:MaxTenuringThreshold=1",
            "-Dusing.aikars.flags=https://mcflags.emc.gs", "-Daikars.new.flags=true",
            "-XX:G1NewSizePercent=40", "-XX:G1MaxNewSizePercent=50",
            "-XX:G1HeapRegionSize=16M", "-XX:G1ReservePercent=15"
    );

    private static final List<String> BRUCE_G1 = List.of(
            "-XX:+UseG1GC", "-XX:MaxGCPauseMillis=130", "-XX:G1NewSizePercent=28",
            "-XX:InitiatingHeapOccupancyPercent=10", "-XX:G1RSetUpdatingPauseTimePercent=0",
            "-XX:G1SATBBufferEnqueueingThresholdPercent=30", "-XX:G1ConcMarkStepDurationMillis=5",
            "-XX:+AlwaysPreTouch", "-XX:+DisableExplicitGC"
    );

    private static final List<String> MEOWICE_G1 = List.of(
            "-XX:+UseG1GC", "-XX:MaxGCPauseMillis=200", "-XX:G1NewSizePercent=28",
            "-XX:G1MaxNewSizePercent=50", "-XX:G1HeapRegionSize=16M", "-XX:G1ReservePercent=15",
            "-XX:InitiatingHeapOccupancyPercent=20", "-XX:G1RSetUpdatingPauseTimePercent=0",
            "-XX:G1SATBBufferEnqueueingThresholdPercent=30", "-XX:G1ConcMarkStepDurationMillis=5",
            "-XX:+EagerJVMCI", "-Djdk.graal.CompilerConfiguration=enterprise",
            "-XX:ReservedCodeCacheSize=400M", "-XX:+UseCriticalJavaThreadPriority"
    );

    private static final List<String> MEOWICE_ZGC = List.of(
            "-XX:+UseZGC", "-XX:-ZProactive", "-XX:SoftMaxHeapSize=30000M",
            "-XX:+EagerJVMCI", "-Djdk.graal.CompilerConfiguration=enterprise",
            "-XX:AllocatePrefetchStyle=1"
    );

    @Test
    void classifiesAikarsStandard() {
        JsonObject r = JvmFlagsClassifier.classify(AIKARS_STANDARD);
        assertEquals(JvmFlagsClassifier.PROFILE_AIKARS, r.get("flags_profile").getAsString());
        assertTrue(r.get("xms_equals_xmx").getAsBoolean());
        assertTrue(r.get("large_heap_overrides_ok").getAsBoolean());
    }

    @Test
    void classifiesFlagsShLargeWithIhop15AsAikars() {
        JsonObject r = JvmFlagsClassifier.classify(FLAGS_SH_LARGE, 12.0);
        assertEquals(JvmFlagsClassifier.PROFILE_AIKARS, r.get("flags_profile").getAsString());
        assertTrue(r.get("large_heap_overrides_ok").getAsBoolean());
    }

    @Test
    void detectsLargeHeapWithSmallAikarValues() {
        JsonObject r = JvmFlagsClassifier.classify(AIKARS_STANDARD, 16.0);
        assertEquals(JvmFlagsClassifier.PROFILE_AIKARS, r.get("flags_profile").getAsString());
        assertFalse(r.get("large_heap_overrides_ok").getAsBoolean());
    }

    @Test
    void classifiesBruceG1() {
        JsonObject r = JvmFlagsClassifier.classify(BRUCE_G1);
        assertEquals(JvmFlagsClassifier.PROFILE_G1_BRUCE, r.get("flags_profile").getAsString());
    }

    @Test
    void classifiesMeowiceG1() {
        JsonObject r = JvmFlagsClassifier.classify(MEOWICE_G1);
        assertEquals(JvmFlagsClassifier.PROFILE_G1_MEOWICE, r.get("flags_profile").getAsString());
    }

    @Test
    void classifiesMeowiceZgc() {
        JsonObject r = JvmFlagsClassifier.classify(MEOWICE_ZGC);
        assertEquals(JvmFlagsClassifier.PROFILE_ZGC_MEOWICE, r.get("flags_profile").getAsString());
    }

    @Test
    void classifiesPlainZgc() {
        JsonObject r = JvmFlagsClassifier.classify(List.of("-XX:+UseZGC", "-XX:+ZGenerational"));
        assertEquals(JvmFlagsClassifier.PROFILE_ZGC, r.get("flags_profile").getAsString());
    }

    @Test
    void classifiesDefaultWhenNoGcFlags() {
        JsonObject r = JvmFlagsClassifier.classify(List.of("-Xms4G", "-Xmx4G"));
        assertEquals(JvmFlagsClassifier.PROFILE_DEFAULT, r.get("flags_profile").getAsString());
    }

    @Test
    void classifiesG1BasicWhenIncomplete() {
        JsonObject r = JvmFlagsClassifier.classify(List.of("-XX:+UseG1GC", "-XX:MaxGCPauseMillis=200"));
        assertEquals(JvmFlagsClassifier.PROFILE_G1_BASIC, r.get("flags_profile").getAsString());
    }

    @Test
    void classifiesShenandoahAndOpenj9() {
        assertEquals(JvmFlagsClassifier.PROFILE_SHENANDOAH,
                JvmFlagsClassifier.classify(List.of("-XX:+UseShenandoahGC"))
                        .get("flags_profile").getAsString());
        assertEquals(JvmFlagsClassifier.PROFILE_OPENJ9,
                JvmFlagsClassifier.classify(List.of("-Xgcpolicy:gencon"))
                        .get("flags_profile").getAsString());
    }

    @Test
    void unknownWhenNullArgs() {
        assertEquals(JvmFlagsClassifier.PROFILE_UNKNOWN,
                JvmFlagsClassifier.classify(null).get("flags_profile").getAsString());
    }

    @Test
    void splitsArgsFromJoinedLine() {
        // sanity: classifier tolerates typical arg list shape
        List<String> args = Arrays.asList(AIKARS_STANDARD.toArray(new String[0]));
        assertEquals(JvmFlagsClassifier.PROFILE_AIKARS,
                JvmFlagsClassifier.classify(args).get("flags_profile").getAsString());
    }

    @Test
    void xmxWithoutXmsIsNotEquals() {
        JsonObject r = JvmFlagsClassifier.classify(List.of("-Xmx8G", "-XX:+UseG1GC"));
        assertFalse(r.get("xms_equals_xmx").getAsBoolean());
        boolean found = false;
        for (var el : r.getAsJsonArray("missing_flags")) {
            if ("Xms=Xmx".equals(el.getAsString())) {
                found = true;
                break;
            }
        }
        assertTrue(found);
        // Xms=Xmx is a note, not a paste token
        for (var el : r.getAsJsonArray("missing_flags_paste")) {
            assertFalse(el.getAsString().contains("Xms=Xmx"));
        }
    }

    @Test
    void missingFlagsPasteMapsKeysToTokens() {
        assertEquals("-XX:+UseG1GC", JvmFlagsClassifier.pasteTokenForMissingKey("UseG1GC"));
        assertEquals("-XX:MaxGCPauseMillis=200",
                JvmFlagsClassifier.pasteTokenForMissingKey("MaxGCPauseMillis=200"));
        assertNull(JvmFlagsClassifier.pasteTokenForMissingKey("Xms=Xmx"));

        JsonObject r = JvmFlagsClassifier.classify(List.of("-Xmx8G"));
        assertTrue(r.has("missing_flags_paste"));
        boolean hasUseG1 = false;
        for (var el : r.getAsJsonArray("missing_flags_paste")) {
            if ("-XX:+UseG1GC".equals(el.getAsString())) {
                hasUseG1 = true;
            }
        }
        assertTrue(hasUseG1);
    }

    @Test
    void largeHeapFlagsSmallReserveAsMissing() {
        JsonObject gaps = JvmFlagsClassifier.aikarBaselineGaps(
                List.of("-Xms16G", "-Xmx16G", "-XX:+UseG1GC", "-XX:MaxGCPauseMillis=200",
                        "-XX:G1NewSizePercent=40", "-XX:G1MaxNewSizePercent=50",
                        "-XX:G1HeapRegionSize=16M", "-XX:G1ReservePercent=20",
                        "-XX:InitiatingHeapOccupancyPercent=20",
                        "-XX:+ParallelRefProcEnabled", "-XX:+DisableExplicitGC", "-XX:+AlwaysPreTouch",
                        "-XX:+UnlockExperimentalVMOptions", "-XX:G1MixedGCLiveThresholdPercent=90",
                        "-XX:G1RSetUpdatingPauseTimePercent=5", "-XX:SurvivorRatio=32",
                        "-XX:+PerfDisableSharedMem", "-XX:MaxTenuringThreshold=1",
                        "-Daikars.new.flags=true"),
                16.0);
        boolean found = false;
        for (var el : gaps.getAsJsonArray("missing_flags")) {
            if ("G1ReservePercent=15".equals(el.getAsString())) {
                found = true;
                break;
            }
        }
        assertTrue(found);
    }
}
