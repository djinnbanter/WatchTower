package dev.mcstatus.watchtower.core.report;

import dev.mcstatus.watchtower.core.collect.CollectSupport;
import dev.mcstatus.watchtower.core.collect.GzipLineReader;

import java.io.IOException;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Extracts mod IDs (and optional versions) from a regular log loading section.
 */
public final class DrModListFromLogParser {

    private static final Pattern LOGGER_MOD = Pattern.compile("\\[([a-z0-9_]+)/(?:INFO|WARN|ERROR|FATAL|DEBUG)\\]");
    private static final Pattern INIT_MOD = Pattern.compile("(?i)Initializing\\s+([a-z0-9_]+)\\s+mod");
    private static final Pattern MOD_ID_LINE = Pattern.compile("(?m)^\\s*Mod ID:\\s*([a-z0-9_]+)", Pattern.CASE_INSENSITIVE);
    private static final Pattern MOD_VERSION = Pattern.compile("(?m)^\\s*Mod Version:\\s*(\\S+)", Pattern.CASE_INSENSITIVE);
    private static final Pattern MOD_FILE = Pattern.compile("(?m)^\\s*Mod File:\\s*(\\S+)", Pattern.CASE_INSENSITIVE);

    private DrModListFromLogParser() {
    }

    public record ModEntry(String id, String version, String sourceFile, int line) {
    }

    public record ParsedModList(
            Path sourcePath,
            String zipEntryPath,
            Map<String, ModEntry> mods
    ) {
    }

    public static ParsedModList parse(Path logPath, String zipEntryPath) {
        Map<String, ModEntry> mods = new LinkedHashMap<>();
        String rel = logPath.getFileName().toString();
        try {
            GzipLineReader.forEachLine(logPath, (lineNo, line) -> {
                collectFromLine(line, lineNo, rel, mods);
            });
        } catch (IOException ignored) {
        }
        return new ParsedModList(logPath, zipEntryPath, mods);
    }

    private static void collectFromLine(String line, int lineNo, String rel, Map<String, ModEntry> mods) {
        Matcher logger = LOGGER_MOD.matcher(line);
        if (logger.find()) {
            String id = logger.group(1);
            if (!isFrameworkId(id)) {
                putMod(mods, id, null, rel, lineNo);
            }
        }
        Matcher init = INIT_MOD.matcher(line);
        if (init.find()) {
            putMod(mods, init.group(1).toLowerCase(), null, rel, lineNo);
        }
        Matcher modId = MOD_ID_LINE.matcher(line);
        if (modId.find()) {
            String id = modId.group(1).toLowerCase();
            String version = null;
            Matcher ver = MOD_VERSION.matcher(line);
            if (ver.find()) {
                version = ver.group(1);
            }
            putMod(mods, id, version, rel, lineNo);
        }
        Matcher modFile = MOD_FILE.matcher(line);
        if (modFile.find()) {
            String jar = modFile.group(1);
            String id = inferIdFromJar(jar);
            if (id != null) {
                putMod(mods, id, inferVersionFromJar(jar), rel, lineNo);
            }
        }
    }

    private static void putMod(Map<String, ModEntry> mods, String id, String version, String file, int line) {
        if (id == null || id.isBlank() || isFrameworkId(id)) {
            return;
        }
        id = id.toLowerCase();
        ModEntry existing = mods.get(id);
        if (existing == null || (version != null && existing.version() == null)) {
            mods.put(id, new ModEntry(id, version, file, line));
        }
    }

    private static boolean isFrameworkId(String id) {
        return switch (id.toLowerCase()) {
            case "minecraft", "neoforge", "forge", "fml", "modlauncher", "mixin", "slf4j" -> true;
            default -> false;
        };
    }

    private static String inferIdFromJar(String jar) {
        String base = jar;
        int slash = Math.max(base.lastIndexOf('/'), base.lastIndexOf('\\'));
        if (slash >= 0) {
            base = base.substring(slash + 1);
        }
        if (base.endsWith(".jar")) {
            base = base.substring(0, base.length() - 4);
        }
        int dash = base.indexOf('-');
        if (dash > 0) {
            return base.substring(0, dash).toLowerCase();
        }
        return base.toLowerCase();
    }

    private static String inferVersionFromJar(String jar) {
        String base = jar;
        int slash = Math.max(base.lastIndexOf('/'), base.lastIndexOf('\\'));
        if (slash >= 0) {
            base = base.substring(slash + 1);
        }
        if (base.endsWith(".jar")) {
            base = base.substring(0, base.length() - 4);
        }
        int dash = base.indexOf('-');
        if (dash > 0 && dash < base.length() - 1) {
            return base.substring(dash + 1);
        }
        return null;
    }
}
