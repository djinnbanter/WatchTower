package dev.mcstatus.watchtower.core.analyze;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.collect.JvmFlagsClassifier;

import java.util.ArrayList;
import java.util.List;

/**
 * Rule-based GC / heap / flags advisor (research-locked for 1.1.2).
 */
public final class GcAdvisor {

    public static final String VERDICT_HEAP_BOUND = "heap_bound";
    public static final String VERDICT_GC_BOUND = "gc_bound";
    public static final String VERDICT_SINGLE_THREAD = "single_thread_bound";
    public static final String VERDICT_HEALTHY = "healthy";

    public static final double HEAP_BOUND_PCT = 90.0;
    public static final double HEAP_SOFT_PCT = 85.0;
    public static final double GC_BOUND_PAUSE_PCT = 10.0;
    public static final double SINGLE_THREAD_HEAP_MAX = 70.0;
    public static final double SINGLE_THREAD_PAUSE_MAX = 5.0;
    public static final double MSPT_HIGH = 50.0;

    public static final String ACTION_FIX_JAVA_FIRST = "fix_java_first";
    public static final String ACTION_ADOPT_BASELINE = "adopt_baseline";
    public static final String ACTION_COMPLETE_BASELINE = "complete_baseline";
    public static final String ACTION_APPLY_LARGE_OVERRIDES = "apply_large_overrides";
    public static final String ACTION_KEEP = "keep";
    public static final String ACTION_KEEP_ADVANCED = "keep_advanced";
    public static final String ACTION_OPTIONAL_ZGC = "optional_zgc";

    private GcAdvisor() {
    }

    public static JsonObject evaluate(JsonObject input) {
        double heapPressure = dbl(input, "heap_pressure_pct", Double.NaN);
        double gcPausePct = dbl(input, "gc_pause_pct_of_wall", Double.NaN);
        double mspt = dbl(input, "mspt", Double.NaN);
        boolean sustainedPressure = bool(input, "sustained_heap_pressure", false);
        int javaMajor = (int) dbl(input, "java_major", -1);
        String mcVersion = str(input, "mc_version");
        String loader = str(input, "loader");
        String profile = str(input, "flags_profile");
        if (profile == null || profile.isBlank()) {
            profile = JvmFlagsClassifier.PROFILE_UNKNOWN;
        }
        boolean xmsEq = bool(input, "xms_equals_xmx", true);
        boolean largeOk = bool(input, "large_heap_overrides_ok", true);
        double xmxGb = dbl(input, "xmx_gb", Double.NaN);
        boolean tickLag = bool(input, "tick_lag", false);
        int cpuCount = (int) dbl(input, "cpu_count", -1);

        JsonArray missingFlags = new JsonArray();
        if (input.has("missing_flags") && input.get("missing_flags").isJsonArray()) {
            missingFlags = input.getAsJsonArray("missing_flags").deepCopy();
        }
        JsonObject coverage = null;
        if (input.has("flags_coverage") && input.get("flags_coverage").isJsonObject()) {
            coverage = input.getAsJsonObject("flags_coverage").deepCopy();
        }

        boolean largeHeap = !Double.isNaN(xmxGb) && xmxGb >= 12.0;
        String baselineVariant = largeHeap ? "large_heap" : "standard";
        String baselineName = "Aikar / flags.sh G1";

        String verdict = resolveVerdict(heapPressure, gcPausePct, mspt, tickLag, sustainedPressure);
        Recommendation reco = resolveRecommendation(
                verdict, profile, javaMajor, mcVersion, xmxGb, xmsEq, largeOk,
                gcPausePct, cpuCount, missingFlags);

        String advice = buildAdvice(
                verdict, profile, javaMajor, mcVersion, loader, xmxGb, xmsEq, largeOk,
                heapPressure, gcPausePct, cpuCount, reco);

        JsonObject out = new JsonObject();
        out.addProperty("verdict", verdict);
        out.addProperty("advice", advice);
        out.addProperty("recommend_action", reco.action);
        out.addProperty("baseline_name", baselineName);
        out.addProperty("baseline_variant", baselineVariant);
        if (reco.recommendedFlags != null) {
            out.addProperty("recommended_flags", reco.recommendedFlags);
        } else {
            out.add("recommended_flags", com.google.gson.JsonNull.INSTANCE);
        }
        if (reco.optionalZgcFlags != null) {
            out.addProperty("optional_zgc_flags", reco.optionalZgcFlags);
        }
        out.add("missing_flags", reco.exposeMissing ? reco.missingFlags : new JsonArray());
        out.add("missing_flags_paste", JvmFlagsClassifier.missingFlagsToPaste(
                reco.exposeMissing ? reco.missingFlags : new JsonArray()));
        if (coverage != null) {
            out.add("flags_coverage", coverage);
        }
        JsonObject context = new JsonObject();
        if (javaMajor >= 0) {
            context.addProperty("java_major", javaMajor);
        }
        if (mcVersion != null && !mcVersion.isBlank()) {
            context.addProperty("mc_version", mcVersion);
        }
        if (loader != null && !loader.isBlank()) {
            context.addProperty("loader", loader);
        }
        if (!Double.isNaN(xmxGb)) {
            context.addProperty("xmx_gb", round2(xmxGb));
        }
        out.add("context", context);

        boolean raise = VERDICT_HEAP_BOUND.equals(verdict) || VERDICT_GC_BOUND.equals(verdict);
        // Lifetime/uptime GC % is diluted on long-running servers — only raise gc_bound Issues
        // when we have a sustained (L1) window or an explicit live delta sample.
        if (raise && VERDICT_GC_BOUND.equals(verdict)) {
            String pauseSource = str(input, "pause_source");
            boolean sustained = bool(input, "sustained_gc_pause", false)
                    || bool(input, "sustained_heap_pressure", false);
            boolean liveDelta = "delta".equals(pauseSource);
            if (!sustained && !liveDelta) {
                raise = false;
            }
        }
        out.addProperty("raise_gc_pressure_issue", raise);
        return out;
    }

    /**
     * Build full {@code optional.jvm_health} from collector + advisor inputs.
     */
    public static JsonObject buildJvmHealth(JsonObject collectorSample, JsonObject advisorInput) {
        JsonObject flags = collectorSample.has("flags") && collectorSample.get("flags").isJsonObject()
                ? collectorSample.getAsJsonObject("flags") : new JsonObject();
        JsonObject heap = collectorSample.has("heap") && collectorSample.get("heap").isJsonObject()
                ? collectorSample.getAsJsonObject("heap") : new JsonObject();
        JsonObject gc = collectorSample.has("jvm_gc") && collectorSample.get("jvm_gc").isJsonObject()
                ? collectorSample.getAsJsonObject("jvm_gc") : new JsonObject();

        JsonObject input = advisorInput != null ? advisorInput.deepCopy() : new JsonObject();
        if (!input.has("flags_profile") && flags.has("flags_profile")) {
            input.add("flags_profile", flags.get("flags_profile"));
        }
        if (!input.has("xms_equals_xmx") && flags.has("xms_equals_xmx")) {
            input.add("xms_equals_xmx", flags.get("xms_equals_xmx"));
        }
        if (!input.has("large_heap_overrides_ok") && flags.has("large_heap_overrides_ok")) {
            input.add("large_heap_overrides_ok", flags.get("large_heap_overrides_ok"));
        }
        if (!input.has("xmx_gb") && flags.has("xmx_gb")) {
            input.add("xmx_gb", flags.get("xmx_gb"));
        }
        if (!input.has("java_major") && collectorSample.has("java_major")) {
            input.add("java_major", collectorSample.get("java_major"));
        }
        if (!input.has("heap_pressure_pct") && heap.has("pressure_pct")) {
            input.add("heap_pressure_pct", heap.get("pressure_pct"));
        }
        if (!input.has("gc_pause_pct_of_wall") && gc.has("pause_pct_of_wall")) {
            input.add("gc_pause_pct_of_wall", gc.get("pause_pct_of_wall"));
        }
        if (!input.has("pause_source") && gc.has("pause_source")) {
            input.add("pause_source", gc.get("pause_source"));
        }
        if (!input.has("missing_flags") && flags.has("missing_flags")) {
            input.add("missing_flags", flags.get("missing_flags").deepCopy());
        }
        if (!input.has("flags_coverage") && flags.has("flags_coverage")) {
            input.add("flags_coverage", flags.get("flags_coverage").deepCopy());
        }

        JsonObject advice = evaluate(input);

        JsonObject health = new JsonObject();
        if (collectorSample.has("java_version")) {
            health.addProperty("java_version", collectorSample.get("java_version").getAsString());
        }
        if (collectorSample.has("java_major")) {
            health.addProperty("java_major", collectorSample.get("java_major").getAsInt());
        }
        if (collectorSample.has("current_flags") && collectorSample.get("current_flags").isJsonPrimitive()) {
            health.addProperty("current_flags", collectorSample.get("current_flags").getAsString());
        }
        if (collectorSample.has("flags_source") && collectorSample.get("flags_source").isJsonPrimitive()) {
            health.addProperty("flags_source", collectorSample.get("flags_source").getAsString());
        }
        health.addProperty("flags_profile", str(flags, "flags_profile") != null
                ? str(flags, "flags_profile") : JvmFlagsClassifier.PROFILE_UNKNOWN);
        if (flags.has("flags_matched")) {
            health.add("flags_matched", flags.get("flags_matched").deepCopy());
        } else {
            health.add("flags_matched", new JsonArray());
        }
        if (flags.has("xmx_gb")) {
            health.add("xmx_gb", flags.get("xmx_gb"));
        }
        if (flags.has("xms_equals_xmx")) {
            health.add("xms_equals_xmx", flags.get("xms_equals_xmx"));
        }
        if (flags.has("large_heap_overrides_ok")) {
            health.add("large_heap_overrides_ok", flags.get("large_heap_overrides_ok"));
        }
        if (gc.has("pause_pct_of_wall")) {
            health.add("gc_pause_pct_of_wall", gc.get("pause_pct_of_wall"));
        }
        if (heap.has("pressure_pct")) {
            health.add("heap_pressure_pct", heap.get("pressure_pct"));
        }
        if (heap.has("used_mb")) {
            health.addProperty("heap_used_gb", round2(heap.get("used_mb").getAsDouble() / 1024.0));
        }
        if (heap.has("max_mb")) {
            health.addProperty("heap_max_gb", round2(heap.get("max_mb").getAsDouble() / 1024.0));
        }
        health.addProperty("verdict", advice.get("verdict").getAsString());
        health.addProperty("advice", advice.get("advice").getAsString());
        health.addProperty("recommend_action", advice.get("recommend_action").getAsString());
        health.addProperty("baseline_name", advice.get("baseline_name").getAsString());
        health.addProperty("baseline_variant", advice.get("baseline_variant").getAsString());
        if (advice.has("recommended_flags") && !advice.get("recommended_flags").isJsonNull()) {
            health.add("recommended_flags", advice.get("recommended_flags"));
        } else {
            health.add("recommended_flags", com.google.gson.JsonNull.INSTANCE);
        }
        if (advice.has("optional_zgc_flags") && !advice.get("optional_zgc_flags").isJsonNull()) {
            health.add("optional_zgc_flags", advice.get("optional_zgc_flags"));
        }
        if (advice.has("missing_flags")) {
            health.add("missing_flags", advice.get("missing_flags").deepCopy());
        } else {
            health.add("missing_flags", new JsonArray());
        }
        if (advice.has("missing_flags_paste")) {
            health.add("missing_flags_paste", advice.get("missing_flags_paste").deepCopy());
        } else if (flags.has("missing_flags_paste")) {
            health.add("missing_flags_paste", flags.get("missing_flags_paste").deepCopy());
        } else {
            health.add("missing_flags_paste", new JsonArray());
        }
        if (advice.has("flags_coverage")) {
            health.add("flags_coverage", advice.get("flags_coverage").deepCopy());
        } else if (flags.has("flags_coverage")) {
            health.add("flags_coverage", flags.get("flags_coverage").deepCopy());
        }
        if (advice.has("context")) {
            health.add("context", advice.get("context").deepCopy());
        }
        if (collectorSample.has("sampled_at")) {
            health.add("sampled_at", collectorSample.get("sampled_at"));
        }
        health.addProperty("raise_gc_pressure_issue",
                advice.get("raise_gc_pressure_issue").getAsBoolean());
        return health;
    }

    static final class Recommendation {
        final String action;
        final String recommendedFlags;
        final String optionalZgcFlags;
        final JsonArray missingFlags;
        final boolean exposeMissing;

        Recommendation(
                String action,
                String recommendedFlags,
                String optionalZgcFlags,
                JsonArray missingFlags,
                boolean exposeMissing) {
            this.action = action;
            this.recommendedFlags = recommendedFlags;
            this.optionalZgcFlags = optionalZgcFlags;
            this.missingFlags = missingFlags != null ? missingFlags : new JsonArray();
            this.exposeMissing = exposeMissing;
        }
    }

    /**
     * Research §6 matrix: always pick a recommend_action; paste baseline when adopt/complete/large.
     */
    static Recommendation resolveRecommendation(
            String verdict,
            String profile,
            int javaMajor,
            String mcVersion,
            double xmxGb,
            boolean xmsEq,
            boolean largeOk,
            double gcPausePct,
            int cpuCount,
            JsonArray missingFlagsIn) {
        JsonArray missing = missingFlagsIn != null ? missingFlagsIn.deepCopy() : new JsonArray();
        String javaTip = javaVersionAdvice(javaMajor, mcVersion);
        if (javaTip != null && javaTip.startsWith("Install")) {
            return new Recommendation(ACTION_FIX_JAVA_FIRST, null, null, new JsonArray(), false);
        }

        String aikar = aikarsSnippetForHeapGb(xmxGb);
        boolean advanced = isAdvancedNeutral(profile);
        // Markers alone shouldn't force complete when profile is already aikars + large OK.
        boolean materialGaps = hasMaterialMissingFlags(missing);

        String optionalZgc = null;
        if (VERDICT_GC_BOUND.equals(verdict)
                && javaMajor >= 21
                && !Double.isNaN(xmxGb) && xmxGb >= 16
                && (JvmFlagsClassifier.PROFILE_AIKARS.equals(profile)
                || JvmFlagsClassifier.PROFILE_G1_BASIC.equals(profile)
                || JvmFlagsClassifier.PROFILE_G1_BRUCE.equals(profile)
                || JvmFlagsClassifier.PROFILE_DEFAULT.equals(profile))
                && (cpuCount <= 0 || cpuCount >= 8)) {
            double n = Math.max(1, Math.round(xmxGb));
            optionalZgc = String.format(java.util.Locale.US,
                    "-Xms%.0fG -Xmx%.0fG -XX:+UseZGC -XX:+ZGenerational", n, n);
        }

        if (advanced) {
            // Never overwrite healthy advanced sets with Aikar paste.
            if (optionalZgc != null && VERDICT_GC_BOUND.equals(verdict)
                    && JvmFlagsClassifier.PROFILE_G1_BRUCE.equals(profile)) {
                return new Recommendation(ACTION_OPTIONAL_ZGC, null, optionalZgc, new JsonArray(), false);
            }
            return new Recommendation(ACTION_KEEP_ADVANCED, null, null, new JsonArray(), false);
        }

        if (JvmFlagsClassifier.PROFILE_AIKARS.equals(profile) && !largeOk) {
            return new Recommendation(ACTION_APPLY_LARGE_OVERRIDES, aikar, optionalZgc, missing, true);
        }

        if (JvmFlagsClassifier.PROFILE_DEFAULT.equals(profile)
                || JvmFlagsClassifier.PROFILE_UNKNOWN.equals(profile)) {
            return new Recommendation(ACTION_ADOPT_BASELINE, aikar, optionalZgc, missing, true);
        }

        if (JvmFlagsClassifier.PROFILE_G1_BASIC.equals(profile) || materialGaps) {
            return new Recommendation(ACTION_COMPLETE_BASELINE, aikar, optionalZgc, missing, true);
        }

        if (JvmFlagsClassifier.PROFILE_AIKARS.equals(profile) && largeOk) {
            if (!xmsEq) {
                if (!containsMissing(missing, "Xms=Xmx")) {
                    missing.add("Xms=Xmx");
                }
                return new Recommendation(ACTION_COMPLETE_BASELINE, aikar, optionalZgc, missing, true);
            }
            if (optionalZgc != null) {
                return new Recommendation(ACTION_OPTIONAL_ZGC, null, optionalZgc, new JsonArray(), false);
            }
            return new Recommendation(ACTION_KEEP, null, null, new JsonArray(), false);
        }

        // Fallback: treat as adopt baseline.
        return new Recommendation(ACTION_ADOPT_BASELINE, aikar, optionalZgc, missing, true);
    }

    private static boolean containsMissing(JsonArray missing, String key) {
        for (int i = 0; i < missing.size(); i++) {
            if (key.equals(missing.get(i).getAsString())) {
                return true;
            }
        }
        return false;
    }

    /** Ignore soft aikars.marker-only gaps when deciding whether to force complete. */
    private static boolean hasMaterialMissingFlags(JsonArray missing) {
        for (int i = 0; i < missing.size(); i++) {
            String m = missing.get(i).getAsString();
            if (!"aikars.marker".equals(m)) {
                return true;
            }
        }
        return false;
    }

    static String resolveVerdict(
            double heapPressure,
            double gcPausePct,
            double mspt,
            boolean tickLag,
            boolean sustainedPressure) {
        boolean heapBound = (!Double.isNaN(heapPressure) && heapPressure >= HEAP_BOUND_PCT)
                || (sustainedPressure && !Double.isNaN(heapPressure) && heapPressure >= HEAP_SOFT_PCT);
        if (heapBound) {
            return VERDICT_HEAP_BOUND;
        }
        if (!Double.isNaN(gcPausePct) && gcPausePct >= GC_BOUND_PAUSE_PCT
                && (Double.isNaN(heapPressure) || heapPressure < HEAP_SOFT_PCT)) {
            return VERDICT_GC_BOUND;
        }
        boolean msptHigh = !Double.isNaN(mspt) && mspt >= MSPT_HIGH;
        if ((msptHigh || tickLag)
                && (Double.isNaN(heapPressure) || heapPressure < SINGLE_THREAD_HEAP_MAX)
                && (Double.isNaN(gcPausePct) || gcPausePct < SINGLE_THREAD_PAUSE_MAX)) {
            return VERDICT_SINGLE_THREAD;
        }
        return VERDICT_HEALTHY;
    }

    static String buildAdvice(
            String verdict,
            String profile,
            int javaMajor,
            String mcVersion,
            String loader,
            double xmxGb,
            boolean xmsEq,
            boolean largeOk,
            double heapPressure,
            double gcPausePct,
            int cpuCount,
            Recommendation reco) {
        String javaTip = javaVersionAdvice(javaMajor, mcVersion);
        if (javaTip != null && ACTION_FIX_JAVA_FIRST.equals(reco.action)) {
            return javaTip;
        }

        String contextLead = contextLead(javaMajor, mcVersion, loader, xmxGb);
        String gapsProse = missingFlagsProse(reco.exposeMissing ? reco.missingFlags : new JsonArray());

        String core = switch (verdict) {
            case VERDICT_HEAP_BOUND ->
                    "Java’s memory limit is nearly full ("
                            + fmt(heapPressure)
                            + "% used). Give the server a higher -Xmx, or look for a memory leak. "
                            + "Tweaking GC flags alone will not help when memory is already maxed out.";
            case VERDICT_GC_BOUND -> gcBoundAdvice(profile, xmxGb, largeOk, gcPausePct, javaMajor, cpuCount);
            case VERDICT_SINGLE_THREAD ->
                    "Memory looks fine right now — Java is not struggling to clean up "
                            + "(about " + fmt(heapPressure) + "% full, cleanup busy ~"
                            + fmt(gcPausePct) + "% of the time). "
                            + "Lag is more likely from mods or world work on the main game thread. "
                            + "Profile with Spark; buying more RAM will not fix this.";
            default -> healthyAdvice(profile, xmxGb, xmsEq, largeOk, javaMajor, mcVersion);
        };

        String actionTail = switch (reco.action) {
            case ACTION_ADOPT_BASELINE ->
                    " Watchtower’s best starting setup for this server is the Aikar / flags.sh G1 set below"
                            + (contextLead.isEmpty() ? "." : " (" + contextLead + ").");
            case ACTION_COMPLETE_BASELINE ->
                    " Watchtower recommends completing the Aikar / flags.sh G1 set"
                            + (gapsProse.isEmpty() ? "." : (" — worth adding: " + gapsProse + "."));
            case ACTION_APPLY_LARGE_OVERRIDES ->
                    " This heap is 12G+ but still uses small-server Aikar values — apply the large-heap set below.";
            case ACTION_KEEP ->
                    " You are already on Watchtower’s recommended Aikar / flags.sh setup"
                            + (contextLead.isEmpty() ? "." : " for " + contextLead + ".");
            case ACTION_KEEP_ADVANCED ->
                    " Keep your current advanced/custom setup if the server feels smooth"
                            + " — Watchtower will not replace it with the Temurin Aikar default.";
            case ACTION_OPTIONAL_ZGC ->
                    " On this large heap with busy cleanup, Generational ZGC is an optional next step"
                            + " after measuring with Spark — not a must-switch.";
            case ACTION_FIX_JAVA_FIRST -> "";
            default -> "";
        };

        if (ACTION_KEEP.equals(reco.action) || ACTION_KEEP_ADVANCED.equals(reco.action)
                || ACTION_OPTIONAL_ZGC.equals(reco.action)) {
            return core + actionTail;
        }
        if (ACTION_ADOPT_BASELINE.equals(reco.action) || ACTION_COMPLETE_BASELINE.equals(reco.action)
                || ACTION_APPLY_LARGE_OVERRIDES.equals(reco.action)) {
            if (VERDICT_HEAP_BOUND.equals(verdict)) {
                return core
                        + " After you free memory headroom, the Aikar / flags.sh set below is still the right baseline"
                        + (contextLead.isEmpty() ? "." : " for " + contextLead + ".");
            }
            // gcBoundAdvice already points at the recommended set — avoid repeating the action tail.
            if (VERDICT_GC_BOUND.equals(verdict)) {
                if (!gapsProse.isEmpty()) {
                    return core + " Worth adding: " + gapsProse + ".";
                }
                return core;
            }
            if (VERDICT_HEALTHY.equals(verdict) && ACTION_ADOPT_BASELINE.equals(reco.action)) {
                return "You are on plain default Java settings. "
                        + "Watchtower’s best starting setup for this server is the Aikar / flags.sh G1 set below"
                        + (contextLead.isEmpty() ? "." : " (" + contextLead + ").")
                        + (gapsProse.isEmpty() ? "" : " Missing from your launch args: " + gapsProse + ".");
            }
            if (VERDICT_HEALTHY.equals(verdict) && ACTION_COMPLETE_BASELINE.equals(reco.action)) {
                return "G1 is on, but the recommended Aikar / flags.sh tuning is incomplete"
                        + (contextLead.isEmpty() ? "." : " for " + contextLead + ".")
                        + (gapsProse.isEmpty() ? "" : " Worth adding: " + gapsProse + ".")
                        + " Use the full set below on the next restart.";
            }
            if (VERDICT_HEALTHY.equals(verdict) && ACTION_APPLY_LARGE_OVERRIDES.equals(reco.action)) {
                return "Aikar-style flags are present, but this 12G+ server still uses small-server region settings. "
                        + "Apply the large-heap set below on the next restart.";
            }
            return core + actionTail;
        }
        return core + actionTail;
    }

    private static String contextLead(int javaMajor, String mcVersion, String loader, double xmxGb) {
        List<String> parts = new ArrayList<>();
        if (loader != null && !loader.isBlank()) {
            parts.add(prettyLoader(loader));
        }
        if (mcVersion != null && !mcVersion.isBlank()) {
            parts.add("Minecraft " + mcVersion.trim());
        }
        if (javaMajor >= 0) {
            parts.add("Java " + javaMajor);
        }
        if (!Double.isNaN(xmxGb) && xmxGb > 0) {
            parts.add(Math.round(xmxGb) + "G memory");
        }
        return String.join(", ", parts);
    }

    private static String prettyLoader(String loader) {
        String l = loader.trim().toLowerCase(java.util.Locale.ROOT);
        return switch (l) {
            case "neoforge" -> "NeoForge";
            case "forge" -> "Forge";
            case "fabric" -> "Fabric";
            case "paper", "purpur", "pufferfish" -> "Paper-family";
            default -> loader.trim();
        };
    }

    private static String missingFlagsProse(JsonArray missing) {
        if (missing == null || missing.size() == 0) {
            return "";
        }
        List<String> shown = new ArrayList<>();
        for (int i = 0; i < missing.size() && shown.size() < 3; i++) {
            String m = missing.get(i).getAsString();
            if ("aikars.marker".equals(m)) {
                continue;
            }
            shown.add(m);
        }
        if (shown.isEmpty()) {
            return "";
        }
        if (shown.size() == 1) {
            return shown.get(0);
        }
        if (shown.size() == 2) {
            return shown.get(0) + " and " + shown.get(1);
        }
        return shown.get(0) + ", " + shown.get(1) + ", and " + shown.get(2);
    }

    private static String gcBoundAdvice(
            String profile, double xmxGb, boolean largeOk, double gcPausePct, int javaMajor, int cpuCount) {
        String base = "Java is spending about "
                + fmt(gcPausePct)
                + "% of its time cleaning up memory, but the memory limit itself is not full. "
                + "Buying more RAM usually will not help — fix the launch flags first. ";
        if (JvmFlagsClassifier.PROFILE_DEFAULT.equals(profile)
                || JvmFlagsClassifier.PROFILE_G1_BASIC.equals(profile)) {
            return base + "Use the recommended Aikar / flags.sh G1 set below "
                    + "(same start and max memory, 200ms cleanup goal)"
                    + (!largeOk && !Double.isNaN(xmxGb) && xmxGb >= 12
                    ? " with the large-server (12G+) extras." : ".")
                    + " Optional check: /spark gcmonitor.";
        }
        if (JvmFlagsClassifier.PROFILE_AIKARS.equals(profile) && !largeOk) {
            return base + "This server has a large memory limit (12G+) but still uses the small-server "
                    + "Aikar settings. Switch to the 12G+ recommended set on the next restart "
                    + "(bigger regions, higher young-gen %).";
        }
        if (isAdvancedNeutral(profile)) {
            return base + "You are already on advanced/custom Java flags — Watchtower will not replace them. "
                    + "Check /spark gcmonitor, and only change the collector after measuring.";
        }
        if (javaMajor >= 21 && !Double.isNaN(xmxGb) && xmxGb >= 16
                && (JvmFlagsClassifier.PROFILE_AIKARS.equals(profile)
                || JvmFlagsClassifier.PROFILE_G1_BASIC.equals(profile)
                || JvmFlagsClassifier.PROFILE_G1_BRUCE.equals(profile))) {
            String cores = cpuCount > 0 && cpuCount < 8
                    ? " Skip ZGC if you have fewer than about 8 CPU cores."
                    : " Some large hosts use ZGC at 32G+ with many cores (MeowIce); measure before switching.";
            return base + "On Java 21 with a large memory limit you can try Generational ZGC "
                    + "(-XX:+UseZGC -XX:+ZGenerational) with matching start/max memory." + cores;
        }
        return base + "Optional check before changing collectors: /spark gcmonitor.";
    }

    private static String healthyAdvice(
            String profile, double xmxGb, boolean xmsEq, boolean largeOk, int javaMajor, String mcVersion) {
        String javaTip = javaVersionAdvice(javaMajor, mcVersion);
        if (javaTip != null) {
            return javaTip;
        }
        if (!xmsEq) {
            return "Set start memory (-Xms) equal to max memory (-Xmx) on a dedicated server. "
                    + "Memory and cleanup look otherwise fine.";
        }
        if (JvmFlagsClassifier.PROFILE_DEFAULT.equals(profile)) {
            return "You are on plain default Java settings. Consider the recommended Aikar / flags.sh set "
                    + "on Java 21 (matching start/max memory, 200ms cleanup goal). "
                    + "Memory and cleanup look fine right now.";
        }
        if (JvmFlagsClassifier.PROFILE_G1_BASIC.equals(profile)) {
            return "Basic G1 cleanup is on, but the full Aikar / flags.sh tuning is incomplete. "
                    + "Use the recommended set on the next restart for smoother memory cleanup.";
        }
        if (JvmFlagsClassifier.PROFILE_AIKARS.equals(profile) && !largeOk) {
            return "Aikar-style flags are present, but this 12G+ server still uses small-server region settings. "
                    + "Apply the 12G+ recommended set on the next restart.";
        }
        if (JvmFlagsClassifier.PROFILE_AIKARS.equals(profile)) {
            return "Launch flags look good (Aikar / flags.sh). If the server still lags, it is likely "
                    + "mods or world work — not memory cleanup.";
        }
        if (JvmFlagsClassifier.PROFILE_G1_BRUCE.equals(profile)) {
            return "Advanced G1 settings (Bruce-style) detected. Keep them if the server feels smooth — "
                    + "Watchtower will not force the default 200ms Aikar pause goal.";
        }
        if (JvmFlagsClassifier.PROFILE_G1_MEOWICE.equals(profile)) {
            return "MeowIce-style G1 settings detected. Keep them if the server feels smooth. "
                    + "Watchtower’s default recommendation for Temurin Java 21 remains Aikar / flags.sh.";
        }
        if (JvmFlagsClassifier.PROFILE_ZGC.equals(profile)
                || JvmFlagsClassifier.PROFILE_ZGC_MEOWICE.equals(profile)) {
            return "Low-pause ZGC is in use. If TPS feels fine, keep it. "
                    + "Do not switch back to G1 without measuring.";
        }
        if (JvmFlagsClassifier.PROFILE_SHENANDOAH.equals(profile)) {
            return "Shenandoah cleanup is in use. Many Minecraft hosts prefer G1 or ZGC — "
                    + "keep Shenandoah only if measured cleanup stays healthy.";
        }
        if (JvmFlagsClassifier.PROFILE_GRAAL_G1.equals(profile)) {
            return "Graal with G1 detected. Keep it if the server feels smooth; "
                    + "measure carefully before changing collectors.";
        }
        if (JvmFlagsClassifier.PROFILE_OPENJ9.equals(profile)) {
            return "OpenJ9 detected — it uses a different memory system. "
                    + "Do not paste HotSpot Aikar flags into it blindly.";
        }
        if (JvmFlagsClassifier.PROFILE_CUSTOM.equals(profile)) {
            return "Custom Java flags detected — Watchtower will not replace them. "
                    + "Use Spark’s GC tools if you notice stuttering from memory cleanup.";
        }
        return "Memory and cleanup look fine — lag is more likely from mods or world work, not RAM.";
    }

    public static String aikarsSnippet(boolean largeHeap) {
        String base = "-XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200 "
                + "-XX:+UnlockExperimentalVMOptions -XX:+DisableExplicitGC -XX:+AlwaysPreTouch ";
        String sized = largeHeap
                ? "-XX:G1NewSizePercent=40 -XX:G1MaxNewSizePercent=50 -XX:G1HeapRegionSize=16M "
                + "-XX:G1ReservePercent=15 -XX:InitiatingHeapOccupancyPercent=20 "
                : "-XX:G1NewSizePercent=30 -XX:G1MaxNewSizePercent=40 -XX:G1HeapRegionSize=8M "
                + "-XX:G1ReservePercent=20 -XX:InitiatingHeapOccupancyPercent=15 ";
        String rest = "-XX:G1HeapWastePercent=5 -XX:G1MixedGCCountTarget=4 "
                + "-XX:G1MixedGCLiveThresholdPercent=90 -XX:G1RSetUpdatingPauseTimePercent=5 "
                + "-XX:SurvivorRatio=32 -XX:+PerfDisableSharedMem -XX:MaxTenuringThreshold=1 "
                + "-Dusing.aikars.flags=https://mcflags.emc.gs -Daikars.new.flags=true";
        long n = largeHeap ? 12 : 8;
        return "-Xms" + n + "G -Xmx" + n + "G " + base + sized + rest;
    }

    /** Replace placeholder heap size in snippet for a concrete Xmx. */
    public static String aikarsSnippetForHeapGb(double xmxGb) {
        boolean large = !Double.isNaN(xmxGb) && xmxGb >= 12;
        long n = !Double.isNaN(xmxGb) && xmxGb > 0 ? Math.max(1, Math.round(xmxGb)) : (large ? 12 : 8);
        String base = "-XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200 "
                + "-XX:+UnlockExperimentalVMOptions -XX:+DisableExplicitGC -XX:+AlwaysPreTouch ";
        String sized = large
                ? "-XX:G1NewSizePercent=40 -XX:G1MaxNewSizePercent=50 -XX:G1HeapRegionSize=16M "
                + "-XX:G1ReservePercent=15 -XX:InitiatingHeapOccupancyPercent=20 "
                : "-XX:G1NewSizePercent=30 -XX:G1MaxNewSizePercent=40 -XX:G1HeapRegionSize=8M "
                + "-XX:G1ReservePercent=20 -XX:InitiatingHeapOccupancyPercent=15 ";
        String rest = "-XX:G1HeapWastePercent=5 -XX:G1MixedGCCountTarget=4 "
                + "-XX:G1MixedGCLiveThresholdPercent=90 -XX:G1RSetUpdatingPauseTimePercent=5 "
                + "-XX:SurvivorRatio=32 -XX:+PerfDisableSharedMem -XX:MaxTenuringThreshold=1 "
                + "-Dusing.aikars.flags=https://mcflags.emc.gs -Daikars.new.flags=true";
        return "-Xms" + n + "G -Xmx" + n + "G " + base + sized + rest;
    }

    private static boolean isAdvancedNeutral(String profile) {
        return JvmFlagsClassifier.PROFILE_CUSTOM.equals(profile)
                || JvmFlagsClassifier.PROFILE_ZGC.equals(profile)
                || JvmFlagsClassifier.PROFILE_ZGC_MEOWICE.equals(profile)
                || JvmFlagsClassifier.PROFILE_G1_BRUCE.equals(profile)
                || JvmFlagsClassifier.PROFILE_G1_MEOWICE.equals(profile)
                || JvmFlagsClassifier.PROFILE_GRAAL_G1.equals(profile)
                || JvmFlagsClassifier.PROFILE_OPENJ9.equals(profile)
                || JvmFlagsClassifier.PROFILE_SHENANDOAH.equals(profile);
    }

    private static String javaVersionAdvice(int javaMajor, String mcVersion) {
        if (javaMajor < 0) {
            return null;
        }
        boolean modernMc = mcVersion == null || mcVersion.isBlank() || mcAtLeast(mcVersion, 1, 20, 5);
        if (modernMc && javaMajor < 21) {
            return "Install Java 21 before changing launch flags "
                    + "(Minecraft 1.20.5+ / current NeoForge need it).";
        }
        if (mcVersion != null && !mcVersion.isBlank() && mcInRange171204(mcVersion) && javaMajor < 17) {
            return "Install Java 17 or newer before changing launch flags for this Minecraft version.";
        }
        return null;
    }

    private static boolean mcAtLeast(String mc, int maj, int min, int patch) {
        int[] p = parseMc(mc);
        if (p == null) {
            return true;
        }
        if (p[0] != maj) {
            return p[0] > maj;
        }
        if (p[1] != min) {
            return p[1] > min;
        }
        return p[2] >= patch;
    }

    private static boolean mcInRange171204(String mc) {
        int[] p = parseMc(mc);
        if (p == null) {
            return false;
        }
        // 1.17 – 1.20.4
        if (p[0] != 1) {
            return false;
        }
        if (p[1] < 17) {
            return false;
        }
        if (p[1] > 20) {
            return false;
        }
        return p[1] < 20 || p[2] <= 4;
    }

    private static int[] parseMc(String mc) {
        try {
            String s = mc.trim();
            if (s.startsWith("Minecraft ")) {
                s = s.substring(10).trim();
            }
            String[] parts = s.split("[^0-9]+");
            int a = parts.length > 0 ? Integer.parseInt(parts[0]) : 0;
            int b = parts.length > 1 ? Integer.parseInt(parts[1]) : 0;
            int c = parts.length > 2 ? Integer.parseInt(parts[2]) : 0;
            return new int[]{a, b, c};
        } catch (Exception e) {
            return null;
        }
    }

    private static String fmt(double v) {
        if (Double.isNaN(v)) {
            return "?";
        }
        return String.format(java.util.Locale.US, "%.0f", v);
    }

    private static double dbl(JsonObject o, String key, double def) {
        if (o == null || !o.has(key) || o.get(key).isJsonNull()) {
            return def;
        }
        try {
            return o.get(key).getAsDouble();
        } catch (Exception e) {
            return def;
        }
    }

    private static boolean bool(JsonObject o, String key, boolean def) {
        if (o == null || !o.has(key) || o.get(key).isJsonNull()) {
            return def;
        }
        try {
            return o.get(key).getAsBoolean();
        } catch (Exception e) {
            return def;
        }
    }

    private static String str(JsonObject o, String key) {
        if (o == null || !o.has(key) || o.get(key).isJsonNull()) {
            return null;
        }
        try {
            return o.get(key).getAsString();
        } catch (Exception e) {
            return null;
        }
    }

    private static double round2(double v) {
        return Math.round(v * 100.0) / 100.0;
    }
}
