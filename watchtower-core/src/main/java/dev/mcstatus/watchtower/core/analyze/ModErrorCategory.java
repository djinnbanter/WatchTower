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
    private static final Pattern NAMESPACE = Pattern.compile("([a-z][\\w]*):[\\w./_-]+");

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

        if (line.contains("[ERROR]") || line.contains("[FATAL]")) {
            Matcher logMod = LOGGER_MOD.matcher(line);
            if (logMod.find()) {
                String modId = logMod.group(2).strip().toLowerCase(Locale.ROOT);
                if (modId.contains(".")) {
                    modId = modId.substring(modId.lastIndexOf('.') + 1);
                }
                if (!isVanillaLogger(modId)) {
                    return new Hit(LOGGER_ERROR, modId, null, null);
                }
            }
        }

        return null;
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
                || modId.startsWith("cpw.mods");
    }
}
