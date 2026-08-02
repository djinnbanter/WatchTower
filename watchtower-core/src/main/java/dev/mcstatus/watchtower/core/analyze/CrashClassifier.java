package dev.mcstatus.watchtower.core.analyze;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.collect.CrashDetails;
import dev.mcstatus.watchtower.core.collect.CrashReportScanner;
import dev.mcstatus.watchtower.core.collect.JarClassIndex;
import dev.mcstatus.watchtower.core.collect.MixinConfigIndex;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Classifies crash reports into mod / host-resource / loader / unknown buckets with fix hints.
 *
 * <p>Canonical {@code failure_kind} values include 1.0.13 kinds plus 1.0.16 CA parity kinds
 * ({@code mod_load_mixin}, {@code mod_load_mixin_conflict}, …).
 */
public final class CrashClassifier {

    public static final String FK_MOD_RUNTIME = "mod_runtime";
    public static final String FK_MOD_LOAD_DEPENDENCY = "mod_load_dependency";
    public static final String FK_MOD_LOAD_SCRIPT = "mod_load_script";
    public static final String FK_MOD_LOAD_MIXIN = "mod_load_mixin";
    public static final String FK_MOD_LOAD_MIXIN_CONFLICT = "mod_load_mixin_conflict";
    public static final String FK_MOD_LOAD_DUPLICATE = "mod_load_duplicate";
    public static final String FK_MOD_LOAD_CONFIG = "mod_load_config";
    public static final String FK_MOD_LOAD_ASSET = "mod_load_asset";
    public static final String FK_MOD_LOAD_WORLDGEN = "mod_load_worldgen";
    public static final String FK_MOD_LOAD_COMPAT = "mod_load_compat";
    public static final String FK_MOD_LOAD_ECOSYSTEM = "mod_load_ecosystem";
    public static final String FK_PLATFORM_MISMATCH = "platform_mismatch";
    public static final String FK_ENV_LOCK = "env_lock";
    public static final String FK_WORLD_NBT_CORRUPT = "world_nbt_corrupt";
    public static final String FK_WATCHDOG = "watchdog";
    public static final String FK_WATCHDOG_FOLLOWUP = "watchdog_followup";
    public static final String FK_WATCHDOG_PREGEN = "watchdog_pregen";
    public static final String FK_HOST_RESOURCE = "host_resource";
    /** External force-kill (OS OOM-killer or panel watchdog) — no Minecraft crash report. */
    public static final String FK_EXTERNAL_KILL = "external_kill";
    /** OPAC Better Commands calling a missing OpenPartiesAndClaims API method. */
    public static final String FK_API_VERSION_MISMATCH = "api_version_mismatch";
    /** Spark / similar stop-path noise (not mid-play instability). */
    public static final String FK_SHUTDOWN_NOISE = "shutdown_noise";
    public static final String FK_LOADER = "loader";
    public static final String FK_UNKNOWN = "unknown";

    /** Evidence-backed Create runtime subtype (details.create_issue). */
    public static final String CREATE_ISSUE_CONTRAPTION = "contraption_collision";

    private static final Pattern MOD_LOADING = Pattern.compile(
            "Mod\\s+\\(([^)]+)\\)", Pattern.CASE_INSENSITIVE);
    private static final Pattern FML_MOD_ID = Pattern.compile(
            "mod id\\s+['\"]?([a-z][\\w-]*)['\"]?", Pattern.CASE_INSENSITIVE);
    private static final Pattern MOD_LOADING_ISSUE_FOR = Pattern.compile(
            "Mod loading issue for:\\s*([a-z][\\w-]*)", Pattern.CASE_INSENSITIVE);
    private static final Pattern NAMESPACE = Pattern.compile("([a-z][\\w]*):[\\w./_-]+");
    private static final Pattern TRANSFORMER_MOD = Pattern.compile(
            "TRANSFORMER/([a-z][\\w-]*)@[\\w.+-]+/", Pattern.CASE_INSENSITIVE);
    private static final Pattern MIXIN_INIT_CONFIG = Pattern.compile(
            "MixinInitialisationError:\\s*Error initialising mixin config\\s+(\\S+)",
            Pattern.CASE_INSENSITIVE);
    private static final Pattern MIXIN_JSON_TOKEN = Pattern.compile(
            "\\b(?![\\w.\\-]*refmap)[\\w.\\-]+\\.json\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern CLASS_METADATA_MISSING = Pattern.compile(
            "ClassMetadataNotFoundException:\\s*(\\S+)", Pattern.CASE_INSENSITIVE);
    private static final Pattern CREATE_MISSING_CLASS = Pattern.compile(
            "(?i)(?:ClassNotFoundException|NoClassDefFoundError):\\s*"
                    + "(?:com[./]simibubi[./]create[./](?!foundation[./]ponder[./]PonderWorld\\b)"
                    + "|com[./]jozufozu[./]flywheel"
                    + "|dev[./]engine_room[./]flywheel"
                    + "|net[./]createmod)");
    private static final Pattern EPICFIGHT_MISSING = Pattern.compile(
            "(?i)(?:ClassNotFoundException|NoClassDefFoundError):\\s*yesman[./]epicfight");
    private static final Pattern AZURELIB_MISSING = Pattern.compile(
            "(?i)(?:ClassNotFoundException|NoClassDefFoundError):\\s*mod[./]azure[./]azurelib");
    private static final Pattern UNSUPPORTED_CLASS_VERSION = Pattern.compile(
            "java\\.lang\\.UnsupportedClassVersionError:\\s*([\\w$/]+) has been compiled by a more recent "
                    + "version of the Java Runtime \\(class file version (\\d+)(?:\\.\\d+)?\\), "
                    + "this version of the Java Runtime only recognizes class file versions up to (\\d+)",
            Pattern.CASE_INSENSITIVE);
    private static final Pattern ENV_LOCK = Pattern.compile(
            "java\\.nio\\.file\\.FileSystemException:\\s*(.+?):\\s*"
                    + "The process cannot access the file because it is being used by another process",
            Pattern.CASE_INSENSITIVE);
    /** Create contraption/collision stack or exception evidence (crash reports). */
    private static final Pattern CREATE_CONTRAPTION_EVIDENCE = Pattern.compile(
            "ContraptionCollision|ControlledContraptionEntity|ContinuousOBBCollider|mf\\.axis"
                    + "|(?i)(?:create.*(?:contraption|collision)|(?:contraption|collision).*create)");
    private static final Pattern EXCEPTION_CLASS = Pattern.compile(
            "\\b((?:java|javax|sun|jdk)\\.[\\w.$]+(?:Error|Exception))\\b");
    private static final Pattern CREATE_HOT_FRAME = Pattern.compile(
            "TRANSFORMER/create@[\\w.+-]+/(com\\.simibubi\\.create\\.[\\w.$]+)\\.(\\w+)\\(",
            Pattern.CASE_INSENSITIVE);

    private static final Set<String> PREGEN_STALL_MODS = Set.of(
            "squaremap", "bluemap", "chunky", "dynmap", "journeymap", "distanthorizons");
    private static final Set<String> PLACEHOLDER_MOD_IDS = Set.of(
            "<no mod information provided>",
            "no mod information provided",
            "java.lang.error",
            "error",
            "null",
            "unknown");
    private static final Set<String> VANILLA_IDS = Set.of(
            "minecraft", "neoforge", "forge", "fabricloader", "java");

    private CrashClassifier() {
    }

    /**
     * Context for mod-gated / mixin-index rules (CA-01+).
     */
    public record ClassifyContext(
            JsonArray mods,
            MixinConfigIndex mixinIndex,
            boolean bootFailed,
            JarClassIndex classIndex) {

        public ClassifyContext(JsonArray mods, MixinConfigIndex mixinIndex, boolean bootFailed) {
            this(mods, mixinIndex, bootFailed, null);
        }

        public static ClassifyContext empty() {
            return new ClassifyContext(null, MixinConfigIndex.empty(), false, null);
        }

        public MixinConfigIndex mixinIndexOrEmpty() {
            return mixinIndex != null ? mixinIndex : MixinConfigIndex.empty();
        }

        public ModListGate gate() {
            return ModListGate.fromMods(mods);
        }
    }

    /**
     * @param category       legacy bucket: mod / host_resource / loader / unknown
     * @param failureKind    fine-grained kind
     * @param suspectModId   best-effort suspect (may equal primary)
     * @param primaryModId   TRANSFORMER / Mod File / mixin primary
     * @param stallModId     map/pregen mod on watchdog stacks
     * @param fixHints       actionable hints
     * @param details        optional extras ({@code mixin_config}, {@code exception_detail}, …)
     */
    public record Classification(
            String category,
            String failureKind,
            String suspectModId,
            String primaryModId,
            String stallModId,
            JsonArray fixHints,
            JsonObject details) {

        public Classification(
                String category,
                String failureKind,
                String suspectModId,
                String primaryModId,
                String stallModId,
                JsonArray fixHints) {
            this(category, failureKind, suspectModId, primaryModId, stallModId, fixHints, new JsonObject());
        }

        /** Back-compat ctor used by older call sites / tests. */
        public Classification(String category, String suspectModId, JsonArray fixHints) {
            this(category, categoryToFailureKind(category), suspectModId, suspectModId, null, fixHints,
                    new JsonObject());
        }
    }

    public static Classification classify(JsonObject crash) {
        return classify(crash, ClassifyContext.empty());
    }

    /**
     * Lightweight classification from a crash file head (ops-cache scan / reconcile).
     * Parses Description and exception lines only; uses {@code light_stack} for stall-mod detection.
     */
    public static Classification classifyLight(String headText) {
        if (headText == null || headText.isBlank()) {
            return new Classification("unknown", FK_UNKNOWN, null, null, null, hintsUnknown());
        }
        CrashDetails details = CrashDetails.parse(headText);
        String description = CrashReportScanner.parseCrashSummary(headText);
        JsonObject crash = new JsonObject();
        if (description != null && !description.isBlank()) {
            crash.addProperty("description", description);
            crash.addProperty("summary", description);
        }
        if (details.exception() != null && !details.exception().isBlank()) {
            crash.addProperty("exception", details.exception());
        }
        if (details.modFile() != null && !details.modFile().isBlank()) {
            crash.addProperty("mod_file", details.modFile());
        }
        String bannerPrimary = modLoadingIssueFor(headText);
        if (bannerPrimary != null) {
            crash.addProperty("primary_mod_id", bannerPrimary);
        }
        crash.addProperty("light_stack", headText);
        return classify(crash);
    }

    /** Extract primary mod from FML {@code -- Mod loading issue for: X --} banner. */
    public static String modLoadingIssueFor(String text) {
        if (text == null || text.isBlank()) {
            return null;
        }
        Matcher m = MOD_LOADING_ISSUE_FOR.matcher(text);
        return m.find() ? sanitizeModId(m.group(1).strip()) : null;
    }

    public static Classification classify(JsonObject crash, ClassifyContext ctx) {
        if (ctx == null) {
            ctx = ClassifyContext.empty();
        }
        String exception = str(crash, "exception");
        String modFile = str(crash, "mod_file");
        String summary = str(crash, "summary");
        String description = str(crash, "description");
        String failure = str(crash, "failure_message");
        String root = str(crash, "root_exception");
        String primaryFromParse = sanitizeModId(str(crash, "primary_mod_id"));
        String combined = ((exception != null ? exception : "") + " "
                + (modFile != null ? modFile : "") + " "
                + (summary != null ? summary : "") + " "
                + (description != null ? description : "") + " "
                + (failure != null ? failure : "") + " "
                + (root != null ? root : "")).toLowerCase(Locale.ROOT);

        String stackText = stackBlob(crash);
        String scanText = buildScanText(crash, stackText);
        String primary = primaryFromParse != null ? primaryFromParse : firstTransformerMod(stackText);
        if (primary == null) {
            primary = firstTransformerMod(combined);
        }

        // G-02: world NBT corrupt before generic host_resource
        if (isWorldNbtCorrupt(combined, description, exception, root)) {
            return new Classification(
                    "host_resource",
                    FK_WORLD_NBT_CORRUPT,
                    null,
                    primary,
                    null,
                    hintsNbt());
        }

        if (isWatchdog(combined, exception, root)) {
            String stall = stallModFrom(crash, primary, stackText, combined);
            String kind = stall != null ? FK_WATCHDOG_PREGEN : FK_WATCHDOG;
            return new Classification(
                    "host_resource",
                    kind,
                    stall != null ? stall : primary,
                    primary,
                    stall,
                    stall != null ? hintsWatchdogPregen(stall) : hintsWatchdog());
        }

        if (isOom(combined) || isNativeOom(scanText, combined)) {
            String oomKind = resolveOomKind(scanText, combined);
            JsonObject oomDetails = new JsonObject();
            oomDetails.addProperty("oom_kind", oomKind);
            return new Classification(
                    "host_resource",
                    FK_HOST_RESOURCE,
                    null,
                    primary,
                    null,
                    hintsOom(oomKind),
                    oomDetails);
        }

        // CA-01 mixin init (before generic mod_load)
        Classification mixin = classifyMixinInit(scanText, ctx, primary);
        if (mixin != null) {
            return mixin;
        }

        // CA-02 → CA-15 (before generic mod_load)
        Classification ca = classifyCaParity(scanText, ctx, primary);
        if (ca != null) {
            return ca;
        }

        if (isModLoad(combined, failure, exception)) {
            String suspect = sanitizeModId(suspectModId(modFile, exception, summary));
            if (suspect == null) {
                suspect = primary;
            }
            String kind = combined.contains("kubejs") || combined.contains("script")
                    ? FK_MOD_LOAD_SCRIPT
                    : FK_MOD_LOAD_DEPENDENCY;
            String linked = primary != null ? primary : suspect;
            JsonObject details = enrichModRuntimeDetails(scanText, linked, exception);
            return new Classification("mod", kind, suspect, linked, null,
                    hintsMod(suspect, combined, details, ctx, scanText), details);
        }

        if (isModRelated(combined, modFile, exception, description, primary, stackText)) {
            String suspect = sanitizeModId(suspectModId(modFile, exception, summary));
            if (suspect == null) {
                suspect = primary;
            }
            String linked = primary != null ? primary : suspect;

            if (isSparkShutdownNoise(scanText, combined, stackText)) {
                return new Classification(
                        "mod",
                        FK_SHUTDOWN_NOISE,
                        "spark",
                        "spark",
                        null,
                        hintsShutdownNoise());
            }
            if (isOpacApiVersionMismatch(scanText, combined, exception, linked, suspect, stackText)) {
                return new Classification(
                        "mod",
                        FK_API_VERSION_MISMATCH,
                        "opac_better_commands",
                        "opac_better_commands",
                        null,
                        hintsApiVersionMismatch());
            }

            JsonObject details = enrichModRuntimeDetails(scanText, linked, exception);
            return new Classification(
                    "mod",
                    FK_MOD_RUNTIME,
                    suspect,
                    linked,
                    null,
                    hintsMod(suspect, combined, details, ctx, scanText),
                    details);
        }

        if (isLoader(combined, stackText, scanText)) {
            return new Classification("loader", FK_LOADER, null, primary, null, hintsLoader());
        }

        if (isHostResource(combined, exception)) {
            return new Classification(
                    "host_resource",
                    FK_HOST_RESOURCE,
                    null,
                    primary,
                    null,
                    hintsHostResource(combined, exception));
        }

        return new Classification("unknown", FK_UNKNOWN, null, primary, null, hintsUnknown());
    }

    /** Prefer crash body; when scanning a long log, use last ~1000 lines. */
    static String buildScanText(JsonObject crash, String stackText) {
        StringBuilder sb = new StringBuilder();
        appendScan(sb, str(crash, "quote"));
        appendScan(sb, str(crash, "exception"));
        appendScan(sb, str(crash, "root_exception"));
        appendScan(sb, str(crash, "caused_by"));
        appendScan(sb, str(crash, "failure_message"));
        appendScan(sb, str(crash, "description"));
        appendScan(sb, str(crash, "summary"));
        appendScan(sb, stackText);
        appendScan(sb, str(crash, "log_excerpt"));
        String full = sb.toString();
        String[] lines = full.split("\\R");
        if (lines.length <= 1000) {
            return full;
        }
        StringBuilder tail = new StringBuilder();
        for (int i = lines.length - 1000; i < lines.length; i++) {
            if (tail.length() > 0) {
                tail.append('\n');
            }
            tail.append(lines[i]);
        }
        return tail.toString();
    }

    private static void appendScan(StringBuilder sb, String value) {
        if (value == null || value.isBlank()) {
            return;
        }
        if (sb.length() > 0) {
            sb.append('\n');
        }
        sb.append(value);
    }

    /**
     * CA-01: mixin config initialisation failure → {@link #FK_MOD_LOAD_MIXIN}.
     */
    static Classification classifyMixinInit(String scanText, ClassifyContext ctx, String fallbackPrimary) {
        if (scanText == null || scanText.isBlank()) {
            return null;
        }
        String lower = scanText.toLowerCase(Locale.ROOT);
        boolean clearInit = lower.contains("mixininitialisationerror")
                || lower.contains("error initialising mixin config");
        String config = null;
        Matcher init = MIXIN_INIT_CONFIG.matcher(scanText);
        if (init.find()) {
            config = stripTrailingPunct(init.group(1));
            clearInit = true;
        }

        String detail = null;
        if (lower.contains("compatibility level") || lower.contains("java/asm")
                || lower.contains("asm api")) {
            detail = "java_asm_level";
        } else if (lower.contains("invalid resource") || lower.contains("corrupt")) {
            detail = "corrupt_config";
        }

        Matcher missing = CLASS_METADATA_MISSING.matcher(scanText);
        if (missing.find()) {
            detail = "missing_class";
            // config may stay null
        }

        if (config == null && !clearInit) {
            // Other sponge mixin Caused-by: exactly one non-refmap .json
            List<String> configs = new ArrayList<>();
            Matcher json = MIXIN_JSON_TOKEN.matcher(scanText);
            while (json.find()) {
                String token = json.group();
                if (token.toLowerCase(Locale.ROOT).contains("refmap")) {
                    continue;
                }
                configs.add(token);
            }
            if (configs.size() != 1) {
                return null;
            }
            // Only attribute when mixin-related
            if (!lower.contains("mixin") && !lower.contains("spongepowered.asm")) {
                return null;
            }
            config = configs.get(0);
            clearInit = true;
        }

        if (!clearInit && config == null && detail == null) {
            return null;
        }
        if (!clearInit && detail == null) {
            return null;
        }
        // Need a clear mixin signal
        if (!clearInit && !"missing_class".equals(detail)) {
            return null;
        }
        if (!clearInit && "missing_class".equals(detail)
                && !lower.contains("mixin") && !lower.contains("spongepowered")) {
            return null;
        }

        String primary = null;
        if (config != null) {
            Optional<MixinConfigIndex.Hit> hit = ctx.mixinIndexOrEmpty().resolve(config);
            if (hit.isPresent()) {
                primary = hit.get().modId();
            }
        }
        JsonObject details = new JsonObject();
        if (config != null) {
            details.addProperty("mixin_config", config);
        }
        if (detail != null) {
            details.addProperty("exception_detail", detail);
        }
        JsonArray hints = new JsonArray();
        if (primary != null) {
            hints.add("Update or temporarily remove mod '" + primary + "' (mixin config "
                    + (config != null ? config : "?") + ").");
        } else if (config != null) {
            hints.add("Mixin config '" + config + "' failed to load — identify the owning mod and update or remove it.");
        } else {
            hints.add("A mixin failed during class lookup — update recent mods or check mixin conflicts.");
        }
        if ("java_asm_level".equals(detail)) {
            hints.add("Check the Java version required by the mixin config (ASM compatibility level).");
        }
        return new Classification(
                "mod",
                FK_MOD_LOAD_MIXIN,
                primary,
                primary != null ? primary : fallbackPrimary,
                null,
                hints,
                details);
    }

    /**
     * CA-02…CA-15 ordered rules (after CA-01, before generic {@code isModLoad}).
     */
    static Classification classifyCaParity(
            String scanText,
            ClassifyContext ctx,
            String fallbackPrimary) {
        Classification hit;
        hit = classifyMixinConflict(scanText, ctx, fallbackPrimary);
        if (hit != null) {
            return hit;
        }
        hit = classifyServerConfig(scanText, fallbackPrimary);
        if (hit != null) {
            return hit;
        }
        hit = classifyInvalidResourceLocation(scanText, fallbackPrimary);
        if (hit != null) {
            return hit;
        }
        hit = classifyDuplicateMods(scanText, ctx, fallbackPrimary);
        if (hit != null) {
            return hit;
        }
        hit = classifyLanguageProviderMismatch(scanText, ctx, fallbackPrimary);
        if (hit != null) {
            return hit;
        }
        hit = classifyFeatureOrderCycle(scanText, fallbackPrimary);
        if (hit != null) {
            return hit;
        }
        hit = classifyFerriteNeighborTable(scanText, fallbackPrimary);
        if (hit != null) {
            return hit;
        }
        hit = classifyCreateEcosystem(scanText, ctx, fallbackPrimary);
        if (hit != null) {
            return hit;
        }
        hit = classifyEpicFightOrAzure(scanText, ctx, fallbackPrimary);
        if (hit != null) {
            return hit;
        }
        hit = classifyKubeJsDatapack(scanText, ctx, fallbackPrimary);
        if (hit != null) {
            return hit;
        }
        hit = classifyUnsupportedClassVersion(scanText, fallbackPrimary, ctx);
        if (hit != null) {
            return hit;
        }
        hit = classifyEnvLock(scanText, fallbackPrimary);
        if (hit != null) {
            return hit;
        }
        return null;
    }

    /** CA-02: mixin apply conflict phrases (no jar class walk). */
    static Classification classifyMixinConflict(String scanText, ClassifyContext ctx, String fallbackPrimary) {
        if (scanText == null || scanText.isBlank()) {
            return null;
        }
        String[] conflictPhrases = {
                "conflict. Skipping",
                " merged by ",
                " previously written by ",
                " was not located in the target class "
        };
        String[] lines = scanText.split("\\R");
        for (String line : lines) {
            boolean matched = false;
            String afterPhrase = null;
            for (String phrase : conflictPhrases) {
                int idx = line.indexOf(phrase);
                if (idx >= 0) {
                    matched = true;
                    afterPhrase = line.substring(idx + phrase.length()).strip();
                    break;
                }
            }
            if (!matched) {
                continue;
            }
            if (afterPhrase != null) {
                String pkg = afterPhrase.split("\\s+")[0];
                if (isVanillaPackage(pkg)) {
                    continue;
                }
            }
            List<String> configs = extractMixinConfigs(line);
            if (configs.isEmpty()) {
                // Search nearby lines for configs on conflict.Skipping style
                continue;
            }
            String configA = configs.get(0);
            String configB = configs.size() > 1 ? configs.get(1) : null;
            if (line.contains("conflict. Skipping") && configs.size() >= 2) {
                configA = configs.get(0);
                configB = configs.get(1);
            }
            String primary = resolveMixinMod(ctx, configA);
            String conflictMod = configB != null ? resolveMixinMod(ctx, configB) : null;
            JsonObject details = new JsonObject();
            details.addProperty("mixin_config", configA);
            if (configB != null) {
                details.addProperty("mixin_config_conflict", configB);
            }
            if (conflictMod != null) {
                details.addProperty("conflict_mod_id", conflictMod);
            }
            JsonArray hints = new JsonArray();
            if (primary != null && conflictMod != null) {
                hints.add("Update or align mods '" + primary + "' and '" + conflictMod
                        + "' — mixin configs conflict.");
            } else if (primary != null) {
                hints.add("Update or temporarily remove mod '" + primary
                        + "' (mixin conflict on " + configA + ").");
            } else {
                hints.add("Two mods' mixins conflict — update both or remove one.");
            }
            return new Classification(
                    "mod",
                    FK_MOD_LOAD_MIXIN_CONFLICT,
                    primary,
                    primary != null ? primary : fallbackPrimary,
                    null,
                    hints,
                    details);
        }
        // Second pass: conflict.Skipping may list configs without package token
        for (String line : lines) {
            if (!line.contains("conflict. Skipping")) {
                continue;
            }
            List<String> configs = extractMixinConfigs(line);
            if (configs.size() < 2) {
                continue;
            }
            String configA = configs.get(0);
            String configB = configs.get(1);
            String primary = resolveMixinMod(ctx, configA);
            String conflictMod = resolveMixinMod(ctx, configB);
            JsonObject details = new JsonObject();
            details.addProperty("mixin_config", configA);
            details.addProperty("mixin_config_conflict", configB);
            if (conflictMod != null) {
                details.addProperty("conflict_mod_id", conflictMod);
            }
            JsonArray hints = new JsonArray();
            hints.add("Mixin configs conflict (" + configA + " vs " + configB
                    + ") — update both mods to versions tested together.");
            return new Classification(
                    "mod",
                    FK_MOD_LOAD_MIXIN_CONFLICT,
                    primary,
                    primary != null ? primary : fallbackPrimary,
                    null,
                    hints,
                    details);
        }
        return null;
    }

    /** CA-04: SERVER toml config parse failure. */
    static Classification classifyServerConfig(String scanText, String fallbackPrimary) {
        if (scanText == null) {
            return null;
        }
        Pattern serverToml = Pattern.compile(
                "ConfigLoadingException:\\s*Failed loading config file\\s+(\\S+\\.toml)\\s+of type SERVER for modid\\s+(\\S+)",
                Pattern.CASE_INSENSITIVE);
        Matcher m = serverToml.matcher(scanText);
        if (!m.find()) {
            return null;
        }
        if (!scanText.contains("ParsingException")
                && !scanText.toLowerCase(Locale.ROOT).contains("com.electronwill.nightconfig")) {
            return null;
        }
        String configFile = m.group(1);
        String modId = sanitizeModId(m.group(2).replaceAll("[,.]+$", ""));
        JsonObject details = new JsonObject();
        details.addProperty("config_file", configFile);
        details.addProperty("config_path", configFile);
        details.addProperty("config_type", "SERVER");
        JsonArray hints = new JsonArray();
        hints.add("Delete or fix corrupt SERVER config " + configFile
                + (modId != null ? " for mod '" + modId + "'" : "") + ".");
        hints.add("Back up the file first, then let the mod regenerate defaults on restart.");
        return new Classification(
                "mod",
                FK_MOD_LOAD_CONFIG,
                modId,
                modId != null ? modId : fallbackPrimary,
                null,
                hints,
                details);
    }

    /** CA-05: invalid ResourceLocation character. */
    static Classification classifyInvalidResourceLocation(String scanText, String fallbackPrimary) {
        if (scanText == null) {
            return null;
        }
        Pattern pat = Pattern.compile(
                "ResourceLocationException:\\s*Non \\[a-z0-9/._-\\] character in path of location:\\s*(\\S+)",
                Pattern.CASE_INSENSITIVE);
        Matcher m = pat.matcher(scanText);
        if (!m.find()) {
            return null;
        }
        String location = m.group(1);
        String ns = null;
        int colon = location.indexOf(':');
        if (colon > 0) {
            ns = sanitizeModId(location.substring(0, colon));
        }
        // Plan: namespace → primary_mod_id unless minecraft
        if (ns != null && "minecraft".equals(ns)) {
            ns = null;
        }
        JsonObject details = new JsonObject();
        details.addProperty("invalid_location", location);
        JsonArray hints = new JsonArray();
        hints.add("A resource path has an illegal character: " + location
                + " — fix the datapack/mod asset name (only a-z 0-9 / . _ -).");
        return new Classification(
                "mod",
                FK_MOD_LOAD_ASSET,
                ns,
                ns != null ? ns : fallbackPrimary,
                null,
                hints,
                details);
    }

    /** CA-03: duplicate mods (boot failed only). */
    static Classification classifyDuplicateMods(String scanText, ClassifyContext ctx, String fallbackPrimary) {
        if (scanText == null || ctx == null || !ctx.bootFailed()) {
            return null;
        }
        String lower = scanText.toLowerCase(Locale.ROOT);
        if (!lower.contains("found duplicate mods:")) {
            return null;
        }
        if (!lower.contains("earlyloadingexception") && !lower.contains("modloadingexception")) {
            return null;
        }
        if (!lower.contains("duplicate mods")) {
            return null;
        }
        JsonObject details = new JsonObject();
        JsonArray dupIds = new JsonArray();
        JsonArray dupJars = new JsonArray();
        Pattern idLine = Pattern.compile(
                "Mod ID:\\s*'([^']+)'\\s+from mod files:\\s*\\[([^\\]]+)\\]",
                Pattern.CASE_INSENSITIVE);
        Matcher idMatcher = idLine.matcher(scanText);
        while (idMatcher.find()) {
            String id = idMatcher.group(1).strip();
            dupIds.add(id);
            for (String jar : idMatcher.group(2).split(",")) {
                String j = jar.strip();
                if (!j.isEmpty()) {
                    dupJars.add(j);
                }
            }
        }
        if (dupIds.size() > 0) {
            details.add("duplicate_mod_ids", dupIds);
        }
        if (dupJars.size() > 0) {
            details.add("duplicate_jars", dupJars);
        }
        JsonArray hints = new JsonArray();
        if (dupJars.size() > 0) {
            hints.add("Remove duplicate jar(s) from mods/: " + dupJars.get(0).getAsString()
                    + (dupJars.size() > 1 ? " (and other listed copies)." : "."));
        } else {
            hints.add("Remove duplicate mod jars from mods/ (same mod id installed twice).");
        }
        hints.add("Keep only one jar per mod id, then restart.");
        String primary = dupIds.size() > 0 ? sanitizeModId(dupIds.get(0).getAsString()) : null;
        return new Classification(
                "mod",
                FK_MOD_LOAD_DUPLICATE,
                primary,
                primary != null ? primary : fallbackPrimary,
                null,
                hints,
                details);
    }

    /** CA-06: language provider mismatch (boot only). */
    static Classification classifyLanguageProviderMismatch(
            String scanText, ClassifyContext ctx, String fallbackPrimary) {
        if (scanText == null || ctx == null || !ctx.bootFailed()) {
            return null;
        }
        if (!scanText.contains("needs language provider")) {
            return null;
        }
        if (!scanText.contains("We have found")) {
            return null;
        }
        JsonObject details = new JsonObject();
        Pattern need = Pattern.compile(
                "Mod File\\s+(\\S+)\\s+needs language provider\\s+(\\S+)",
                Pattern.CASE_INSENSITIVE);
        Matcher nm = need.matcher(scanText);
        String suspect = null;
        if (nm.find()) {
            String file = nm.group(1);
            details.addProperty("mod_file", file);
            details.addProperty("required_provider", nm.group(2).replaceAll("[,:]+$", ""));
            suspect = sanitizeModId(file);
        }
        Pattern found = Pattern.compile("We have found\\s+(.+)", Pattern.CASE_INSENSITIVE);
        Matcher fm = found.matcher(scanText);
        if (fm.find()) {
            JsonArray providers = new JsonArray();
            String rest = fm.group(1).strip();
            // "0 language providers" or a list
            if (rest.toLowerCase(Locale.ROOT).startsWith("0 ")) {
                // empty list
            } else {
                for (String part : rest.split("[,;]")) {
                    String p = part.strip().replaceAll("(?i)\\s*language providers?.*$", "").strip();
                    if (!p.isEmpty() && !p.matches("\\d+")) {
                        providers.add(p);
                    }
                }
            }
            details.add("found_providers", providers);
        }
        JsonArray hints = new JsonArray();
        hints.add("Install the missing language provider or dependency named in the FML banner.");
        if (suspect != null) {
            hints.add("Suspect mod file points to '" + suspect
                    + "' — update that jar or install the provider/library it requires.");
        }
        if (details.has("found_providers") && details.get("found_providers").isJsonArray()
                && details.getAsJsonArray("found_providers").size() > 0) {
            hints.add("Found providers listed in the report — compare them to what the mod declares it needs.");
        }
        return new Classification(
                "mod",
                FK_MOD_LOAD_DEPENDENCY,
                suspect,
                suspect != null ? suspect : fallbackPrimary,
                null,
                hints,
                details);
    }

    /** CA-07: worldgen feature order cycle. */
    static Classification classifyFeatureOrderCycle(String scanText, String fallbackPrimary) {
        if (scanText == null) {
            return null;
        }
        String lower = scanText.toLowerCase(Locale.ROOT);
        if (!lower.contains("feature order cycle")
                && !lower.contains("featurecycleexception")
                && !lower.contains("a feature cycle was found")) {
            return null;
        }
        JsonArray hints = new JsonArray();
        hints.add("Remove the last-added biome/terrain mod first, then retest boot.");
        hints.add("Worldgen feature order cycle — remove or update the conflicting worldgen/biome mods.");
        hints.add("Check Cyanide / feature-cycle reports in the log for the exact cycle path.");
        return new Classification(
                "mod",
                FK_MOD_LOAD_WORLDGEN,
                null,
                fallbackPrimary,
                null,
                hints);
    }

    /** CA-08: FerriteCore neighbor table. */
    static Classification classifyFerriteNeighborTable(String scanText, String fallbackPrimary) {
        if (scanText == null) {
            return null;
        }
        if (!scanText.contains("populateNeighborTable")
                && !scanText.contains("state neighbor table directly")) {
            return null;
        }
        if (!scanText.contains("FerriteCore") && !scanText.toLowerCase(Locale.ROOT).contains("ferritecore")) {
            // Still match the UnsupportedOperationException message that names FerriteCore issues URL
            if (!scanText.contains("malte0811/FerriteCore")) {
                return null;
            }
        }
        JsonArray hints = new JsonArray();
        hints.add("Set FerriteCore config populateNeighborTable to false as a temporary workaround.");
        hints.add("Report the accessing mod on FerriteCore's issue tracker.");
        return new Classification(
                "mod",
                FK_MOD_LOAD_COMPAT,
                "ferritecore",
                "ferritecore",
                null,
                hints);
    }

    /** CA-09: Create 6 / Railways / missing Create classes. */
    static Classification classifyCreateEcosystem(String scanText, ClassifyContext ctx, String fallbackPrimary) {
        if (scanText == null || ctx == null) {
            return null;
        }
        ModListGate gate = ctx.gate();
        if (!gate.requiresMod("create")) {
            return null;
        }
        String createVer = modVersion(ctx.mods(), "create");
        String railwaysVer = modVersion(ctx.mods(), "railways");
        boolean railwaysMismatch = false;
        if (createVer != null && railwaysVer != null) {
            String railwaysBase = railwaysVer.split("-")[0];
            boolean create6 = createVer.startsWith("6");
            if (create6) {
                railwaysMismatch = ModIssueAdvisor.compareVersions(railwaysBase, "1.6.10") < 0;
            } else {
                railwaysMismatch = ModIssueAdvisor.compareVersions(railwaysBase, "1.6.10") >= 0;
            }
        }
        boolean missingCreateClass = CREATE_MISSING_CLASS.matcher(scanText).find();
        if (!railwaysMismatch && !missingCreateClass) {
            return null;
        }
        JsonObject details = new JsonObject();
        details.addProperty("ecosystem", "create6");
        if (createVer != null) {
            details.addProperty("create_version", createVer);
        }
        if (railwaysVer != null) {
            details.addProperty("railways_version", railwaysVer);
            details.addProperty("related_mod_id", "railways");
        }
        if (railwaysMismatch) {
            details.addProperty("ecosystem_issue", "create_railways_mismatch");
        } else {
            details.addProperty("ecosystem_issue", "create_missing_class");
        }
        JsonArray hints = new JsonArray();
        if (railwaysMismatch) {
            hints.add("Update Create Steam 'n' Rails (Railways) to ≥ 1.6.10 for Create 6.x (or align Create major with your Railways build).");
        } else {
            hints.add("Align Create and Create Steam 'n' Rails (Railways) versions — Create 6 needs Railways ≥1.6.10.");
        }
        hints.add("Align Create addons to the same Create major version, then restart.");
        if (hasModId(ctx.mods(), "flywheel") || scanMentionsFlywheel(scanText)) {
            hints.add("If a separate Flywheel jar is installed, remove conflicting copies — Create already bundles the matching Flywheel.");
        }
        return new Classification(
                "mod",
                FK_MOD_LOAD_ECOSYSTEM,
                railwaysMismatch ? "railways" : "create",
                "create",
                null,
                hints,
                details);
    }

    /** CA-10: epicfight / azurelib CNFE gated by mod presence. */
    static Classification classifyEpicFightOrAzure(String scanText, ClassifyContext ctx, String fallbackPrimary) {
        if (scanText == null || ctx == null) {
            return null;
        }
        ModListGate gate = ctx.gate();
        if (gate.requiresMod("epicfight") && EPICFIGHT_MISSING.matcher(scanText).find()) {
            JsonObject details = new JsonObject();
            details.addProperty("ecosystem", "epicfight");
            JsonArray hints = new JsonArray();
            hints.add("Epic Fight class missing — update Epic Fight and its addons together.");
            return new Classification(
                    "mod",
                    FK_MOD_LOAD_ECOSYSTEM,
                    "epicfight",
                    "epicfight",
                    null,
                    hints,
                    details);
        }
        if (gate.requiresMod("azurelib") && AZURELIB_MISSING.matcher(scanText).find()) {
            JsonObject details = new JsonObject();
            details.addProperty("ecosystem", "azurelib");
            JsonArray hints = new JsonArray();
            hints.add("AzureLib class missing — update AzureLib and mods that depend on it.");
            return new Classification(
                    "mod",
                    FK_MOD_LOAD_ECOSYSTEM,
                    "azurelib",
                    "azurelib",
                    null,
                    hints,
                    details);
        }
        return null;
    }

    /** CA-12: KubeJS datapack parse (gated). */
    static Classification classifyKubeJsDatapack(String scanText, ClassifyContext ctx, String fallbackPrimary) {
        if (scanText == null || ctx == null || !ctx.gate().requiresMod("kubejs")) {
            return null;
        }
        if (!scanText.contains("Failed to parse ")
                || !scanText.contains("KubeJS Resource Pack [data]")) {
            return null;
        }
        JsonArray hints = new JsonArray();
        hints.add("Fix or remove the broken KubeJS datapack script cited in the log.");
        hints.add("Check kubejs/data for invalid JSON or recipes.");
        return new Classification(
                "mod",
                FK_MOD_LOAD_SCRIPT,
                "kubejs",
                "kubejs",
                null,
                hints);
    }

    /** CA-14: UnsupportedClassVersionError → platform_mismatch. */
    static Classification classifyUnsupportedClassVersion(
            String scanText, String fallbackPrimary, ClassifyContext ctx) {
        if (scanText == null) {
            return null;
        }
        Matcher m = UNSUPPORTED_CLASS_VERSION.matcher(scanText);
        if (!m.find()) {
            return null;
        }
        String className = m.group(1);
        if (isVanillaPackage(className)) {
            return null;
        }
        int compiledCf = Integer.parseInt(m.group(2));
        int runtimeCf = Integer.parseInt(m.group(3));
        String primary = fallbackPrimary;
        JsonObject details = new JsonObject();
        details.addProperty("class_name", className);
        details.addProperty("compiled_java", compiledCf - 44);
        details.addProperty("runtime_java", runtimeCf - 44);
        if (ctx != null && ctx.classIndex() != null) {
            List<JarClassIndex.Match> matches = ctx.classIndex().findClass(className, true);
            if (!matches.isEmpty()) {
                JarClassIndex.Match hit = matches.get(0);
                primary = hit.modId() != null ? hit.modId() : primary;
                details.addProperty("owning_jar", hit.jar());
                if (hit.innerPath() != null) {
                    details.addProperty("inner_path", hit.innerPath());
                }
            }
        }
        int compiledJava = compiledCf - 44;
        int runtimeJava = runtimeCf - 44;
        JsonObject javaMismatch = new JsonObject();
        javaMismatch.addProperty("compiled_java", compiledJava);
        javaMismatch.addProperty("runtime_java", runtimeJava);
        javaMismatch.addProperty("class_name", className);
        details.add("java_mismatch", javaMismatch);
        JsonArray hints = new JsonArray();
        if (compiledJava >= 21 && runtimeJava < 21) {
            hints.add("Upgrade the server JVM to Java 21+ (NeoForge 1.21 expects it). This mod was compiled for Java "
                    + compiledJava + " but the server runs Java " + runtimeJava + ".");
        } else if (compiledJava > runtimeJava) {
            hints.add("Upgrade the server JVM to Java " + compiledJava
                    + " (or install an older build of the mod compiled for Java " + runtimeJava + ").");
        } else {
            hints.add("A mod was compiled for Java " + compiledJava
                    + " but the server runs Java " + runtimeJava
                    + " — upgrade the JVM or use an older mod build.");
        }
        if (details.has("owning_jar")) {
            hints.add("Owning jar: " + details.get("owning_jar").getAsString()
                    + (primary != null ? " (" + primary + ")" : ""));
        }
        return new Classification(
                "loader",
                FK_PLATFORM_MISMATCH,
                primary,
                primary,
                null,
                hints,
                details);
    }

    /** CA-15: Windows file lock. */
    static Classification classifyEnvLock(String scanText, String fallbackPrimary) {
        if (scanText == null) {
            return null;
        }
        Matcher m = ENV_LOCK.matcher(scanText);
        if (!m.find()) {
            return null;
        }
        String path = m.group(1);
        JsonObject details = new JsonObject();
        details.addProperty("locked_path", path);
        JsonArray hints = new JsonArray();
        hints.add("Stop other Java/Minecraft instances (and close Explorer previews / antivirus locks) holding: "
                + path);
        String pathLower = path.toLowerCase(Locale.ROOT);
        if (pathLower.endsWith("session.lock") || pathLower.contains("session.lock")) {
            hints.add("Only delete world/session.lock after confirming nothing is using this world folder.");
        } else {
            hints.add("If the lock persists after all Minecraft/Java processes are closed, reboot once, then start the server.");
        }
        return new Classification(
                "host_resource",
                FK_ENV_LOCK,
                null,
                fallbackPrimary,
                null,
                hints,
                details);
    }

    /** CA-16 helper: heap vs native OOM kind (crash kind stays host_resource). */
    public static String resolveOomKind(String scanText, String combined) {
        String blob = ((scanText != null ? scanText : "") + " " + (combined != null ? combined : ""))
                .toLowerCase(Locale.ROOT);
        if (blob.contains("direct buffer memory")
                || blob.contains("unable to create new native thread")
                || blob.contains("insufficient memory for the java runtime")
                || blob.contains("native memory allocation")) {
            return "native";
        }
        return "heap";
    }

    public static boolean isNativeOom(String scanText, String combined) {
        String blob = ((scanText != null ? scanText : "") + " " + (combined != null ? combined : ""))
                .toLowerCase(Locale.ROOT);
        return blob.contains("insufficient memory for the java runtime")
                || blob.contains("native memory allocation");
    }

    private static String resolveMixinMod(ClassifyContext ctx, String config) {
        if (ctx == null || config == null) {
            return null;
        }
        return ctx.mixinIndexOrEmpty().resolve(config).map(MixinConfigIndex.Hit::modId).orElse(null);
    }

    private static List<String> extractMixinConfigs(String line) {
        List<String> configs = new ArrayList<>();
        if (line == null) {
            return configs;
        }
        Matcher json = MIXIN_JSON_TOKEN.matcher(line);
        while (json.find()) {
            String token = json.group();
            if (token.toLowerCase(Locale.ROOT).contains("refmap")) {
                continue;
            }
            configs.add(token);
        }
        return configs;
    }

    private static boolean isVanillaPackage(String pkg) {
        if (pkg == null || pkg.isBlank()) {
            return false;
        }
        String p = pkg.replace('/', '.').toLowerCase(Locale.ROOT);
        return p.startsWith("net.minecraft")
                || p.startsWith("com.mojang")
                || p.equals("minecraft");
    }

    private static String modVersion(JsonArray mods, String id) {
        if (mods == null || id == null) {
            return null;
        }
        for (JsonElement el : mods) {
            if (!el.isJsonObject()) {
                continue;
            }
            JsonObject mod = el.getAsJsonObject();
            String mid = str(mod, "id");
            if (mid == null) {
                mid = str(mod, "mod_id");
            }
            if (id.equalsIgnoreCase(mid)) {
                return str(mod, "version");
            }
        }
        return null;
    }

    private static JsonArray hintsOom(String oomKind) {
        if ("native".equals(oomKind)) {
            return toArray(List.of(
                    "Native/direct memory exhausted — do not raise -Xmx as the first fix.",
                    "Lower direct-buffer / native pressure, or raise OS RAM / page file.",
                    "Check for native leaks (too many threads, worldgen, or conflicting render libs); FerriteCore / ModernFix tips can help."));
        }
        return toArray(List.of(
                "Confirm the pack needs more heap before raising RAM — oversized packs and leaks look the same.",
                "Increase Java heap (-Xmx) only if the host still has free RAM; otherwise find leaks or shrink the pack.",
                "Check duplicate mods, oversized chunk loaders, or run Spark heap analysis."));
    }

    /**
     * Fix hints when the OS / container OOM-killer terminated the JVM (no Minecraft crash report).
     */
    public static JsonArray hintsExternalKillOom() {
        return toArray(List.of(
                "The server process was killed by the OS or container out-of-memory killer — nothing in Minecraft crashed.",
                "Raise the container / host memory limit, or lower -Xmx so the JVM fits under the limit.",
                "Open Insights → Configs for the RAM sizing advisor before changing flags.",
                "Leave 1–2 GB above -Xmx for JVM overhead and the OS."));
    }

    /**
     * Fix hints when the process was force-killed from outside (panel watchdog / SIGKILL) with no crash report.
     *
     * @param kernelLogReadable when false, also warn that an OOM kill cannot be ruled out
     */
    public static JsonArray hintsExternalKillPanel(boolean kernelLogReadable) {
        List<String> hints = new ArrayList<>();
        hints.add("The server was terminated from outside the JVM with no clean shutdown and no crash report.");
        hints.add("Raise the panel stop / watchdog timeout so a slow world save is not force-killed.");
        hints.add("Check panel logs around the kill time for stop / kill / restart commands.");
        if (!kernelLogReadable) {
            hints.add("Kernel logs are unreadable here, so an OS out-of-memory kill cannot be ruled out — "
                    + "also check your memory limit in Insights → Configs.");
        }
        return toArray(hints);
    }

    private static String stripTrailingPunct(String s) {
        if (s == null) {
            return null;
        }
        return s.replaceAll("[,:;]+$", "").strip();
    }

    private static String categoryToFailureKind(String category) {
        if (category == null) {
            return FK_UNKNOWN;
        }
        return switch (category) {
            case "mod" -> FK_MOD_RUNTIME;
            case "host_resource" -> FK_HOST_RESOURCE;
            case "loader" -> FK_LOADER;
            default -> FK_UNKNOWN;
        };
    }

    private static boolean isSparkShutdownNoise(String scanText, String combined, String stackText) {
        String blob = ((scanText != null ? scanText : "") + " "
                + (combined != null ? combined : "") + " "
                + (stackText != null ? stackText : "")).toLowerCase(Locale.ROOT);
        if (!blob.contains("profiler job no longer active")) {
            return false;
        }
        return blob.contains("handleserverstopping")
                || blob.contains("neoforgeserversparkplugin")
                || (blob.contains("ondisable") && blob.contains("spark"));
    }

    private static boolean isOpacApiVersionMismatch(
            String scanText,
            String combined,
            String exception,
            String primary,
            String suspect,
            String stackText) {
        String blob = ((scanText != null ? scanText : "") + " "
                + (combined != null ? combined : "") + " "
                + (stackText != null ? stackText : "") + " "
                + (exception != null ? exception : "")).toLowerCase(Locale.ROOT);
        if (!blob.contains("nosuchmethoderror")) {
            return false;
        }
        boolean opacCaller = "opac_better_commands".equals(primary)
                || "opac_better_commands".equals(suspect)
                || blob.contains("opac_better_commands");
        if (!opacCaller) {
            return false;
        }
        return blob.contains("xaero.pac")
                || blob.contains("getplayerconfigs")
                || blob.contains("openpartiesandclaims");
    }

    private static boolean isWatchdog(String combined, String exception, String root) {
        if (combined.contains("serverhangwatchdog") || combined.contains("single server tick took")) {
            return true;
        }
        if (combined.contains("watching server")) {
            return true;
        }
        return (exception != null && exception.contains("ServerHangWatchdog"))
                || (root != null && root.contains("ServerHangWatchdog"));
    }

    private static boolean isOom(String combined) {
        return combined.contains("outofmemoryerror")
                || combined.contains("java heap space")
                || combined.contains("direct buffer memory")
                || combined.contains("gc overhead limit")
                || combined.contains("unable to create new native thread");
    }

    private static boolean isWorldNbtCorrupt(String combined, String description, String exception, String root) {
        String desc = description != null ? description.toLowerCase(Locale.ROOT) : "";
        boolean nbtDesc = desc.contains("loading nbt") || desc.contains("nbt data");
        boolean zlib = combined.contains("zlib") || combined.contains("unexpected end of zlib")
                || combined.contains("eofexception");
        boolean nbtStack = combined.contains("nbtio") || combined.contains("chunkserializer")
                || (exception != null && exception.toLowerCase(Locale.ROOT).contains("nbt"))
                || (root != null && root.toLowerCase(Locale.ROOT).contains("nbt"));
        return (nbtDesc && (zlib || nbtStack)) || (zlib && nbtStack);
    }

    private static boolean isHostResource(String combined, String exception) {
        if (isOom(combined) || isWatchdog(combined, exception, null)) {
            return true;
        }
        return exception != null && exception.contains("ServerHangWatchdog");
    }

    private static boolean isModLoad(String combined, String failure, String exception) {
        if (combined.contains("modloadingcrash")
                || combined.contains("mod loading has failed")
                || combined.contains("modloadingexception")
                || combined.contains("fmlmodloading")
                || combined.contains("mod loading error")) {
            return true;
        }
        if (failure != null && failure.toLowerCase(Locale.ROOT).contains("mod")) {
            return true;
        }
        return exception != null && (exception.contains("ModLoading") || exception.contains("ModException"));
    }

    private static boolean isModRelated(String combined, String modFile, String exception,
                                        String description, String primary, String stackText) {
        // G-13: reject placeholder Mod File values
        if (modFile != null && !modFile.isBlank() && sanitizeModId(modFile) != null
                && !modFile.equals("java.lang.Error")) {
            return true;
        }
        if (primary != null) {
            return true;
        }
        if (combined.contains("modloadingcrash")
                || combined.contains("mod loading has failed")
                || combined.contains("modloadingexception")
                || combined.contains("fmlmodloading")) {
            return true;
        }
        if (exception != null && (exception.contains("ModLoading") || exception.contains("ModException"))) {
            return true;
        }
        // G-02: description / stack evidence
        if (description != null) {
            String d = description.toLowerCase(Locale.ROOT);
            if (d.contains("mod") || d.contains("mixin") || d.contains("contraption")) {
                return true;
            }
        }
        if (stackText != null && TRANSFORMER_MOD.matcher(stackText).find()) {
            return true;
        }
        return FML_MOD_ID.matcher(combined).find();
    }

    private static boolean isLoader(String combined) {
        return isLoader(combined, null, null);
    }

    private static boolean isLoader(String combined, String stackText, String scanText) {
        String blob = ((combined != null ? combined : "") + " "
                + (stackText != null ? stackText : "") + " "
                + (scanText != null ? scanText : "")).toLowerCase(Locale.ROOT);
        return blob.contains("neoforged")
                || blob.contains("net.neoforged")
                || blob.contains("cpw.mods")
                || blob.contains("fml early loading")
                || blob.contains("bootstraplauncher")
                || blob.contains("modlauncher");
    }

    private static String stallModFrom(JsonObject crash, String primary, String stackText, String combined) {
        String existing = sanitizeModId(str(crash, "stall_mod_id"));
        if (existing != null && PREGEN_STALL_MODS.contains(existing)) {
            return existing;
        }
        if (primary != null && PREGEN_STALL_MODS.contains(primary)) {
            return primary;
        }
        for (String id : PREGEN_STALL_MODS) {
            if (combined.contains(id) || (stackText != null && stackText.toLowerCase(Locale.ROOT).contains(id))) {
                return id;
            }
        }
        // Pre-crash chunk_gen hint (optional enrichment path)
        if (crash.has("pre_crash") && crash.get("pre_crash").isJsonObject()) {
            JsonObject pre = crash.getAsJsonObject("pre_crash");
            if (pre.has("chunk_gen") && pre.get("chunk_gen").isJsonObject()) {
                JsonObject cg = pre.getAsJsonObject("chunk_gen");
                String source = str(cg, "source");
                if (source != null) {
                    String s = source.toLowerCase(Locale.ROOT);
                    if (s.contains("squaremap")) {
                        return "squaremap";
                    }
                    if (s.contains("bluemap")) {
                        return "bluemap";
                    }
                    if (s.contains("chunky")) {
                        return "chunky";
                    }
                }
            }
        }
        return null;
    }

    private static String stackBlob(JsonObject crash) {
        String light = str(crash, "light_stack");
        if (light != null && !light.isBlank()) {
            return light;
        }
        if (crash == null || !crash.has("stack_frames") || !crash.get("stack_frames").isJsonArray()) {
            return "";
        }
        StringBuilder sb = new StringBuilder();
        for (JsonElement el : crash.getAsJsonArray("stack_frames")) {
            if (el.isJsonObject()) {
                JsonObject o = el.getAsJsonObject();
                if (o.has("method")) {
                    sb.append(o.get("method").getAsString()).append(' ');
                }
                if (o.has("mod_id")) {
                    sb.append(o.get("mod_id").getAsString()).append(' ');
                }
            }
        }
        return sb.toString();
    }

    private static String firstTransformerMod(String text) {
        if (text == null || text.isBlank()) {
            return null;
        }
        Matcher m = TRANSFORMER_MOD.matcher(text);
        while (m.find()) {
            String id = sanitizeModId(m.group(1));
            if (id != null && !VANILLA_IDS.contains(id)) {
                return id;
            }
        }
        return null;
    }

    /** G-13: reject placeholder / useless mod ids. */
    public static String sanitizeModId(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String s = raw.strip();
        if (s.endsWith(".jar")) {
            s = s.substring(0, s.length() - 4);
        }
        int slash = Math.max(s.lastIndexOf('/'), s.lastIndexOf('\\'));
        if (slash >= 0) {
            s = s.substring(slash + 1);
        }
        String lower = s.toLowerCase(Locale.ROOT);
        if (PLACEHOLDER_MOD_IDS.contains(lower) || lower.contains("<no mod")) {
            return null;
        }
        if (lower.startsWith("java.") || lower.equals("error")) {
            return null;
        }
        // Strip version suffix from jar-ish names
        if (s.contains("-") && s.substring(s.lastIndexOf('-') + 1).matches("\\d+.*")) {
            s = s.substring(0, s.lastIndexOf('-'));
            lower = s.toLowerCase(Locale.ROOT);
        }
        if (PLACEHOLDER_MOD_IDS.contains(lower) || VANILLA_IDS.contains(lower)) {
            return null;
        }
        return lower;
    }

    private static String suspectModId(String modFile, String exception, String summary) {
        String fromFile = sanitizeModId(modFile);
        if (fromFile != null) {
            return fromFile;
        }
        Matcher mod = MOD_LOADING.matcher(exception != null ? exception : "");
        if (mod.find()) {
            return sanitizeModId(mod.group(1).strip());
        }
        Matcher fml = FML_MOD_ID.matcher((exception != null ? exception : "") + " " + (summary != null ? summary : ""));
        if (fml.find()) {
            return sanitizeModId(fml.group(1).strip());
        }
        Matcher ns = NAMESPACE.matcher(summary != null ? summary : "");
        if (ns.find()) {
            return sanitizeModId(ns.group(1));
        }
        return null;
    }

    private static JsonArray hintsMod(
            String suspectModId,
            String combined,
            JsonObject details,
            ClassifyContext ctx,
            String scanText) {
        List<String> hints = new ArrayList<>();
        boolean createContraption = details != null
                && CREATE_ISSUE_CONTRAPTION.equals(str(details, "create_issue"));
        String createVer = ctx != null ? modVersion(ctx.mods(), "create") : null;
        if (suspectModId != null && "create".equals(suspectModId)) {
            if (createContraption) {
                hints.add("Find the contraption controller / bearing and break it to stop the stuck assembly so the world can load.");
                hints.add("Reduce stress or split oversized contraptions near the crash location.");
                if (createVer != null && createVer.startsWith("6.0.10")) {
                    hints.add("Create 6.0.10 has a known contraption collision NPE — update Create when a fixed build is available, or temporarily roll back to 6.0.9.");
                } else {
                    hints.add("Update Create if a newer NeoForge build exists; check the Create issue tracker for collision NPEs.");
                }
                List<String> colliderAddons = colliderMixinAddonsPresent(ctx);
                if (!colliderAddons.isEmpty()) {
                    hints.add("Also check collider-mixin addons (" + String.join(", ", colliderAddons)
                            + ") for versions matching Create.");
                }
            } else {
                boolean outdated = details != null && details.has("modrinth_outdated")
                        && details.get("modrinth_outdated").getAsBoolean();
                if (outdated || (createVer != null && createVer.startsWith("6.0.10"))) {
                    hints.add("Update Create to a matching NeoForge build, then restart and watch for repeats.");
                } else {
                    hints.add("Inspect the Create stack frames and update matching Create addons if versions look mismatched.");
                }
                hints.add("Restart the server and watch for repeats after any jar change.");
                if (scanMentionsFlywheel(scanText) || scanMentionsFlywheel(combined)) {
                    hints.add("Flywheel appears on the stack — remove conflicting separate Flywheel jars (Create bundles the matching one).");
                }
            }
        } else if (suspectModId != null) {
            hints.add("Update or temporarily remove mod '" + suspectModId + "', then restart.");
            if (combined != null && (combined.contains("zip") || combined.contains("corrupt")
                    || combined.contains("invalid cen") || combined.contains("end header"))) {
                hints.add("Re-download the mod JAR from the official source — the jar may be corrupt.");
            }
        } else {
            hints.add("Open the crash report and find the mod cited in the stack trace.");
            hints.add("Update or remove the suspected mod, then restart the server.");
        }
        if (combined != null && combined.contains("mixin") && !createContraption) {
            hints.add("If mixins are involved, update both conflicting mods to versions tested together.");
        }
        return toArray(hints);
    }

    private static final List<String> COLLIDER_MIXIN_ADDONS = List.of(
            "createbigcannons", "aeronautics", "sable", "create_sa", "createaddition");

    private static List<String> colliderMixinAddonsPresent(ClassifyContext ctx) {
        List<String> found = new ArrayList<>();
        if (ctx == null || ctx.mods() == null) {
            return found;
        }
        for (String id : COLLIDER_MIXIN_ADDONS) {
            if (hasModId(ctx.mods(), id)) {
                found.add(id);
            }
        }
        return found;
    }

    private static boolean hasModId(JsonArray mods, String id) {
        return modVersion(mods, id) != null || findModRow(mods, id) != null;
    }

    private static JsonObject findModRow(JsonArray mods, String id) {
        if (mods == null || id == null) {
            return null;
        }
        for (JsonElement el : mods) {
            if (!el.isJsonObject()) {
                continue;
            }
            JsonObject mod = el.getAsJsonObject();
            String mid = str(mod, "id");
            if (mid == null) {
                mid = str(mod, "mod_id");
            }
            if (id.equalsIgnoreCase(mid)) {
                return mod;
            }
        }
        return null;
    }

    private static boolean scanMentionsFlywheel(String text) {
        if (text == null || text.isBlank()) {
            return false;
        }
        String lower = text.toLowerCase(Locale.ROOT);
        return lower.contains("flywheel") || lower.contains("dev.engine_room.flywheel")
                || lower.contains("com.jozufozu.flywheel");
    }

    /**
     * Evidence-backed Create runtime subtype. Only set when stack/exception support it —
     * never infer from mod id alone.
     */
    static String detectCreateIssue(String scanText) {
        if (scanText == null || scanText.isBlank()) {
            return null;
        }
        if (CREATE_CONTRAPTION_EVIDENCE.matcher(scanText).find()) {
            return CREATE_ISSUE_CONTRAPTION;
        }
        return null;
    }

    static String exceptionClassFrom(String exception, String scanText) {
        if (exception != null && !exception.isBlank()) {
            String first = exception.strip();
            int colon = first.indexOf(':');
            String head = colon > 0 ? first.substring(0, colon).strip() : first;
            if (head.contains(".") && (head.endsWith("Exception") || head.endsWith("Error"))) {
                return head;
            }
            Matcher m = EXCEPTION_CLASS.matcher(exception);
            if (m.find()) {
                return m.group(1);
            }
        }
        if (scanText != null) {
            Matcher m = EXCEPTION_CLASS.matcher(scanText);
            if (m.find()) {
                return m.group(1);
            }
        }
        return null;
    }

    private static JsonObject enrichModRuntimeDetails(String scanText, String linkedMod, String exception) {
        JsonObject details = new JsonObject();
        String exClass = exceptionClassFrom(exception, scanText);
        if (exClass != null) {
            details.addProperty("exception_class", exClass);
        }
        if ("create".equalsIgnoreCase(linkedMod)) {
            String issue = detectCreateIssue(scanText);
            if (issue != null) {
                details.addProperty("create_issue", issue);
            }
            if (scanText != null) {
                Matcher hot = CREATE_HOT_FRAME.matcher(scanText);
                if (hot.find()) {
                    details.addProperty("hot_frame", hot.group(1) + "." + hot.group(2));
                }
            }
        }
        return details;
    }

    private static JsonArray hintsWatchdogPregen(String stallMod) {
        List<String> hints = new ArrayList<>();
        hints.add("Pause Chunky / map pregen or reduce radius before changing RAM or other settings.");
        hints.add("Defer " + stallMod + " full render until pregen completes.");
        hints.add("Restart the server and watch MSPT before re-enabling pregen.");
        return toArray(hints);
    }

    private static JsonArray hintsWatchdog() {
        return toArray(List.of(
                "Read the watchdog thread dump — the stuck stack names the hang (mod, worldgen, or farm).",
                "Pause Chunky / Distant Horizons / map render only if pregen or those mods appear in the dump.",
                "If MSPT was high, reduce simulation distance or find chunk loaders / rogue entities."));
    }

    private static JsonArray hintsNbt() {
        return toArray(List.of(
                "Back up the world, then restore the affected region/chunk from a known-good backup.",
                "Only delete or repair the bad region file after the backup exists.",
                "Check disk health; ZLIB/EOF errors often mean incomplete writes."));
    }

    private static JsonArray hintsHostResource(String combined, String exception) {
        List<String> hints = new ArrayList<>();
        if (combined.contains("serverhangwatchdog") || (exception != null && exception.contains("ServerHangWatchdog"))) {
            return hintsWatchdog();
        } else if (combined.contains("outofmemory") || combined.contains("heap space")) {
            return hintsOom("heap");
        } else {
            hints.add("Host or JVM resource limit hit — review CPU, RAM, and disk at crash time.");
        }
        return toArray(hints);
    }

    private static JsonArray hintsLoader() {
        return toArray(List.of(
                "Open the crash report and read the root exception / Mod Resolution section first.",
                "Compare NeoForge and Minecraft versions with your modpack requirements.",
                "If still stuck, remove recently added mods one at a time until the server starts."));
    }

    private static JsonArray hintsUnknown() {
        return toArray(List.of(
                "Read the full crash report under crash-reports/ for the root exception.",
                "Search the mod id or exception online or in your pack's issue tracker.",
                "Acknowledge after review if the crash is historical and already resolved."));
    }

    private static JsonArray hintsApiVersionMismatch() {
        return toArray(List.of(
                "Align OPAC Better Commands with the installed OpenPartiesAndClaims version.",
                "Or remove opac_better_commands until it is compatible with your OPAC build."));
    }

    private static JsonArray hintsShutdownNoise() {
        return toArray(List.of(
                "This happened on the server shutdown or stop path — treat it as low-priority shutdown hygiene, not a mid-play crash.",
                "Safe to acknowledge if the server was already stopping; no urgent Spark update needed for this alone."));
    }

    private static JsonArray toArray(List<String> hints) {
        JsonArray arr = new JsonArray();
        hints.forEach(arr::add);
        return arr;
    }

    private static String str(JsonObject o, String key) {
        if (o == null || !o.has(key) || o.get(key).isJsonNull()) {
            return null;
        }
        return o.get(key).getAsString();
    }
}
