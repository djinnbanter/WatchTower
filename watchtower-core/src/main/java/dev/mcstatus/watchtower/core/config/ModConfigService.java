package dev.mcstatus.watchtower.core.config;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Properties;
import java.util.regex.Pattern;
import java.util.stream.Stream;

/**
 * Sandboxed list/read/save/undo for files under {@code config/}. Pure filesystem — no NeoForge.
 */
public final class ModConfigService {

    public static final int MAX_CONTENT_BYTES = 512 * 1024;
    public static final int MAX_BACKUPS_PER_FILE = 10;
    public static final String CONFIG_ROOT = "config";

    private static final DateTimeFormatter BAK_TS = DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss");
    private static final Pattern SECRET_KEY = Pattern.compile(
            "(?i)(password|token|secret|api[_-]?key)\\s*[=:]",
            Pattern.MULTILINE);

    private ModConfigService() {
    }

    public static final class ConflictException extends IOException {
        public ConflictException(String message) {
            super(message);
        }
    }

    public static final class OversizeException extends IOException {
        public OversizeException(String message) {
            super(message);
        }
    }

    /** Normalize and resolve under {@code serverDir/config}. Throws if escape attempted. */
    public static Path resolveConfigFile(Path serverDir, String relativePath) {
        if (serverDir == null) {
            throw new IllegalArgumentException("serverDir required");
        }
        String rel = normalizeRel(relativePath);
        if (!rel.startsWith(CONFIG_ROOT + "/")) {
            throw new IllegalArgumentException("path must be under config/");
        }
        Path configRoot = serverDir.resolve(CONFIG_ROOT).toAbsolutePath().normalize();
        Path target = serverDir.resolve(rel).toAbsolutePath().normalize();
        if (!target.startsWith(configRoot)) {
            throw new IllegalArgumentException("path escapes config/");
        }
        Path name = target.getFileName();
        if (name == null || !isAllowedName(name.toString())) {
            throw new IllegalArgumentException("file type not editable under config/");
        }
        if (Files.exists(target)) {
            try {
                Path realRoot = configRoot.toRealPath();
                Path realTarget = target.toRealPath();
                if (!realTarget.startsWith(realRoot)) {
                    throw new IllegalArgumentException("path escapes config/");
                }
                return realTarget;
            } catch (IOException e) {
                throw new IllegalArgumentException("cannot resolve config path: " + e.getMessage());
            }
        }
        return target;
    }

    public static List<JsonObject> list(Path serverDir) throws IOException {
        return list(serverDir, null);
    }

    public static List<JsonObject> list(Path serverDir, Path watchtowerDir) throws IOException {
        List<JsonObject> out = new ArrayList<>();
        Path configRoot = serverDir.resolve(CONFIG_ROOT);
        if (!Files.isDirectory(configRoot)) {
            return out;
        }
        try (Stream<Path> walk = Files.walk(configRoot)) {
            walk.filter(Files::isRegularFile).forEach(p -> {
                String name = p.getFileName().toString();
                if (!isAllowedName(name)) {
                    return;
                }
                try {
                    Path rel = serverDir.toAbsolutePath().normalize().relativize(p.toAbsolutePath().normalize());
                    String pathKey = rel.toString().replace('\\', '/');
                    if (!pathKey.startsWith(CONFIG_ROOT + "/")) {
                        return;
                    }
                    JsonObject row = new JsonObject();
                    row.addProperty("path", pathKey);
                    row.addProperty("size", Files.size(p));
                    row.addProperty("mtime", Files.getLastModifiedTime(p).toInstant().getEpochSecond());
                    row.addProperty("has_backup", watchtowerDir != null && hasBackup(watchtowerDir, pathKey));
                    String peek = peekForSecret(p);
                    row.addProperty("secret_hint", secretHint(peek));
                    out.add(row);
                } catch (IOException ignored) {
                }
            });
        }
        out.sort(Comparator.comparing(o -> o.get("path").getAsString()));
        return out;
    }

    public static JsonObject read(Path serverDir, String relativePath) throws IOException {
        Path file = resolveConfigFile(serverDir, relativePath);
        if (!Files.isRegularFile(file)) {
            throw new IOException("not found: " + normalizeRel(relativePath));
        }
        long size = Files.size(file);
        if (size > MAX_CONTENT_BYTES) {
            throw new OversizeException("file exceeds " + MAX_CONTENT_BYTES + " bytes");
        }
        String content = Files.readString(file, StandardCharsets.UTF_8);
        String pathKey = normalizeRel(relativePath);
        JsonObject out = new JsonObject();
        out.addProperty("path", pathKey);
        out.addProperty("content", content);
        out.addProperty("mtime", Files.getLastModifiedTime(file).toInstant().getEpochSecond());
        out.addProperty("size", size);
        out.addProperty("secret_hint", secretHint(content));
        JsonArray warnings = parseWarnings(pathKey, content);
        String lower = pathKey.toLowerCase(Locale.ROOT);
        if (lower.endsWith(".toml")) {
            TomlFormModel.ParseResult pr = TomlFormModel.parse(content);
            for (String w : pr.warnings()) {
                warnings.add(w);
            }
            if (pr.formOk()) {
                out.addProperty("editor", "form");
                out.add("fields", pr.fields());
            } else {
                out.addProperty("editor", "raw");
            }
        } else {
            out.addProperty("editor", "raw");
        }
        out.add("parse_warnings", warnings);
        return out;
    }

    /**
     * Patch form field values into the existing TOML (layout/comments preserved), then {@link #save}.
     *
     * @throws IllegalArgumentException if the field tree is invalid
     */
    public static JsonObject saveFields(
            Path serverDir,
            Path watchtowerDir,
            String relativePath,
            JsonArray fields,
            long expectedMtimeEpochSec
    ) throws IOException {
        Path file = resolveConfigFile(serverDir, relativePath);
        String original = "";
        if (Files.isRegularFile(file)) {
            original = Files.readString(file, StandardCharsets.UTF_8);
        }
        String content = TomlFormModel.applyValues(original, fields);
        return save(serverDir, watchtowerDir, relativePath, content, expectedMtimeEpochSec);
    }

    public static JsonObject save(
            Path serverDir,
            Path watchtowerDir,
            String relativePath,
            String content,
            long expectedMtimeEpochSec
    ) throws IOException {
        if (content == null) {
            content = "";
        }
        byte[] bytes = content.getBytes(StandardCharsets.UTF_8);
        if (bytes.length > MAX_CONTENT_BYTES) {
            throw new OversizeException("content exceeds " + MAX_CONTENT_BYTES + " bytes");
        }
        Path file = resolveConfigFile(serverDir, relativePath);
        String pathKey = normalizeRel(relativePath);
        Files.createDirectories(file.getParent());
        if (Files.isRegularFile(file)) {
            long actual = Files.getLastModifiedTime(file).toInstant().getEpochSecond();
            if (actual != expectedMtimeEpochSec) {
                throw new ConflictException("mtime mismatch: expected " + expectedMtimeEpochSec + " got " + actual);
            }
            String backupPath = writeBackup(watchtowerDir, pathKey, file);
            Files.writeString(file, content, StandardCharsets.UTF_8);
            pruneBackups(watchtowerDir, pathKey);
            return saveResult(pathKey, file, backupPath);
        }
        // new file — no prior mtime; allow create when expected is 0
        if (expectedMtimeEpochSec != 0L) {
            throw new ConflictException("file missing but expected_mtime was " + expectedMtimeEpochSec);
        }
        Files.writeString(file, content, StandardCharsets.UTF_8);
        return saveResult(pathKey, file, null);
    }

    public static JsonObject undo(Path serverDir, Path watchtowerDir, String relativePath) throws IOException {
        String pathKey = normalizeRel(relativePath);
        Path file = resolveConfigFile(serverDir, pathKey);
        Path newest = newestBackup(watchtowerDir, pathKey);
        if (newest == null) {
            throw new IOException("no backup for " + pathKey);
        }
        Files.createDirectories(file.getParent());
        Files.copy(newest, file, StandardCopyOption.REPLACE_EXISTING);
        JsonObject out = new JsonObject();
        out.addProperty("path", pathKey);
        out.addProperty("mtime", Files.getLastModifiedTime(file).toInstant().getEpochSecond());
        out.addProperty("size", Files.size(file));
        out.addProperty("restored_from", newest.toString().replace('\\', '/'));
        return out;
    }

    public static boolean secretHint(String text) {
        if (text == null || text.isBlank()) {
            return false;
        }
        return SECRET_KEY.matcher(text).find();
    }

    private static JsonObject saveResult(String pathKey, Path file, String backupPath) throws IOException {
        JsonObject out = new JsonObject();
        out.addProperty("path", pathKey);
        out.addProperty("mtime", Files.getLastModifiedTime(file).toInstant().getEpochSecond());
        out.addProperty("size", Files.size(file));
        if (backupPath != null) {
            out.addProperty("backup_path", backupPath);
        }
        return out;
    }

    private static String writeBackup(Path watchtowerDir, String pathKey, Path file) throws IOException {
        if (watchtowerDir == null) {
            throw new IOException("watchtowerDir required for backup");
        }
        Path dir = backupDirFor(watchtowerDir, pathKey);
        Files.createDirectories(dir);
        String stamp = LocalDateTime.now(ZoneId.systemDefault()).format(BAK_TS);
        Path bak = dir.resolve(stamp + ".bak");
        int n = 0;
        while (Files.exists(bak) && n < 20) {
            n++;
            bak = dir.resolve(stamp + "-" + n + ".bak");
        }
        Files.copy(file, bak, StandardCopyOption.REPLACE_EXISTING);
        return bak.toString().replace('\\', '/');
    }

    private static void pruneBackups(Path watchtowerDir, String pathKey) throws IOException {
        Path dir = backupDirFor(watchtowerDir, pathKey);
        if (!Files.isDirectory(dir)) {
            return;
        }
        List<Path> baks = new ArrayList<>();
        try (Stream<Path> stream = Files.list(dir)) {
            stream.filter(p -> p.getFileName().toString().endsWith(".bak")).forEach(baks::add);
        }
        baks.sort(Comparator.comparing(Path::getFileName).reversed());
        for (int i = MAX_BACKUPS_PER_FILE; i < baks.size(); i++) {
            Files.deleteIfExists(baks.get(i));
        }
    }

    private static boolean hasBackup(Path watchtowerDir, String pathKey) {
        try {
            return newestBackup(watchtowerDir, pathKey) != null;
        } catch (IOException e) {
            return false;
        }
    }

    private static Path newestBackup(Path watchtowerDir, String pathKey) throws IOException {
        if (watchtowerDir == null) {
            return null;
        }
        Path dir = backupDirFor(watchtowerDir, pathKey);
        if (!Files.isDirectory(dir)) {
            return null;
        }
        try (Stream<Path> stream = Files.list(dir)) {
            return stream
                    .filter(p -> p.getFileName().toString().endsWith(".bak"))
                    .max(Comparator.comparing(p -> p.getFileName().toString()))
                    .orElse(null);
        }
    }

    static Path backupDirFor(Path watchtowerDir, String pathKey) {
        // URL-safe base64 so config/a/b.toml and config/a__b.toml never share a folder.
        String encoded = java.util.Base64.getUrlEncoder().withoutPadding()
                .encodeToString(pathKey.replace('\\', '/').getBytes(StandardCharsets.UTF_8));
        return watchtowerDir.resolve("config-backups").resolve(encoded);
    }

    private static String normalizeRel(String relativePath) {
        if (relativePath == null || relativePath.isBlank()) {
            throw new IllegalArgumentException("path required");
        }
        String rel = relativePath.trim().replace('\\', '/');
        while (rel.startsWith("./")) {
            rel = rel.substring(2);
        }
        if (rel.startsWith("/") || rel.contains("..")) {
            throw new IllegalArgumentException("invalid path");
        }
        return rel;
    }

    private static boolean isAllowedName(String name) {
        String lower = name.toLowerCase(Locale.ROOT);
        if (lower.endsWith(".tmp") || lower.endsWith(".bak") || name.endsWith("~")) {
            return false;
        }
        return lower.endsWith(".toml")
                || lower.endsWith(".json")
                || lower.endsWith(".properties")
                || lower.endsWith(".cfg")
                || lower.endsWith(".txt");
    }

    private static String peekForSecret(Path file) {
        try {
            if (Files.size(file) > 64_000) {
                byte[] buf = Files.readAllBytes(file);
                int n = Math.min(buf.length, 8_192);
                return new String(buf, 0, n, StandardCharsets.UTF_8);
            }
            return Files.readString(file, StandardCharsets.UTF_8);
        } catch (IOException e) {
            return "";
        }
    }

    private static JsonArray parseWarnings(String pathKey, String content) {
        JsonArray warnings = new JsonArray();
        String lower = pathKey.toLowerCase(Locale.ROOT);
        try {
            if (lower.endsWith(".json")) {
                JsonParser.parseString(content);
            } else if (lower.endsWith(".properties")) {
                Properties props = new Properties();
                props.load(new java.io.StringReader(content));
            } else if (lower.endsWith(".toml")) {
                if (content.indexOf('\0') >= 0) {
                    warnings.add("TOML contains NUL bytes");
                }
                long quotes = content.chars().filter(c -> c == '"').count();
                if (quotes % 2 != 0) {
                    warnings.add("Unbalanced double quotes (possible TOML parse issue)");
                }
            }
        } catch (Exception e) {
            warnings.add("Parse warning: " + (e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName()));
        }
        return warnings;
    }
}
