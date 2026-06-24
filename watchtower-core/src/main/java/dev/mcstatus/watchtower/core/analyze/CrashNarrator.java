package dev.mcstatus.watchtower.core.analyze;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Plain-English crash narratives from parsed crash report fields.
 */
public final class CrashNarrator {

    public record Narrative(
            String plainEnglish,
            String likelyCause,
            String confidence,
            JsonArray fixHints,
            boolean manualReview) {
    }

    private CrashNarrator() {
    }

    public static Narrative narrate(JsonObject crash, JsonArray mods) {
        String exception = str(crash, "exception");
        String root = str(crash, "root_exception");
        String causedBy = str(crash, "caused_by");
        String modFile = str(crash, "mod_file");
        String summary = str(crash, "summary");
        String failure = str(crash, "failure_message");
        String description = str(crash, "description");
        String file = str(crash, "file");
        String time = str(crash, "time");
        Integer watchdogMs = crash.has("watchdog_tick_ms") && !crash.get("watchdog_tick_ms").isJsonNull()
                ? crash.get("watchdog_tick_ms").getAsInt() : null;

        String combined = ((exception != null ? exception : "") + " "
                + (modFile != null ? modFile : "") + " "
                + (summary != null ? summary : "") + " "
                + (failure != null ? failure : "") + " "
                + (description != null ? description : "")).toLowerCase(Locale.ROOT);

        CrashClassifier.Classification classification = CrashClassifier.classify(crash);
        String suspect = classification.suspectModId();
        if (suspect == null && modFile != null && !modFile.isBlank()) {
            suspect = modFile.replace(".jar", "").split("-")[0].toLowerCase(Locale.ROOT);
        }

        if (isWatchdog(combined, exception, root)) {
            int ms = watchdogMs != null ? watchdogMs : 60000;
            int sec = Math.max(1, ms / 1000);
            return new Narrative(
                    "The main server thread stopped responding for ~" + sec + "s (tick watchdog). "
                            + "Usually lag from world gen, pregen, or a heavy contraption — not necessarily a broken mod.",
                    "Server hung",
                    "high",
                    hintsWatchdog(),
                    false);
        }

        if (isOom(combined)) {
            return new Narrative(
                    "Java ran out of heap memory during play.",
                    "Out of memory",
                    "high",
                    hintsOom(),
                    false);
        }

        if (isModLoad(combined, failure, exception)) {
            String modLabel = suspect != null ? suspect : "a mod";
            return new Narrative(
                    "NeoForge failed while loading " + modLabel + " — often a version mismatch or missing dependency.",
                    "Mod failed to load",
                    suspect != null ? "high" : "medium",
                    hintsModLoad(suspect, failure),
                    false);
        }

        if ("mod".equals(classification.category()) && suspect != null) {
            return new Narrative(
                    "The crash points to mod " + suspect + " — check for updates, corrupt jars, or mixin conflicts.",
                    "Mod crash",
                    "medium",
                    classification.fixHints(),
                    false);
        }

        if ("host_resource".equals(classification.category())) {
            return new Narrative(
                    "A host or JVM resource limit was hit — review CPU, RAM, and disk around the crash time.",
                    "Host resource limit",
                    "medium",
                    classification.fixHints(),
                    false);
        }

        if ("loader".equals(classification.category())) {
            return new Narrative(
                    "NeoForge or the mod loader failed during bootstrap — often incompatible or corrupt mod jars.",
                    "Loader bootstrap failure",
                    "medium",
                    classification.fixHints(),
                    false);
        }

        String known = firstNonBlank(description, failure, causedBy, exception, summary);
        StringBuilder plain = new StringBuilder("We could not determine a specific cause");
        if (file != null && !file.isBlank()) {
            plain.append(" for crash report ").append(file);
        }
        if (time != null && !time.isBlank()) {
            plain.append(" (").append(time).append(")");
        }
        plain.append(".");
        if (known != null && !known.isBlank()) {
            plain.append(" The report mentions: ").append(truncate(known, 160)).append(".");
        }

        return new Narrative(
                plain.toString(),
                "Unknown",
                "low",
                hintsManualReview(),
                true);
    }

    public static void enrichSummary(JsonObject row, Narrative narrative) {
        row.addProperty("plain_english", narrative.plainEnglish());
        row.addProperty("likely_cause", narrative.likelyCause());
        row.addProperty("confidence", narrative.confidence());
        row.addProperty("manual_review", narrative.manualReview());
        row.add("fix_hints", narrative.fixHints());
    }

    private static boolean isWatchdog(String combined, String exception, String root) {
        return combined.contains("serverhangwatchdog")
                || (exception != null && exception.contains("ServerHangWatchdog"))
                || (root != null && root.contains("ServerHangWatchdog"));
    }

    private static boolean isOom(String combined) {
        return combined.contains("outofmemoryerror") || combined.contains("java heap space")
                || combined.contains("gc overhead limit");
    }

    private static boolean isModLoad(String combined, String failure, String exception) {
        return combined.contains("mod loading has failed")
                || combined.contains("modloadingcrash")
                || combined.contains("modloadingexception")
                || (failure != null && !failure.isBlank())
                || (exception != null && exception.contains("ModLoading"));
    }

    private static JsonArray hintsWatchdog() {
        return toArray(List.of(
                "Check for heavy world gen, Chunky/DH pregen, or laggy contraptions before the hang.",
                "Review Spark or a tick profiler; reduce simulation distance if MSPT was high.",
                "If this repeats with no players online, look for chunk loaders or rogue entities."));
    }

    private static JsonArray hintsOom() {
        return toArray(List.of(
                "Increase Java heap (-Xmx) if headroom is low.",
                "Look for duplicate mods, memory leaks, or oversized pregen jobs.",
                "Run Spark heap analysis if OOM repeats under normal load."));
    }

    private static JsonArray hintsModLoad(String suspect, String failure) {
        List<String> hints = new ArrayList<>();
        if (suspect != null) {
            hints.add("Update or reinstall " + suspect + " from the official source.");
            hints.add("Check latest.log for missing dependencies for " + suspect + ".");
        } else {
            hints.add("Open latest.log and find which mod failed to load.");
        }
        if (failure != null && failure.toLowerCase(Locale.ROOT).contains("dependency")) {
            hints.add("Install or update the dependency mod cited in the failure message.");
        }
        hints.add("Remove recently added mods one at a time until the server starts.");
        return toArray(hints);
    }

    private static JsonArray hintsManualReview() {
        return toArray(List.of(
                "Open the full crash report under crash-reports/ and read the root exception.",
                "Search the mod id or exception online or in your pack issue tracker.",
                "Mark reviewed after you confirm the crash is resolved or historical."));
    }

    private static JsonArray toArray(List<String> hints) {
        JsonArray arr = new JsonArray();
        hints.forEach(arr::add);
        return arr;
    }

    private static String firstNonBlank(String... values) {
        for (String v : values) {
            if (v != null && !v.isBlank()) {
                return v;
            }
        }
        return null;
    }

    private static String truncate(String s, int max) {
        return s.length() > max ? s.substring(0, max) + "…" : s;
    }

    private static String str(JsonObject o, String key) {
        if (o == null || !o.has(key) || o.get(key).isJsonNull()) {
            return null;
        }
        return o.get(key).getAsString();
    }
}
