package dev.mcstatus.watchtower.core.analyze;

import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Research-informed mod log error categories for NeoForge servers.
 */
public enum ModErrorCategory {
    RECIPE_MISSING_ITEM("recipe_missing_item", 3),
    RECIPE_COMPAT("recipe_compat", 2),
    RECIPE_FORMAT("recipe_format", 2),
    REGISTRY_MISSING("registry_missing", 2),
    LOOT_PARSE("loot_parse", 2),
    MOD_CORRUPT("mod_corrupt", 4),
    MOD_LOAD_FAILED("mod_load_failed", 5),
    CLIENT_ON_SERVER("client_on_server", 0),
    ENGINE_PACKAGING("engine_packaging", 5),
    KUBEJS_SCRIPT("kubejs_script", 3),
    CREATE_CONTRAPTION("create_contraption", 3),
    AE2_GRID("ae2_grid", 3),
    MOD_MISSING_MIGRATION("mod_missing_migration", 3),
    SERVER_CONFIG_CORRUPT("server_config_corrupt", 4),
    LOGGER_ERROR("logger_error", 1);

    public static final String CLIENT_ON_SERVER_DISPLAY = "Client-only classes on server";
    public static final String CLIENT_ON_SERVER_WHAT =
            "Some mods reference Minecraft client code; NeoForge blocks it on a dedicated server and logs ERROR.";
    public static final String CLIENT_ON_SERVER_WORRY =
            "Usually safe if TPS is healthy and there are no related crashes. Remove client-only mods from "
                    + "server mods/ to reduce noise, or update mods if crashes occur.";

    private final String id;
    private final int severityRank;

    ModErrorCategory(String id, int severityRank) {
        this.id = id;
        this.severityRank = severityRank;
    }

    public String id() {
        return id;
    }

    public int severityRank() {
        return severityRank;
    }

    public String briefLabel() {
        return switch (this) {
            case RECIPE_MISSING_ITEM -> "missing item";
            case RECIPE_COMPAT -> "recipe compat";
            case RECIPE_FORMAT -> "recipe format";
            case REGISTRY_MISSING -> "registry";
            case LOOT_PARSE -> "loot parse";
            case MOD_CORRUPT -> "corrupt jar";
            case MOD_LOAD_FAILED -> "load failed";
            case CLIENT_ON_SERVER -> "client-only class blocked";
            case ENGINE_PACKAGING -> "engine";
            case KUBEJS_SCRIPT -> "kubejs script";
            case CREATE_CONTRAPTION -> "create contraption";
            case AE2_GRID -> "ae2 grid";
            case MOD_MISSING_MIGRATION -> "missing migration";
            case SERVER_CONFIG_CORRUPT -> "server config corrupt";
            case LOGGER_ERROR -> "error";
        };
    }

    private static final Pattern RECIPE_PARSE = Pattern.compile(
            "Parsing error loading recipe\\s+(\\S+)", Pattern.CASE_INSENSITIVE);
    private static final Pattern UNKNOWN_ITEM = Pattern.compile(
            "Unknown item '([^']+)'", Pattern.CASE_INSENSITIVE);
    private static final Pattern PROVIDED_BY_MOD = Pattern.compile(
            "provided by mod\\s+(\\w+)", Pattern.CASE_INSENSITIVE);
    private static final Pattern MOD_LOADING = Pattern.compile(
            "Mod\\s+\\(([^)]+)\\)", Pattern.CASE_INSENSITIVE);
    private static final Pattern MOD_LOAD_FAIL_PATTERN = Pattern.compile(
            "Mod loading has failed|ModLoadingCrashException", Pattern.CASE_INSENSITIVE);
    private static final Pattern INGREDIENT_SERIALIZER = Pattern.compile(
            "ingredient_serializer\\]:\\s*(\\w+)", Pattern.CASE_INSENSITIVE);
    private static final Pattern LOGGER_MOD = Pattern.compile(
            "\\[(ERROR|FATAL)\\]\\s*\\[([^/\\]]+)/",
            Pattern.CASE_INSENSITIVE);
    private static final Pattern LOGGER_MOD_NEO = Pattern.compile(
            "/(?:ERROR|FATAL)\\]\\s*\\[([^/\\]]+)/",
            Pattern.CASE_INSENSITIVE);
    private static final Pattern NAMESPACE = Pattern.compile("([a-z][\\w]*):[\\w./_-]+");
    private static final Pattern CREATE_CONTRAPTION_PAT = Pattern.compile(
            "create.*(contraption|mf\\.axis|Collision)|(contraption|mf\\.axis|Collision).*create",
            Pattern.CASE_INSENSITIVE);
    private static final Pattern KUBEJS_ERROR_PAT = Pattern.compile(
            "(?:/ERROR]|/FATAL]|/ERROR/|\\[ERROR\\]|\\[FATAL\\]).*KubeJS"
                    + "|KubeJS.*(?:/ERROR]|/FATAL]|/ERROR/|\\[ERROR\\]|\\[FATAL\\]|Exception)",
            Pattern.CASE_INSENSITIVE);
    private static final Pattern AE2_GRID_PAT = Pattern.compile(
            "(?:Applied Energistics|\\bae2\\b).*(?:grid|channel|network)"
                    + "|(?:grid|channel|network).*(?:Applied Energistics|\\bae2\\b)",
            Pattern.CASE_INSENSITIVE);
    private static final Pattern MISSING_MIGRATION = Pattern.compile(
            "->\\s*MISSING\\b", Pattern.CASE_INSENSITIVE);

    public record Hit(ModErrorCategory category, String primaryMod, String relatedMod, String recipeId) {
    }

    public static Hit classify(String line) {
        if (line == null || line.isBlank()) {
            return null;
        }
        if (line.contains("dev.mcstatus.watchtower.core.report.ReportEngine")) {
            return new Hit(ENGINE_PACKAGING, "watchtower", null, null);
        }
        if (line.contains("Attempted to load class net/minecraft/client")) {
            return new Hit(CLIENT_ON_SERVER, "unknown", null, null);
        }

        // CA-04: SERVER NightConfig / FML config load failure (log line form)
        if (line.contains("ConfigLoadingException")
                && line.toLowerCase(Locale.ROOT).contains("of type server")) {
            Matcher serverToml = Pattern.compile(
                    "of type SERVER for modid\\s+(\\S+)", Pattern.CASE_INSENSITIVE).matcher(line);
            String modId = serverToml.find()
                    ? serverToml.group(1).replaceAll("[,.]+$", "").strip()
                    : namespaceFrom(line);
            return new Hit(SERVER_CONFIG_CORRUPT, modId != null ? modId : "unknown", null, null);
        }

        Matcher provided = PROVIDED_BY_MOD.matcher(line);
        if (provided.find() && line.toLowerCase(Locale.ROOT).contains("does not exist")) {
            return new Hit(MOD_CORRUPT, provided.group(1).strip(), null, null);
        }

        if (MOD_LOAD_FAIL_PATTERN.matcher(line).find()) {
            Matcher mod = MOD_LOADING.matcher(line);
            String modId = mod.find() ? mod.group(1).strip() : namespaceFrom(line);
            return new Hit(MOD_LOAD_FAILED, modId != null ? modId : "unknown", null, null);
        }

        Matcher recipe = RECIPE_PARSE.matcher(line);
        if (recipe.find()) {
            String recipeId = recipe.group(1).strip();
            String owner = namespaceOf(recipeId);
            String related = integrationMod(recipeId);
            ModErrorCategory cat = related != null ? RECIPE_COMPAT : RECIPE_FORMAT;
            if (line.contains("Unknown item") || line.contains("not found from registry")) {
                cat = RECIPE_MISSING_ITEM;
            }
            return new Hit(cat, owner, related, recipeId);
        }

        Matcher unknown = UNKNOWN_ITEM.matcher(line);
        if (unknown.find()) {
            String itemId = unknown.group(1).strip();
            return new Hit(RECIPE_MISSING_ITEM, namespaceOf(itemId), null, itemId);
        }

        if (line.contains("is not found from registry")) {
            String ns = namespaceFrom(line);
            return new Hit(REGISTRY_MISSING, ns != null ? ns : "unknown", null, null);
        }

        if (line.contains("Couldn't parse element ResourceKey")) {
            String ns = namespaceFrom(line);
            return new Hit(LOOT_PARSE, ns != null ? ns : "unknown", null, null);
        }

        if (line.contains("ingredient_serializer")) {
            Matcher ser = INGREDIENT_SERIALIZER.matcher(line);
            String missing = ser.find() ? ser.group(1) : namespaceFrom(line);
            return new Hit(RECIPE_FORMAT, missing != null ? missing : "unknown", null, null);
        }

        boolean isErrorLine = line.contains("[ERROR]") || line.contains("[FATAL]")
                || line.contains("/ERROR]") || line.contains("/FATAL]")
                || line.contains("/ERROR/") || line.contains("Exception");

        if (isErrorLine && CREATE_CONTRAPTION_PAT.matcher(line).find()) {
            return new Hit(CREATE_CONTRAPTION, "create", null, null);
        }

        if (KUBEJS_ERROR_PAT.matcher(line).find()) {
            return new Hit(KUBEJS_SCRIPT, "kubejs", null, null);
        }

        if (isErrorLine && AE2_GRID_PAT.matcher(line).find()) {
            return new Hit(AE2_GRID, "ae2", null, null);
        }

        if (MISSING_MIGRATION.matcher(line).find()) {
            String ns = namespaceFrom(line);
            return new Hit(MOD_MISSING_MIGRATION, ns != null ? ns : "unknown", null, null);
        }

        if (line.contains("[ERROR]") || line.contains("[FATAL]")
                || line.contains("/ERROR]") || line.contains("/FATAL]")) {
            Matcher logMod = LOGGER_MOD.matcher(line);
            if (logMod.find()) {
                String rawLogger = logMod.group(2).strip();
                String modId = resolveLoggerModId(rawLogger);
                if (modId != null) {
                    return new Hit(LOGGER_ERROR, modId, null, null);
                }
            }
            // NeoForge style: [Server thread/ERROR] [modid/]:
            Matcher neo = LOGGER_MOD_NEO.matcher(line);
            if (neo.find()) {
                String rawLogger = neo.group(1).strip();
                String modId = resolveLoggerModId(rawLogger);
                if (modId != null && !"minecraft".equals(modId)) {
                    return new Hit(LOGGER_ERROR, modId, null, null);
                }
            }
        }

        return null;
    }

    /**
     * Map a log bracket logger name to a mod id, or null when vanilla / ignore for mod peek.
     * Checks the full logger (e.g. {@code net.minecraft.world.item.ItemStack}) before truncating.
     */
    static String resolveLoggerModId(String rawLogger) {
        if (rawLogger == null || rawLogger.isBlank()) {
            return null;
        }
        String full = rawLogger.strip().toLowerCase(Locale.ROOT);
        if (isVanillaLogger(full)) {
            return null;
        }
        String tail = full;
        if (tail.contains(".")) {
            tail = tail.substring(tail.lastIndexOf('.') + 1);
        }
        if (VANILLA_LOGGER_TAILS.contains(tail)) {
            return null;
        }
        if (isVanillaLogger(tail)) {
            return null;
        }
        return tail;
    }

    private static String integrationMod(String recipeId) {
        if (recipeId == null) {
            return null;
        }
        String lower = recipeId.toLowerCase(Locale.ROOT);
        if (lower.contains("/integration/") || lower.contains("/compat/")) {
            int slash = lower.indexOf('/', lower.indexOf(':') + 1);
            if (slash > 0 && slash + 1 < lower.length()) {
                String segment = lower.substring(slash + 1);
                int next = segment.indexOf('/');
                if (next > 0) {
                    return segment.substring(0, next);
                }
            }
        }
        return null;
    }

    private static String namespaceOf(String resourceId) {
        if (resourceId == null || !resourceId.contains(":")) {
            return "unknown";
        }
        return resourceId.substring(0, resourceId.indexOf(':')).strip();
    }

    private static String namespaceFrom(String line) {
        Matcher m = NAMESPACE.matcher(line);
        if (m.find()) {
            String ns = m.group(1);
            if (!"minecraft".equals(ns) && !"neoforge".equals(ns)) {
                return ns;
            }
            if (m.find()) {
                return m.group(1);
            }
        }
        return null;
    }

    private static boolean isVanillaLogger(String modId) {
        return modId.startsWith("net.minecraft")
                || modId.startsWith("net.neoforged")
                || modId.startsWith("net.minecraftforge")
                || modId.startsWith("cpw.mods")
                || modId.startsWith("com.mojang");
    }

    /** Short class-logger tails after package truncation — not mods. */
    private static final java.util.Set<String> VANILLA_LOGGER_TAILS = java.util.Set.of(
            "itemstack",
            "blockattachedentity",
            "minecraftserver",
            "serverlevel",
            "serverplayer",
            "serverchunkcache",
            "chunkmap",
            "playerlist",
            "dedicatedserver",
            "commands",
            "main"
    );
}
