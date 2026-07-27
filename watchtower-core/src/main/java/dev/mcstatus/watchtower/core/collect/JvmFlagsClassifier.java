package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Classifies Minecraft JVM startup args into a {@code flags_profile} per
 * GC-JVM-FLAGS-RESEARCH (Paper/flags.sh, Bruce, MeowIce).
 */
public final class JvmFlagsClassifier {

    public static final String PROFILE_AIKARS = "aikars";
    public static final String PROFILE_G1_BASIC = "g1_basic";
    public static final String PROFILE_G1_BRUCE = "g1_bruce";
    public static final String PROFILE_G1_MEOWICE = "g1_meowice";
    public static final String PROFILE_ZGC = "zgc";
    public static final String PROFILE_ZGC_MEOWICE = "zgc_meowice";
    public static final String PROFILE_SHENANDOAH = "shenandoah";
    public static final String PROFILE_GRAAL_G1 = "graal_g1";
    public static final String PROFILE_OPENJ9 = "openj9";
    public static final String PROFILE_DEFAULT = "default";
    public static final String PROFILE_CUSTOM = "custom";
    public static final String PROFILE_UNKNOWN = "unknown";

    private static final Pattern FLAG_EQ = Pattern.compile("^-XX:([A-Za-z0-9_]+)=(.+)$");
    private static final Pattern FLAG_PLUS = Pattern.compile("^-XX:\\+([A-Za-z0-9_]+)$");
    private static final Pattern FLAG_MINUS = Pattern.compile("^-XX:-([A-Za-z0-9_]+)$");
    private static final Pattern XMX = Pattern.compile("^-Xmx(\\d+)([gGmM])$");
    private static final Pattern XMS = Pattern.compile("^-Xms(\\d+)([gGmM])$");

    private JvmFlagsClassifier() {
    }

    public static JsonObject classify(List<String> args) {
        return classify(args, Double.NaN);
    }

    /**
     * @param xmxGbHint optional heap from HostMetrics / parse; NaN if unknown
     */
    public static JsonObject classify(List<String> args, double xmxGbHint) {
        JsonObject out = new JsonObject();
        if (args == null) {
            out.addProperty("flags_profile", PROFILE_UNKNOWN);
            out.add("flags_matched", new JsonArray());
            out.addProperty("xms_equals_xmx", true);
            out.addProperty("large_heap_overrides_ok", true);
            return out;
        }

        ParsedFlags p = ParsedFlags.parse(args);
        double xmx = !Double.isNaN(xmxGbHint) ? xmxGbHint : p.xmxGb;
        if (Double.isNaN(xmx)) {
            xmx = p.xmxGb;
        }

        String profile = resolveProfile(p);
        List<String> matched = matchedMarkers(p, profile);

        out.addProperty("flags_profile", profile);
        JsonArray matchedArr = new JsonArray();
        for (String m : matched) {
            matchedArr.add(m);
        }
        out.add("flags_matched", matchedArr);

        boolean xmsEq = true;
        if (!Double.isNaN(p.xmsGb) && !Double.isNaN(p.xmxGb)) {
            xmsEq = Math.abs(p.xmsGb - p.xmxGb) < 0.05;
        } else if (!Double.isNaN(p.xmxGb) && Double.isNaN(p.xmsGb)) {
            // Dedicated servers should set Xms=Xmx; Xmx alone is an incomplete baseline.
            xmsEq = false;
        }
        out.addProperty("xms_equals_xmx", xmsEq);
        if (!Double.isNaN(p.xmsGb)) {
            out.addProperty("xms_gb", round2(p.xmsGb));
        }
        if (!Double.isNaN(p.xmxGb)) {
            out.addProperty("xmx_gb", round2(p.xmxGb));
        } else if (!Double.isNaN(xmxGbHint)) {
            out.addProperty("xmx_gb", round2(xmxGbHint));
        }

        boolean largeOk = true;
        if (!Double.isNaN(xmx) && xmx >= 12.0 && p.useG1) {
            boolean smallHeapValues = p.g1HeapRegionSizeMb != null && p.g1HeapRegionSizeMb <= 8
                    && p.g1NewSizePercent != null && p.g1NewSizePercent <= 30;
            largeOk = !smallHeapValues;
        }
        out.addProperty("large_heap_overrides_ok", largeOk);
        out.addProperty("has_graal", p.hasGraal);
        out.addProperty("has_aikars_marker", p.hasAikarsMarker);
        out.addProperty("arm_x86_simd_risk", p.hasX86SimdFlags);

        JsonObject gaps = aikarBaselineGaps(p, xmx, xmsEq);
        out.add("missing_flags", gaps.get("missing_flags").deepCopy());
        out.add("missing_flags_paste", gaps.get("missing_flags_paste").deepCopy());
        out.add("flags_coverage", gaps.get("flags_coverage").deepCopy());
        return out;
    }

    /**
     * Expected Aikar / flags.sh keys for this heap size (Paper large set when {@code xmxGb >= 12}).
     */
    public static List<String> expectedAikarFlagKeys(double xmxGb) {
        boolean large = !Double.isNaN(xmxGb) && xmxGb >= 12.0;
        List<String> keys = new ArrayList<>();
        keys.add("UseG1GC");
        keys.add("MaxGCPauseMillis=200");
        keys.add(large ? "G1NewSizePercent=40" : "G1NewSizePercent=30");
        keys.add(large ? "G1MaxNewSizePercent=50" : "G1MaxNewSizePercent=40");
        keys.add(large ? "G1HeapRegionSize=16M" : "G1HeapRegionSize=8M");
        keys.add(large ? "G1ReservePercent=15" : "G1ReservePercent=20");
        keys.add(large ? "InitiatingHeapOccupancyPercent=20" : "InitiatingHeapOccupancyPercent=15");
        keys.add("ParallelRefProcEnabled");
        keys.add("DisableExplicitGC");
        keys.add("AlwaysPreTouch");
        keys.add("UnlockExperimentalVMOptions");
        keys.add("G1MixedGCLiveThresholdPercent=90");
        keys.add("G1RSetUpdatingPauseTimePercent=5");
        keys.add("SurvivorRatio=32");
        keys.add("PerfDisableSharedMem");
        keys.add("MaxTenuringThreshold=1");
        keys.add("Xms=Xmx");
        keys.add("aikars.marker");
        return keys;
    }

    /**
     * Diff parsed JVM args against the Aikar / flags.sh baseline for this heap.
     * Returns {@code missing_flags} (array of human keys) and {@code flags_coverage}.
     */
    public static JsonObject aikarBaselineGaps(List<String> args, double xmxGbHint) {
        ParsedFlags p = ParsedFlags.parse(args != null ? args : List.of());
        double xmx = !Double.isNaN(xmxGbHint) ? xmxGbHint : p.xmxGb;
        boolean xmsEq = true;
        if (!Double.isNaN(p.xmsGb) && !Double.isNaN(p.xmxGb)) {
            xmsEq = Math.abs(p.xmsGb - p.xmxGb) < 0.05;
        } else if (!Double.isNaN(p.xmxGb) && Double.isNaN(p.xmsGb)) {
            xmsEq = false;
        }
        return aikarBaselineGaps(p, xmx, xmsEq);
    }

    static JsonObject aikarBaselineGaps(ParsedFlags p, double xmxGb, boolean xmsEqualsXmx) {
        boolean large = !Double.isNaN(xmxGb) && xmxGb >= 12.0;
        List<String> expected = expectedAikarFlagKeys(xmxGb);
        List<String> missing = new ArrayList<>();

        if (!p.useG1) {
            missing.add("UseG1GC");
        }
        if (p.maxGcPauseMillis == null || p.maxGcPauseMillis < 150 || p.maxGcPauseMillis > 250) {
            missing.add("MaxGCPauseMillis=200");
        }
        if (large) {
            if (p.g1NewSizePercent == null || p.g1NewSizePercent < 38) {
                missing.add("G1NewSizePercent=40");
            }
            if (p.g1MaxNewSizePercent == null || p.g1MaxNewSizePercent < 48) {
                missing.add("G1MaxNewSizePercent=50");
            }
            if (p.g1HeapRegionSizeMb == null || p.g1HeapRegionSizeMb < 16) {
                missing.add("G1HeapRegionSize=16M");
            }
            // Paper large set uses 15; small-heap leftover of 20 is worth correcting.
            if (p.g1ReservePercent == null || p.g1ReservePercent >= 18) {
                missing.add("G1ReservePercent=15");
            }
            if (p.ihop == null || p.ihop < 14 || p.ihop > 22) {
                missing.add("InitiatingHeapOccupancyPercent=20");
            }
        } else {
            if (p.g1NewSizePercent == null || p.g1NewSizePercent < 28 || p.g1NewSizePercent > 42) {
                missing.add("G1NewSizePercent=30");
            }
            if (p.g1MaxNewSizePercent == null || p.g1MaxNewSizePercent < 38 || p.g1MaxNewSizePercent > 52) {
                missing.add("G1MaxNewSizePercent=40");
            }
            if (p.g1HeapRegionSizeMb == null || (p.g1HeapRegionSizeMb != 8 && p.g1HeapRegionSizeMb != 16)) {
                missing.add("G1HeapRegionSize=8M");
            }
            if (p.g1ReservePercent == null) {
                missing.add("G1ReservePercent=20");
            }
            if (p.ihop == null || p.ihop < 14 || p.ihop > 22) {
                missing.add("InitiatingHeapOccupancyPercent=15");
            }
        }
        if (!p.parallelRefProc) {
            missing.add("ParallelRefProcEnabled");
        }
        if (!p.disableExplicitGc) {
            missing.add("DisableExplicitGC");
        }
        if (!p.alwaysPreTouch) {
            missing.add("AlwaysPreTouch");
        }
        if (!p.unlockExperimental) {
            missing.add("UnlockExperimentalVMOptions");
        }
        if (p.g1MixedGcLive == null) {
            missing.add("G1MixedGCLiveThresholdPercent=90");
        }
        if (p.g1RSetUpdating == null) {
            missing.add("G1RSetUpdatingPauseTimePercent=5");
        }
        if (p.survivorRatio == null || p.survivorRatio != 32) {
            missing.add("SurvivorRatio=32");
        }
        if (!p.perfDisableSharedMem) {
            missing.add("PerfDisableSharedMem");
        }
        if (p.maxTenuring == null || p.maxTenuring != 1) {
            missing.add("MaxTenuringThreshold=1");
        }
        if (!xmsEqualsXmx) {
            missing.add("Xms=Xmx");
        }
        if (!p.hasAikarsMarker) {
            missing.add("aikars.marker");
        }

        int expectedCount = expected.size();
        int matched = Math.max(0, expectedCount - missing.size());

        JsonObject out = new JsonObject();
        JsonArray missArr = new JsonArray();
        for (String m : missing) {
            missArr.add(m);
        }
        out.add("missing_flags", missArr);
        out.add("missing_flags_paste", missingFlagsToPaste(missArr));
        JsonObject coverage = new JsonObject();
        coverage.addProperty("matched", matched);
        coverage.addProperty("expected", expectedCount);
        out.add("flags_coverage", coverage);
        return out;
    }

    /**
     * Map human missing keys (from {@link #expectedAikarFlagKeys}) to pasteable JVM tokens.
     * {@code Xms=Xmx} is omitted (UI should show a sizing note instead).
     */
    public static String pasteTokenForMissingKey(String key) {
        if (key == null || key.isBlank()) {
            return null;
        }
        String k = key.strip();
        return switch (k) {
            case "UseG1GC" -> "-XX:+UseG1GC";
            case "ParallelRefProcEnabled" -> "-XX:+ParallelRefProcEnabled";
            case "DisableExplicitGC" -> "-XX:+DisableExplicitGC";
            case "AlwaysPreTouch" -> "-XX:+AlwaysPreTouch";
            case "UnlockExperimentalVMOptions" -> "-XX:+UnlockExperimentalVMOptions";
            case "PerfDisableSharedMem" -> "-XX:+PerfDisableSharedMem";
            case "Xms=Xmx" -> null;
            case "aikars.marker" ->
                    "-Dusing.aikars.flags=https://mcflags.emc.gs -Daikars.new.flags=true";
            default -> {
                if (k.contains("=")) {
                    yield "-XX:" + k;
                }
                yield "-XX:+" + k;
            }
        };
    }

    public static JsonArray missingFlagsToPaste(JsonArray missingKeys) {
        JsonArray out = new JsonArray();
        if (missingKeys == null) {
            return out;
        }
        LinkedHashSet<String> seen = new LinkedHashSet<>();
        for (int i = 0; i < missingKeys.size(); i++) {
            if (!missingKeys.get(i).isJsonPrimitive()) {
                continue;
            }
            String token = pasteTokenForMissingKey(missingKeys.get(i).getAsString());
            if (token == null || token.isBlank()) {
                continue;
            }
            for (String part : token.split("\\s+")) {
                if (!part.isBlank() && seen.add(part)) {
                    out.add(part);
                }
            }
        }
        return out;
    }

    static String resolveProfile(ParsedFlags p) {
        if (p.openj9) {
            return PROFILE_OPENJ9;
        }
        if (p.useShenandoah) {
            return PROFILE_SHENANDOAH;
        }
        if (p.useZgc) {
            if (isMeowiceZgc(p)) {
                return PROFILE_ZGC_MEOWICE;
            }
            return PROFILE_ZGC;
        }
        if (p.useG1) {
            if (isMeowiceG1(p)) {
                return PROFILE_G1_MEOWICE;
            }
            if (isBruceG1(p)) {
                return PROFILE_G1_BRUCE;
            }
            int score = aikarsScore(p);
            if (score >= 10) {
                return PROFILE_AIKARS;
            }
            if (p.hasGraal) {
                return PROFILE_GRAAL_G1;
            }
            return PROFILE_G1_BASIC;
        }
        if (p.useParallel || p.useSerial || !p.anyGcFlag) {
            if (p.hasGraal) {
                return PROFILE_CUSTOM;
            }
            return PROFILE_DEFAULT;
        }
        return PROFILE_CUSTOM;
    }

    private static boolean isMeowiceZgc(ParsedFlags p) {
        return p.zProactiveOff && p.hasSoftMaxHeapSize && p.hasGraal;
    }

    private static boolean isMeowiceG1(ParsedFlags p) {
        if (!p.hasGraal) {
            return false;
        }
        boolean newSize = p.g1NewSizePercent != null && p.g1NewSizePercent >= 26 && p.g1NewSizePercent <= 30;
        boolean rset = p.g1RSetUpdating != null && p.g1RSetUpdating == 0;
        boolean pause = p.maxGcPauseMillis != null && p.maxGcPauseMillis >= 180 && p.maxGcPauseMillis <= 220;
        boolean conc = p.hasSatb || p.hasConcMarkStep;
        return newSize && rset && pause && conc;
    }

    private static boolean isBruceG1(ParsedFlags p) {
        boolean pause = p.maxGcPauseMillis != null && p.maxGcPauseMillis >= 100 && p.maxGcPauseMillis <= 150;
        boolean ihop = p.ihop != null && p.ihop >= 8 && p.ihop <= 12;
        boolean rset = p.g1RSetUpdating != null && p.g1RSetUpdating == 0;
        boolean newSize = p.g1NewSizePercent != null && p.g1NewSizePercent >= 26 && p.g1NewSizePercent <= 30;
        boolean conc = p.hasSatb || p.hasConcMarkStep;
        int hits = 0;
        if (pause) {
            hits++;
        }
        if (ihop) {
            hits++;
        }
        if (rset) {
            hits++;
        }
        if (newSize) {
            hits++;
        }
        if (conc) {
            hits++;
        }
        // Prefer Bruce when MaxGCPause≈130 cluster dominates (not Aikar 200).
        return hits >= 3 && (pause || (rset && ihop));
    }

    private static int aikarsScore(ParsedFlags p) {
        int score = 0;
        if (p.useG1) {
            score += 2;
        }
        if (p.g1NewSizePercent != null && ((p.g1NewSizePercent >= 28 && p.g1NewSizePercent <= 42)
                || (p.g1NewSizePercent >= 38 && p.g1NewSizePercent <= 52))) {
            score += 2;
        }
        if (p.ihop != null && p.ihop >= 14 && p.ihop <= 22) {
            score += 2;
        }
        if (p.maxGcPauseMillis != null && p.maxGcPauseMillis >= 150 && p.maxGcPauseMillis <= 250) {
            score += 2;
        }
        if (p.hasAikarsMarker) {
            score += 2;
        }
        if (p.parallelRefProc) {
            score += 1;
        }
        if (p.disableExplicitGc) {
            score += 1;
        }
        if (p.alwaysPreTouch) {
            score += 1;
        }
        if (p.g1HeapRegionSizeMb != null && (p.g1HeapRegionSizeMb == 8 || p.g1HeapRegionSizeMb == 16)) {
            score += 1;
        }
        if (p.g1ReservePercent != null) {
            score += 1;
        }
        if (p.g1MixedGcLive != null) {
            score += 1;
        }
        if (p.g1RSetUpdating != null) {
            score += 1;
        }
        if (p.perfDisableSharedMem) {
            score += 1;
        }
        if (p.maxTenuring != null && p.maxTenuring == 1) {
            score += 1;
        }
        if (p.survivorRatio != null && p.survivorRatio == 32) {
            score += 1;
        }
        if (p.unlockExperimental) {
            score += 1;
        }
        return score;
    }

    private static List<String> matchedMarkers(ParsedFlags p, String profile) {
        Set<String> m = new LinkedHashSet<>();
        if (p.useG1) {
            m.add("UseG1GC");
        }
        if (p.useZgc) {
            m.add("UseZGC");
        }
        if (p.useShenandoah) {
            m.add("UseShenandoahGC");
        }
        if (p.maxGcPauseMillis != null) {
            m.add("MaxGCPauseMillis");
        }
        if (p.g1NewSizePercent != null) {
            m.add("G1NewSizePercent");
        }
        if (p.ihop != null) {
            m.add("InitiatingHeapOccupancyPercent");
        }
        if (p.parallelRefProc) {
            m.add("ParallelRefProcEnabled");
        }
        if (p.disableExplicitGc) {
            m.add("DisableExplicitGC");
        }
        if (p.alwaysPreTouch) {
            m.add("AlwaysPreTouch");
        }
        if (p.hasAikarsMarker) {
            m.add("aikars.marker");
        }
        if (p.hasGraal) {
            m.add("graal");
        }
        if (PROFILE_G1_BRUCE.equals(profile) || PROFILE_G1_MEOWICE.equals(profile)) {
            if (p.g1RSetUpdating != null && p.g1RSetUpdating == 0) {
                m.add("G1RSetUpdatingPauseTimePercent");
            }
            if (p.hasSatb) {
                m.add("G1SATBBufferEnqueueingThresholdPercent");
            }
        }
        if (PROFILE_ZGC_MEOWICE.equals(profile)) {
            if (p.zProactiveOff) {
                m.add("ZProactiveOff");
            }
            if (p.hasSoftMaxHeapSize) {
                m.add("SoftMaxHeapSize");
            }
        }
        return new ArrayList<>(m);
    }

    static double parseHeapGb(String arg) {
        Matcher mx = XMX.matcher(arg);
        Matcher ms = XMS.matcher(arg);
        Matcher m = mx.matches() ? mx : (ms.matches() ? ms : null);
        if (m == null) {
            return Double.NaN;
        }
        int val = Integer.parseInt(m.group(1));
        char unit = Character.toLowerCase(m.group(2).charAt(0));
        return unit == 'g' ? val : Math.round(val / 1024.0 * 100.0) / 100.0;
    }

    private static double round2(double v) {
        return Math.round(v * 100.0) / 100.0;
    }

    static final class ParsedFlags {
        boolean useG1;
        boolean useZgc;
        boolean useShenandoah;
        boolean useParallel;
        boolean useSerial;
        boolean anyGcFlag;
        boolean parallelRefProc;
        boolean disableExplicitGc;
        boolean alwaysPreTouch;
        boolean perfDisableSharedMem;
        boolean unlockExperimental;
        boolean hasAikarsMarker;
        boolean hasGraal;
        boolean openj9;
        boolean zProactiveOff;
        boolean hasSoftMaxHeapSize;
        boolean hasSatb;
        boolean hasConcMarkStep;
        boolean hasX86SimdFlags;
        Integer maxGcPauseMillis;
        Integer g1NewSizePercent;
        Integer g1MaxNewSizePercent;
        Integer g1HeapRegionSizeMb;
        Integer g1ReservePercent;
        Integer ihop;
        Integer g1MixedGcLive;
        Integer g1RSetUpdating;
        Integer maxTenuring;
        Integer survivorRatio;
        double xmsGb = Double.NaN;
        double xmxGb = Double.NaN;

        static ParsedFlags parse(List<String> args) {
            ParsedFlags p = new ParsedFlags();
            for (String raw : args) {
                if (raw == null || raw.isBlank()) {
                    continue;
                }
                String a = raw.trim();
                String lower = a.toLowerCase(Locale.ROOT);

                if (lower.startsWith("-xms")) {
                    double gb = parseHeapGb(a);
                    if (!Double.isNaN(gb)) {
                        p.xmsGb = gb;
                    }
                }
                if (lower.startsWith("-xmx")) {
                    double gb = parseHeapGb(a);
                    if (!Double.isNaN(gb)) {
                        p.xmxGb = gb;
                    }
                }

                if (lower.contains("aikars.new.flags") || lower.contains("using.aikars.flags")
                        || lower.contains("mcflags.emc.gs")) {
                    p.hasAikarsMarker = true;
                }
                if (lower.contains("jdk.graal.") || lower.contains("compilerconfiguration=enterprise")
                        || a.contains("+EagerJVMCI") || lower.contains("graal.")) {
                    p.hasGraal = true;
                }
                if (lower.contains("-xgcpolicy") || lower.contains("openj9") || lower.contains("-xjit")) {
                    p.openj9 = true;
                }
                if (a.contains("SoftMaxHeapSize")) {
                    p.hasSoftMaxHeapSize = true;
                }
                if (a.contains("G1SATBBufferEnqueueingThresholdPercent")) {
                    p.hasSatb = true;
                }
                if (a.contains("G1ConcMarkStepDurationMillis")) {
                    p.hasConcMarkStep = true;
                }
                if (a.contains("+UseFastStosb") || a.contains("+UseXmmI2D") || a.contains("+UseXmmI2F")
                        || a.contains("UseAVX=")) {
                    p.hasX86SimdFlags = true;
                }

                Matcher plus = FLAG_PLUS.matcher(a);
                if (plus.matches()) {
                    applyPlus(p, plus.group(1));
                    continue;
                }
                Matcher minus = FLAG_MINUS.matcher(a);
                if (minus.matches()) {
                    applyMinus(p, minus.group(1));
                    continue;
                }
                Matcher eq = FLAG_EQ.matcher(a);
                if (eq.matches()) {
                    applyEq(p, eq.group(1), eq.group(2));
                }
            }
            return p;
        }

        private static void applyPlus(ParsedFlags p, String name) {
            switch (name) {
                case "UseG1GC" -> {
                    p.useG1 = true;
                    p.anyGcFlag = true;
                }
                case "UseZGC" -> {
                    p.useZgc = true;
                    p.anyGcFlag = true;
                }
                case "UseShenandoahGC" -> {
                    p.useShenandoah = true;
                    p.anyGcFlag = true;
                }
                case "UseParallelGC", "UseParallelOldGC" -> {
                    p.useParallel = true;
                    p.anyGcFlag = true;
                }
                case "UseSerialGC" -> {
                    p.useSerial = true;
                    p.anyGcFlag = true;
                }
                case "ParallelRefProcEnabled" -> p.parallelRefProc = true;
                case "DisableExplicitGC" -> p.disableExplicitGc = true;
                case "AlwaysPreTouch" -> p.alwaysPreTouch = true;
                case "PerfDisableSharedMem" -> p.perfDisableSharedMem = true;
                case "UnlockExperimentalVMOptions" -> p.unlockExperimental = true;
                case "EagerJVMCI" -> p.hasGraal = true;
                case "ZGenerational" -> { /* zgc variant */ }
                default -> {
                }
            }
        }

        private static void applyMinus(ParsedFlags p, String name) {
            if ("ZProactive".equals(name)) {
                p.zProactiveOff = true;
            }
        }

        private static void applyEq(ParsedFlags p, String name, String value) {
            Integer iv = parseIntSafe(value);
            switch (name) {
                case "MaxGCPauseMillis" -> p.maxGcPauseMillis = iv;
                case "G1NewSizePercent" -> p.g1NewSizePercent = iv;
                case "G1MaxNewSizePercent" -> p.g1MaxNewSizePercent = iv;
                case "G1HeapRegionSize" -> p.g1HeapRegionSizeMb = parseRegionMb(value);
                case "G1ReservePercent" -> p.g1ReservePercent = iv;
                case "InitiatingHeapOccupancyPercent" -> p.ihop = iv;
                case "G1MixedGCLiveThresholdPercent" -> p.g1MixedGcLive = iv;
                case "G1RSetUpdatingPauseTimePercent" -> p.g1RSetUpdating = iv;
                case "MaxTenuringThreshold" -> p.maxTenuring = iv;
                case "SurvivorRatio" -> p.survivorRatio = iv;
                case "CompilerConfiguration" -> {
                    if ("enterprise".equalsIgnoreCase(value)) {
                        p.hasGraal = true;
                    }
                }
                default -> {
                }
            }
        }

        private static Integer parseIntSafe(String value) {
            try {
                String v = value.trim();
                if (v.endsWith("M") || v.endsWith("m") || v.endsWith("G") || v.endsWith("g")) {
                    v = v.substring(0, v.length() - 1);
                }
                return Integer.parseInt(v);
            } catch (NumberFormatException e) {
                return null;
            }
        }

        private static Integer parseRegionMb(String value) {
            String v = value.trim().toUpperCase(Locale.ROOT);
            try {
                if (v.endsWith("M")) {
                    return Integer.parseInt(v.substring(0, v.length() - 1));
                }
                if (v.endsWith("G")) {
                    return Integer.parseInt(v.substring(0, v.length() - 1)) * 1024;
                }
                int bytes = Integer.parseInt(v);
                return bytes / (1024 * 1024);
            } catch (NumberFormatException e) {
                return null;
            }
        }
    }
}
