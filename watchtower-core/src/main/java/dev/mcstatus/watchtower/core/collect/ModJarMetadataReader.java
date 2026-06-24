package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.DirectoryStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;

/**
 * Reads {@code META-INF/neoforge.mods.toml} from mod jars for offline metadata enrichment.
 */
public final class ModJarMetadataReader {

    private static final String TOML_PATH = "META-INF/neoforge.mods.toml";

    public record ModDependency(String modId, String type, boolean mandatory, String side) {
    }

    public record ModEntry(
            String id,
            String version,
            String displayName,
            String description,
            String modLoader,
            String modType,
            List<ModDependency> dependencies,
            String jarFile) {
    }

    private ModJarMetadataReader() {
    }

    public static JsonArray listModsFromDir(String serverDir) {
        List<ModEntry> entries = readFromModsDir(serverDir);
        JsonArray arr = new JsonArray();
        for (ModEntry e : entries) {
            arr.add(toJson(e));
        }
        return arr;
    }

    public static List<ModEntry> readFromModsDir(String serverDir) {
        Path modsDir = Path.of(serverDir, "mods");
        if (!Files.isDirectory(modsDir)) {
            return List.of();
        }
        Map<String, ModEntry> byId = new LinkedHashMap<>();
        try (DirectoryStream<Path> stream = Files.newDirectoryStream(modsDir, "*.jar")) {
            for (Path jar : stream) {
                for (ModEntry entry : readJar(jar)) {
                    byId.merge(entry.id(), entry, ModJarMetadataReader::preferEntry);
                }
            }
        } catch (IOException ignored) {
            return List.of();
        }
        List<ModEntry> sorted = new ArrayList<>(byId.values());
        sorted.sort(Comparator.comparing(ModEntry::id));
        return sorted;
    }

    public static void enrichModArray(JsonArray mods, String serverDir) {
        if (mods == null || mods.isEmpty()) {
            return;
        }
        Map<String, ModEntry> fromJars = new HashMap<>();
        for (ModEntry e : readFromModsDir(serverDir)) {
            fromJars.put(e.id(), e);
        }
        for (var el : mods) {
            if (!el.isJsonObject()) {
                continue;
            }
            JsonObject mod = el.getAsJsonObject();
            String id = str(mod, "id");
            if (id == null || id.isBlank()) {
                continue;
            }
            ModEntry jarMeta = fromJars.get(id);
            if (jarMeta == null) {
                continue;
            }
            mergeInto(mod, jarMeta);
        }
    }

    private static ModEntry preferEntry(ModEntry existing, ModEntry incoming) {
        if (existing.version() != null && !"?".equals(existing.version()) && !existing.version().isBlank()) {
            return existing;
        }
        return incoming;
    }

    private static void mergeInto(JsonObject mod, ModEntry jarMeta) {
        if (!mod.has("version") || "?".equals(str(mod, "version")) || str(mod, "version") == null) {
            if (jarMeta.version() != null && !jarMeta.version().isBlank()) {
                mod.addProperty("version", jarMeta.version());
            }
        }
        if (!mod.has("display_name") && jarMeta.displayName() != null && !jarMeta.displayName().isBlank()) {
            mod.addProperty("display_name", jarMeta.displayName());
        }
        if (!mod.has("description") && jarMeta.description() != null && !jarMeta.description().isBlank()) {
            mod.addProperty("description", jarMeta.description());
        }
        if (!mod.has("mod_type") && jarMeta.modType() != null && !jarMeta.modType().isBlank()) {
            mod.addProperty("mod_type", jarMeta.modType());
        }
        if (!mod.has("dependencies") && !jarMeta.dependencies().isEmpty()) {
            mod.add("dependencies", dependenciesToJson(jarMeta.dependencies()));
        }
    }

    public static JsonObject toJson(ModEntry entry) {
        JsonObject mod = new JsonObject();
        mod.addProperty("id", entry.id());
        mod.addProperty("version", entry.version() != null && !entry.version().isBlank() ? entry.version() : "?");
        if (entry.displayName() != null && !entry.displayName().isBlank()) {
            mod.addProperty("display_name", entry.displayName());
        }
        if (entry.description() != null && !entry.description().isBlank()) {
            mod.addProperty("description", entry.description());
        }
        if (entry.modType() != null && !entry.modType().isBlank()) {
            mod.addProperty("mod_type", entry.modType());
        }
        if (!entry.dependencies().isEmpty()) {
            mod.add("dependencies", dependenciesToJson(entry.dependencies()));
        }
        return mod;
    }

    private static JsonArray dependenciesToJson(List<ModDependency> deps) {
        JsonArray arr = new JsonArray();
        for (ModDependency d : deps) {
            JsonObject dep = new JsonObject();
            dep.addProperty("modId", d.modId());
            if (d.type() != null) {
                dep.addProperty("type", d.type());
            }
            dep.addProperty("mandatory", d.mandatory());
            if (d.side() != null) {
                dep.addProperty("side", d.side());
            }
            arr.add(dep);
        }
        return arr;
    }

    static List<ModEntry> readJar(Path jarPath) {
        if (!Files.isRegularFile(jarPath)) {
            return List.of();
        }
        try (ZipFile zip = new ZipFile(jarPath.toFile())) {
            ZipEntry entry = zip.getEntry(TOML_PATH);
            if (entry == null) {
                return List.of(fallbackFromFilename(jarPath));
            }
            try (InputStream in = zip.getInputStream(entry)) {
                String toml = new String(in.readAllBytes(), StandardCharsets.UTF_8);
                List<ParsedModBlock> blocks = parseTomlMods(toml);
                if (blocks.isEmpty()) {
                    return List.of(fallbackFromFilename(jarPath));
                }
                List<ModEntry> out = new ArrayList<>();
                for (ParsedModBlock block : blocks) {
                    out.add(new ModEntry(
                            block.modId(),
                            block.version() != null ? block.version() : versionFromFilename(jarPath, block.modId()),
                            block.displayName(),
                            block.description(),
                            block.modLoader(),
                            block.modType(),
                            block.dependencies(),
                            jarPath.getFileName().toString()));
                }
                return out;
            }
        } catch (IOException e) {
            return List.of(fallbackFromFilename(jarPath));
        }
    }

    private static ModEntry fallbackFromFilename(Path jarPath) {
        String name = jarPath.getFileName().toString();
        if (name.endsWith(".jar")) {
            name = name.substring(0, name.length() - 4);
        }
        String id = name;
        String version = "?";
        int dash = name.indexOf('-');
        if (dash > 0) {
            id = name.substring(0, dash);
            version = name.substring(dash + 1);
        }
        return new ModEntry(id, version, null, null, null, null, List.of(), jarPath.getFileName().toString());
    }

    private static String versionFromFilename(Path jarPath, String modId) {
        String name = jarPath.getFileName().toString();
        if (name.endsWith(".jar")) {
            name = name.substring(0, name.length() - 4);
        }
        String prefix = modId + "-";
        if (name.startsWith(prefix)) {
            return name.substring(prefix.length());
        }
        return "?";
    }

    private record ParsedModBlock(
            String modId,
            String version,
            String displayName,
            String description,
            String modLoader,
            String modType,
            List<ModDependency> dependencies) {
    }

    static List<ParsedModBlock> parseTomlMods(String toml) {
        List<ParsedModBlock> mods = new ArrayList<>();
        Map<String, String> modFields = new HashMap<>();
        Map<String, List<ModDependency>> depsByMod = new HashMap<>();
        Map<String, String> depFields = new HashMap<>();
        String depOwner = null;
        boolean inMod = false;

        for (String rawLine : toml.split("\\R")) {
            String line = rawLine.strip();
            if (line.isEmpty() || line.startsWith("#")) {
                continue;
            }
            if (line.startsWith("[[mods]]")) {
                flushDep(depOwner, depFields, depsByMod);
                depOwner = null;
                depFields = new HashMap<>();
                flushMod(mods, modFields);
                modFields = new HashMap<>();
                inMod = true;
                continue;
            }
            if (line.startsWith("[[dependencies.")) {
                inMod = false;
                flushMod(mods, modFields);
                modFields = new HashMap<>();
                flushDep(depOwner, depFields, depsByMod);
                depFields = new HashMap<>();
                int end = line.indexOf(']');
                depOwner = end > 15 ? line.substring(15, end) : null;
                continue;
            }
            if (line.startsWith("[[dependencies]]")) {
                inMod = false;
                flushMod(mods, modFields);
                modFields = new HashMap<>();
                flushDep(depOwner, depFields, depsByMod);
                depFields = new HashMap<>();
                depOwner = null;
                continue;
            }
            int eq = line.indexOf('=');
            if (eq <= 0) {
                continue;
            }
            String key = line.substring(0, eq).strip();
            String value = unquote(line.substring(eq + 1).strip());
            if (depOwner != null) {
                depFields.put(key, value);
                if ("modId".equals(key)) {
                    flushDep(depOwner, depFields, depsByMod);
                    depFields = new HashMap<>();
                }
            } else if (inMod && depOwner == null) {
                modFields.put(key, value);
            }
        }
        flushDep(depOwner, depFields, depsByMod);
        flushMod(mods, modFields);

        List<ParsedModBlock> merged = new ArrayList<>();
        for (ParsedModBlock block : mods) {
            List<ModDependency> deps = depsByMod.getOrDefault(block.modId(), List.of());
            merged.add(new ParsedModBlock(
                    block.modId(),
                    block.version(),
                    block.displayName(),
                    block.description(),
                    block.modLoader(),
                    block.modType(),
                    deps));
        }
        return merged;
    }

    private static void flushDep(String owner, Map<String, String> fields, Map<String, List<ModDependency>> depsByMod) {
        if (owner == null || owner.isBlank()) {
            return;
        }
        ModDependency dep = parseDependency(fields);
        if (dep == null) {
            return;
        }
        depsByMod.computeIfAbsent(owner, k -> new ArrayList<>()).add(dep);
    }

    private static void flushMod(List<ParsedModBlock> mods, Map<String, String> current) {
        if (current.isEmpty()) {
            return;
        }
        String modId = current.get("modId");
        if (modId == null || modId.isBlank()) {
            return;
        }
        mods.add(new ParsedModBlock(
                modId,
                current.get("version"),
                current.get("displayName"),
                current.get("description"),
                current.get("modLoader"),
                current.get("modType"),
                List.of()));
    }

    private static ModDependency parseDependency(Map<String, String> fields) {
        String modId = fields.get("modId");
        if (modId == null || modId.isBlank()) {
            return null;
        }
        String type = fields.getOrDefault("type", "required");
        boolean mandatory = !"optional".equalsIgnoreCase(type);
        if (fields.containsKey("mandatory")) {
            mandatory = Boolean.parseBoolean(fields.get("mandatory"));
        }
        return new ModDependency(modId, type, mandatory, fields.get("side"));
    }

    private static String unquote(String value) {
        if (value.startsWith("\"\"\"")) {
            int end = value.indexOf("\"\"\"", 3);
            return end > 0 ? value.substring(3, end).strip() : value.substring(3).strip();
        }
        if ((value.startsWith("\"") && value.endsWith("\""))
                || (value.startsWith("'") && value.endsWith("'"))) {
            return value.substring(1, value.length() - 1);
        }
        return value;
    }

    private static String str(JsonObject o, String key) {
        if (o == null || !o.has(key) || o.get(key).isJsonNull()) {
            return null;
        }
        return o.get(key).getAsString();
    }
}
