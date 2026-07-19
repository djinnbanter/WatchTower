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

    public record ModDependency(String modId, String type, boolean mandatory, String side, String versionRange) {
        public ModDependency(String modId, String type, boolean mandatory, String side) {
            this(modId, type, mandatory, side, null);
        }
    }

    public record JarInJarEntry(
            String id,
            String version,
            String displayName,
            String nestedPath) {
    }

    public record ModEntry(
            String id,
            String version,
            String displayName,
            String description,
            String modLoader,
            String modType,
            List<ModDependency> dependencies,
            String jarFile,
            boolean mcreator,
            String loaderHint,
            List<String> mixinConfigs,
            List<JarInJarEntry> jarInJar) {

        public ModEntry(
                String id,
                String version,
                String displayName,
                String description,
                String modLoader,
                String modType,
                List<ModDependency> dependencies,
                String jarFile,
                boolean mcreator,
                String loaderHint,
                List<String> mixinConfigs) {
            this(id, version, displayName, description, modLoader, modType, dependencies,
                    jarFile, mcreator, loaderHint, mixinConfigs, List.of());
        }

        public ModEntry(
                String id,
                String version,
                String displayName,
                String description,
                String modLoader,
                String modType,
                List<ModDependency> dependencies,
                String jarFile,
                boolean mcreator,
                String loaderHint) {
            this(id, version, displayName, description, modLoader, modType, dependencies,
                    jarFile, mcreator, loaderHint, List.of(), List.of());
        }

        public List<String> nestedModIds() {
            if (jarInJar == null || jarInJar.isEmpty()) {
                return List.of();
            }
            List<String> ids = new ArrayList<>();
            for (JarInJarEntry e : jarInJar) {
                if (e.id() != null && !e.id().isBlank()) {
                    ids.add(e.id());
                }
            }
            return ids;
        }
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
        if (!mod.has("jar_file") && jarMeta.jarFile() != null && !jarMeta.jarFile().isBlank()) {
            mod.addProperty("jar_file", jarMeta.jarFile());
        }
        if (jarMeta.mcreator() && (!mod.has("is_mcreator") || !mod.get("is_mcreator").getAsBoolean())) {
            mod.addProperty("is_mcreator", true);
        }
        if (!mod.has("loader_hint") && jarMeta.loaderHint() != null && !jarMeta.loaderHint().isBlank()) {
            mod.addProperty("loader_hint", jarMeta.loaderHint());
        }
        if (!mod.has("mixin_configs")) {
            mod.add("mixin_configs", stringListToJson(jarMeta.mixinConfigs()));
        }
        if ((!mod.has("jar_in_jar") || mod.get("jar_in_jar").isJsonNull()
                || (mod.get("jar_in_jar").isJsonArray() && mod.getAsJsonArray("jar_in_jar").isEmpty()))
                && jarMeta.jarInJar() != null && !jarMeta.jarInJar().isEmpty()) {
            addJarInJarFields(mod, jarMeta.jarInJar());
        }
    }

    /** Nested mod id (lowercase) → parent top-level jar basename. */
    public static Map<String, String> nestedIdToParentJar(String serverDir) {
        Map<String, String> out = new HashMap<>();
        for (ModEntry e : readFromModsDir(serverDir)) {
            if (e.jarFile() == null || e.jarInJar() == null) {
                continue;
            }
            for (JarInJarEntry nested : e.jarInJar()) {
                if (nested.id() != null && !nested.id().isBlank()) {
                    out.putIfAbsent(nested.id().toLowerCase(Locale.ROOT), e.jarFile());
                }
            }
        }
        return out;
    }

    public static void addJarInJarFields(JsonObject mod, List<JarInJarEntry> jarInJar) {
        if (mod == null || jarInJar == null || jarInJar.isEmpty()) {
            return;
        }
        JsonArray arr = new JsonArray();
        JsonArray ids = new JsonArray();
        for (JarInJarEntry e : jarInJar) {
            if (e.id() == null || e.id().isBlank()) {
                continue;
            }
            JsonObject row = new JsonObject();
            row.addProperty("id", e.id());
            if (e.version() != null && !e.version().isBlank()) {
                row.addProperty("version", e.version());
            }
            if (e.displayName() != null && !e.displayName().isBlank()) {
                row.addProperty("display_name", e.displayName());
            }
            if (e.nestedPath() != null && !e.nestedPath().isBlank()) {
                row.addProperty("nested_path", e.nestedPath());
            }
            arr.add(row);
            ids.add(e.id());
        }
        if (!arr.isEmpty()) {
            mod.add("jar_in_jar", arr);
            mod.add("nested_mod_ids", ids);
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
        if (entry.jarFile() != null && !entry.jarFile().isBlank()) {
            mod.addProperty("jar_file", entry.jarFile());
        }
        if (entry.mcreator()) {
            mod.addProperty("is_mcreator", true);
        }
        if (entry.loaderHint() != null && !entry.loaderHint().isBlank()) {
            mod.addProperty("loader_hint", entry.loaderHint());
        }
        mod.add("mixin_configs", stringListToJson(entry.mixinConfigs()));
        if (entry.jarInJar() != null && !entry.jarInJar().isEmpty()) {
            addJarInJarFields(mod, entry.jarInJar());
        }
        return mod;
    }

    private static JsonArray stringListToJson(List<String> values) {
        JsonArray arr = new JsonArray();
        if (values != null) {
            for (String v : values) {
                if (v != null && !v.isBlank()) {
                    arr.add(v);
                }
            }
        }
        return arr;
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
            if (d.versionRange() != null && !d.versionRange().isBlank()) {
                dep.addProperty("versionRange", d.versionRange());
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
            boolean mcreator = false;
            boolean hasFabricMeta = zip.getEntry("fabric.mod.json") != null
                    || zip.getEntry("quilt.mod.json") != null;
            boolean hasNeoToml = zip.getEntry(TOML_PATH) != null
                    || zip.getEntry("META-INF/mods.toml") != null;
            LinkedHashMap<String, Boolean> mixinPaths = new LinkedHashMap<>();
            List<String> nestedJarPaths = new ArrayList<>();
            var entries = zip.entries();
            while (entries.hasMoreElements()) {
                ZipEntry ze = entries.nextElement();
                String name = ze.getName();
                if (name == null) {
                    continue;
                }
                if (name.startsWith("net/mcreator/")) {
                    mcreator = true;
                }
                if (isMixinConfigPath(name)) {
                    mixinPaths.putIfAbsent(name, Boolean.TRUE);
                }
                if (isOneLevelNestedJar(name)) {
                    nestedJarPaths.add(name);
                }
            }
            for (String nestedPath : nestedJarPaths) {
                collectNestedMixinConfigs(zip, nestedPath, mixinPaths);
            }
            List<JarInJarEntry> jarInJar = parseNestedJarMods(zip, nestedJarPaths);
            String loaderHint = (hasFabricMeta && !hasNeoToml) ? "fabric_in_neoforge_jar" : null;

            ZipEntry entry = zip.getEntry(TOML_PATH);
            if (entry == null) {
                entry = zip.getEntry("META-INF/mods.toml");
            }
            List<String> tomlMixins = List.of();
            String toml = null;
            if (entry != null) {
                try (InputStream in = zip.getInputStream(entry)) {
                    toml = new String(in.readAllBytes(), StandardCharsets.UTF_8);
                    tomlMixins = parseTomlMixinConfigs(toml);
                    for (String cfg : tomlMixins) {
                        mixinPaths.putIfAbsent(cfg, Boolean.TRUE);
                    }
                }
            }
            List<String> mixinConfigs = List.copyOf(mixinPaths.keySet());
            if (toml == null) {
                return List.of(fallbackFromFilename(jarPath, mcreator, loaderHint, mixinConfigs, jarInJar));
            }
            List<ParsedModBlock> blocks = parseTomlMods(toml);
            if (blocks.isEmpty()) {
                return List.of(fallbackFromFilename(jarPath, mcreator, loaderHint, mixinConfigs, jarInJar));
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
                        jarPath.getFileName().toString(),
                        mcreator,
                        loaderHint,
                        mixinConfigs,
                        jarInJar));
            }
            return out;
        } catch (IOException e) {
            return List.of(fallbackFromFilename(jarPath, false, null, List.of(), List.of()));
        }
    }

    /** Filename contains {@code mixin} and ends with {@code .json}; skip paths under {@code data/}. */
    static boolean isMixinConfigPath(String entryName) {
        if (entryName == null || entryName.isBlank()) {
            return false;
        }
        String normalized = entryName.replace('\\', '/');
        if (normalized.toLowerCase(Locale.ROOT).startsWith("data/")) {
            return false;
        }
        int slash = normalized.lastIndexOf('/');
        String file = slash >= 0 ? normalized.substring(slash + 1) : normalized;
        String lower = file.toLowerCase(Locale.ROOT);
        return lower.endsWith(".json") && lower.contains("mixin");
    }

    private static boolean isOneLevelNestedJar(String entryName) {
        if (entryName == null || !entryName.toLowerCase(Locale.ROOT).endsWith(".jar")) {
            return false;
        }
        String n = entryName.replace('\\', '/');
        return n.startsWith("META-INF/") && n.chars().filter(ch -> ch == '/').count() == 2;
    }

    private static void collectNestedMixinConfigs(ZipFile parent, String nestedPath,
                                                  LinkedHashMap<String, Boolean> mixinPaths) {
        ZipEntry nested = parent.getEntry(nestedPath);
        if (nested == null || nested.isDirectory()) {
            return;
        }
        try (InputStream in = parent.getInputStream(nested);
             java.util.zip.ZipInputStream zis = new java.util.zip.ZipInputStream(in)) {
            ZipEntry child;
            while ((child = zis.getNextEntry()) != null) {
                String name = child.getName();
                if (isMixinConfigPath(name)) {
                    mixinPaths.putIfAbsent(nestedPath + "!" + name, Boolean.TRUE);
                }
            }
        } catch (IOException ignored) {
            // best-effort jar-in-jar only
        }
    }


    /**
     * Parse nested jar tomls into {@link JarInJarEntry} rows (not emitted as top-level ModEntry).
     */
    static List<JarInJarEntry> parseNestedJarMods(ZipFile parent, List<String> nestedJarPaths) {
        if (nestedJarPaths == null || nestedJarPaths.isEmpty()) {
            return List.of();
        }
        LinkedHashMap<String, JarInJarEntry> byId = new LinkedHashMap<>();
        for (String nestedPath : nestedJarPaths) {
            ZipEntry nested = parent.getEntry(nestedPath);
            if (nested == null || nested.isDirectory()) {
                continue;
            }
            try (InputStream in = parent.getInputStream(nested);
                 java.util.zip.ZipInputStream zis = new java.util.zip.ZipInputStream(in)) {
                byte[] tomlBytes = null;
                ZipEntry child;
                while ((child = zis.getNextEntry()) != null) {
                    String name = child.getName();
                    if (name == null) {
                        continue;
                    }
                    String n = name.replace('\\', '/');
                    if (TOML_PATH.equals(n) || "META-INF/mods.toml".equals(n)) {
                        tomlBytes = zis.readAllBytes();
                        if (TOML_PATH.equals(n)) {
                            break;
                        }
                    }
                }
                if (tomlBytes == null || tomlBytes.length == 0) {
                    String file = nestedPath.replace('\\', '/');
                    int slash = file.lastIndexOf('/');
                    String base = slash >= 0 ? file.substring(slash + 1) : file;
                    if (base.toLowerCase(Locale.ROOT).endsWith(".jar")) {
                        base = base.substring(0, base.length() - 4);
                    }
                    String id = base;
                    int dash = base.indexOf('-');
                    if (dash > 0) {
                        id = base.substring(0, dash);
                    }
                    byId.putIfAbsent(id.toLowerCase(Locale.ROOT),
                            new JarInJarEntry(id, "?", null, nestedPath));
                    continue;
                }
                String toml = new String(tomlBytes, StandardCharsets.UTF_8);
                for (ParsedModBlock block : parseTomlMods(toml)) {
                    if (block.modId() == null || block.modId().isBlank()) {
                        continue;
                    }
                    byId.putIfAbsent(block.modId().toLowerCase(Locale.ROOT),
                            new JarInJarEntry(
                                    block.modId(),
                                    block.version() != null ? block.version() : "?",
                                    block.displayName(),
                                    nestedPath));
                }
            } catch (IOException ignored) {
                // best-effort
            }
        }
        return List.copyOf(byId.values());
    }

    static List<String> parseTomlMixinConfigs(String toml) {
        LinkedHashMap<String, Boolean> out = new LinkedHashMap<>();
        if (toml == null || toml.isBlank()) {
            return List.of();
        }
        for (String rawLine : toml.split("\\R")) {
            String line = rawLine.strip();
            if (line.isEmpty() || line.startsWith("#")) {
                continue;
            }
            int eq = line.indexOf('=');
            if (eq <= 0) {
                continue;
            }
            String key = line.substring(0, eq).strip();
            String value = unquote(line.substring(eq + 1).strip());
            if ("config".equals(key) || "mixinConfig".equalsIgnoreCase(key)
                    || "mixinConfigs".equalsIgnoreCase(key)) {
                if (value.startsWith("[") && value.endsWith("]")) {
                    String inner = value.substring(1, value.length() - 1);
                    for (String part : inner.split(",")) {
                        String cfg = unquote(part.strip());
                        if (!cfg.isBlank()) {
                            out.putIfAbsent(cfg, Boolean.TRUE);
                        }
                    }
                } else if (!value.isBlank()) {
                    out.putIfAbsent(value, Boolean.TRUE);
                }
            }
        }
        return List.copyOf(out.keySet());
    }

    private static ModEntry fallbackFromFilename(Path jarPath) {
        return fallbackFromFilename(jarPath, false, null, List.of(), List.of());
    }

    private static ModEntry fallbackFromFilename(Path jarPath, boolean mcreator, String loaderHint) {
        return fallbackFromFilename(jarPath, mcreator, loaderHint, List.of(), List.of());
    }

    private static ModEntry fallbackFromFilename(Path jarPath, boolean mcreator, String loaderHint,
                                                 List<String> mixinConfigs) {
        return fallbackFromFilename(jarPath, mcreator, loaderHint, mixinConfigs, List.of());
    }

    private static ModEntry fallbackFromFilename(Path jarPath, boolean mcreator, String loaderHint,
                                                 List<String> mixinConfigs, List<JarInJarEntry> jarInJar) {
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
        return new ModEntry(id, version, null, null, null, null, List.of(),
                jarPath.getFileName().toString(), mcreator, loaderHint,
                mixinConfigs != null ? mixinConfigs : List.of(),
                jarInJar != null ? jarInJar : List.of());
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
        String versionRange = fields.get("versionRange");
        if (versionRange != null && versionRange.isBlank()) {
            versionRange = null;
        }
        return new ModDependency(modId, type, mandatory, fields.get("side"), versionRange);
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
