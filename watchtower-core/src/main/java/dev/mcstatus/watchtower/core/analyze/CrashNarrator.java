package dev.mcstatus.watchtower.core.analyze;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.collect.MixinConfigIndex;

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
        return narrate(crash, mods, CrashClassifier.ClassifyContext.empty());
    }

    public static Narrative narrate(JsonObject crash, JsonArray mods, CrashClassifier.ClassifyContext ctx) {
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

        CrashClassifier.ClassifyContext classifyCtx = ctx;
        if (classifyCtx == null || classifyCtx.mixinIndex() == null) {
            MixinConfigIndex index = MixinConfigIndex.fromMods(mods);
            classifyCtx = new CrashClassifier.ClassifyContext(
                    mods,
                    index,
                    classifyCtx != null && classifyCtx.bootFailed(),
                    classifyCtx != null ? classifyCtx.classIndex() : null);
        }
        CrashClassifier.Classification classification = CrashClassifier.classify(crash, classifyCtx);
        String suspect = classification.suspectModId();
        if (suspect == null) {
            suspect = classification.primaryModId();
        }
        if (suspect == null && modFile != null && !modFile.isBlank()) {
            suspect = CrashClassifier.sanitizeModId(modFile);
        }
        String failureKind = classification.failureKind();
        String rowFailureKind = str(crash, "failure_kind");
        if (CrashClassifier.FK_WATCHDOG_FOLLOWUP.equals(rowFailureKind)) {
            failureKind = rowFailureKind;
        }
        String stallMod = classification.stallModId();

        if (CrashClassifier.FK_MOD_LOAD_MIXIN.equals(failureKind)) {
            String config = classification.details() != null && classification.details().has("mixin_config")
                    ? classification.details().get("mixin_config").getAsString() : null;
            String plain;
            if (suspect != null && config != null) {
                plain = "Mixin config " + config + " failed while loading mod " + suspect
                        + " — update or remove that mod.";
            } else if (config != null) {
                plain = "Mixin config " + config + " failed to load — identify the owning mod and update or remove it.";
            } else {
                plain = "A mixin config failed to initialise during mod loading.";
            }
            return new Narrative(
                    plain,
                    "Mixin load failure",
                    suspect != null ? "high" : "medium",
                    classification.fixHints(),
                    false);
        }

        if (CrashClassifier.FK_MOD_LOAD_MIXIN_CONFLICT.equals(failureKind)) {
            String conflict = classification.details() != null
                    && classification.details().has("conflict_mod_id")
                    ? classification.details().get("conflict_mod_id").getAsString() : null;
            String plain = conflict != null && suspect != null
                    ? "Mixin conflict between " + suspect + " and " + conflict + " — update both mods."
                    : "Two mods' mixins conflict during apply — update or remove one of them.";
            return new Narrative(plain, "Mixin conflict", "high", classification.fixHints(), false);
        }

        if (CrashClassifier.FK_MOD_LOAD_CONFIG.equals(failureKind)) {
            return new Narrative(
                    "A mod SERVER config (.toml) failed to parse — delete or repair the corrupt config file.",
                    "Corrupt server config",
                    "high",
                    classification.fixHints(),
                    false);
        }

        if (CrashClassifier.FK_MOD_LOAD_ASSET.equals(failureKind)) {
            String loc = classification.details() != null && classification.details().has("invalid_location")
                    ? classification.details().get("invalid_location").getAsString() : "a resource path";
            return new Narrative(
                    "Invalid resource location " + loc + " — fix illegal characters in the datapack or mod asset.",
                    "Invalid asset path",
                    "high",
                    classification.fixHints(),
                    false);
        }

        if (CrashClassifier.FK_MOD_LOAD_DUPLICATE.equals(failureKind)) {
            return new Narrative(
                    "Duplicate mod jars blocked boot — remove the duplicate from mods/.",
                    "Duplicate mods",
                    "high",
                    classification.fixHints(),
                    false);
        }

        if (CrashClassifier.FK_MOD_LOAD_WORLDGEN.equals(failureKind)) {
            return new Narrative(
                    "Worldgen feature order cycle — remove or update conflicting biome/terrain mods.",
                    "Worldgen feature cycle",
                    "high",
                    classification.fixHints(),
                    false);
        }

        if (CrashClassifier.FK_MOD_LOAD_COMPAT.equals(failureKind)) {
            return new Narrative(
                    "FerriteCore neighbor-table access failed — set populateNeighborTable to false temporarily.",
                    "FerriteCore compat",
                    "high",
                    classification.fixHints(),
                    false);
        }

        if (CrashClassifier.FK_MOD_LOAD_ECOSYSTEM.equals(failureKind)) {
            String mod = suspect != null ? suspect : "Create ecosystem";
            return new Narrative(
                    "Ecosystem mismatch for " + mod + " — align Create/Railways/addon versions or update the gated mod.",
                    "Mod ecosystem mismatch",
                    "high",
                    classification.fixHints(),
                    false);
        }

        if (CrashClassifier.FK_MOD_LOAD_SCRIPT.equals(failureKind)) {
            return new Narrative(
                    "KubeJS datapack failed to parse — fix or remove the broken script under kubejs/data.",
                    "KubeJS script error",
                    "high",
                    classification.fixHints(),
                    false);
        }

        if (CrashClassifier.FK_MOD_LOAD_DEPENDENCY.equals(failureKind)) {
            String modLabel = suspect != null ? suspect : "a mod";
            return new Narrative(
                    "NeoForge failed while loading " + modLabel
                            + " — often a version mismatch or missing language provider / dependency.",
                    "Mod failed to load",
                    suspect != null ? "high" : "medium",
                    classification.fixHints().size() > 0
                            ? classification.fixHints()
                            : hintsModLoad(suspect, failure),
                    false);
        }

        if (CrashClassifier.FK_PLATFORM_MISMATCH.equals(failureKind)) {
            return new Narrative(
                    "A mod requires a newer Java version than this server JVM — upgrade Java or use an older mod build.",
                    "Java version mismatch",
                    "high",
                    classification.fixHints(),
                    false);
        }

        if (CrashClassifier.FK_ENV_LOCK.equals(failureKind)) {
            return new Narrative(
                    "A file is locked by another Windows process — close other Minecraft/Java instances and retry.",
                    "File in use",
                    "high",
                    classification.fixHints(),
                    false);
        }

        if (CrashClassifier.FK_WORLD_NBT_CORRUPT.equals(failureKind)) {
            return new Narrative(
                    "World or chunk NBT data looks corrupt (ZLIB/EOF while loading). Restore the affected region from a backup.",
                    "Corrupt world data",
                    "high",
                    classification.fixHints(),
                    false);
        }

        if (isWatchdog(combined, exception, root)
                || CrashClassifier.FK_WATCHDOG.equals(failureKind)
                || CrashClassifier.FK_WATCHDOG_PREGEN.equals(failureKind)
                || CrashClassifier.FK_WATCHDOG_FOLLOWUP.equals(failureKind)) {
            int ms = watchdogMs != null ? watchdogMs : 60000;
            int sec = Math.max(1, ms / 1000);
            if (CrashClassifier.FK_WATCHDOG_PREGEN.equals(failureKind)) {
                String stall = stallMod != null ? stallMod : "map render";
                return new Narrative(
                    "Server tick hang — " + stall + " blocked while Chunky pregen was active (~" + sec
                            + "s). Pause pregen or defer map render.",
                    "Tick hang / pregen contention",
                    "high",
                    classification.fixHints(),
                    false);
            }
            return new Narrative(
                    "The main server thread stopped responding for ~" + sec + "s (tick watchdog). "
                            + "Read the thread dump first — lag, pregen, or a heavy assembly, not always a broken mod.",
                    "Server hung",
                    "high",
                    classification.fixHints(),
                    false);
        }

        if (isOom(combined) || (CrashClassifier.FK_HOST_RESOURCE.equals(failureKind)
                && classification.details() != null && classification.details().has("oom_kind"))) {
            String oomKind = classification.details() != null && classification.details().has("oom_kind")
                    ? classification.details().get("oom_kind").getAsString() : "heap";
            if ("native".equals(oomKind)) {
                return new Narrative(
                        "The JVM ran out of native or direct memory.",
                        "Out of native memory",
                        "high",
                        classification.fixHints(),
                        false);
            }
            return new Narrative(
                    "Java ran out of heap memory during play.",
                    "Out of memory",
                    "high",
                    classification.fixHints(),
                    false);
        }

        if ("mod".equals(classification.category()) && (suspect != null || classification.primaryModId() != null)
                && CrashClassifier.FK_MOD_RUNTIME.equals(failureKind)) {
            String mod = suspect != null ? suspect : classification.primaryModId();
            JsonObject details = classification.details();
            String createIssue = details != null && details.has("create_issue") && !details.get("create_issue").isJsonNull()
                    ? details.get("create_issue").getAsString() : null;
            String plain;
            if ("create".equals(mod) && CrashClassifier.CREATE_ISSUE_CONTRAPTION.equals(createIssue)) {
                plain = "Create contraption collision (" + mod
                        + ") — stop the stuck assembly so the world can load, then update Create if needed.";
            } else if ("create".equals(mod)) {
                plain = "Create crashed during play (" + mod
                        + ") — inspect the stack and update Create or matching addons if versions look wrong.";
            } else {
                plain = "The crash points to mod " + mod + " — check for updates, corrupt jars, or mixin conflicts.";
            }
            return new Narrative(
                    plain,
                    "Mod crash",
                    "medium",
                    classification.fixHints(),
                    false);
        }

        if (isModLoad(combined, failure, exception) || ("mod".equals(classification.category())
                && failureKind != null && failureKind.startsWith("mod_load_"))) {
            String modLabel = suspect != null ? suspect : "a mod";
            return new Narrative(
                    "NeoForge failed while loading " + modLabel + " — often a version mismatch or missing dependency.",
                    "Mod failed to load",
                    suspect != null ? "high" : "medium",
                    classification.fixHints().size() > 0
                            ? classification.fixHints()
                            : hintsModLoad(suspect, failure),
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
                || (exception != null && exception.contains("ModLoading"));
    }

    private static JsonArray hintsWatchdog() {
        return toArray(List.of(
                "Pause Chunky or Distant Horizons pregen if it was running",
                "Open Spark or a tick profiler; reduce simulation distance if MSPT was high",
                "If this repeats with no players online, find chunk loaders or rogue entities"));
    }

    private static JsonArray hintsOom() {
        return toArray(List.of(
                "Increase Java heap (-Xmx) if headroom is low",
                "Remove duplicate mods or oversized pregen jobs that leak memory",
                "Run Spark heap analysis if OOM repeats under normal load"));
    }

    private static JsonArray hintsModLoad(String suspect, String failure) {
        List<String> hints = new ArrayList<>();
        if (suspect != null) {
            hints.add("Update or reinstall " + suspect + " from Modrinth or the official source");
            hints.add("Check latest.log for missing dependencies for " + suspect);
        } else {
            hints.add("Open latest.log and find which mod failed to load");
        }
        if (failure != null && failure.toLowerCase(Locale.ROOT).contains("dependency")) {
            hints.add("Install or update the dependency mod cited in the failure message");
        }
        hints.add("Remove recently added mods one at a time until the server starts");
        return toArray(hints);
    }

    private static JsonArray hintsManualReview() {
        return toArray(List.of(
                "Open the full crash report under crash-reports/ and read the root exception",
                "Search the mod id or exception online or in your pack issue tracker",
                "Mark reviewed after you confirm the crash is resolved or historical"));
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
