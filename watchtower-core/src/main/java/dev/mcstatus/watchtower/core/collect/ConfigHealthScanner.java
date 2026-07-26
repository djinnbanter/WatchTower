package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.FileVisitResult;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.SimpleFileVisitor;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Properties;

/**
 * CA-22 config health — L3 scan of {@code config/} and world {@code serverconfig/}.
 * Skips {@code defaultconfigs/}. No deletion.
 */
public final class ConfigHealthScanner {

    private ConfigHealthScanner() {
    }

    public record Issue(String path, String reason, String modId, String severity) {
    }

    public static List<Issue> scan(Path serverDir) {
        List<Issue> issues = new ArrayList<>();
        if (serverDir == null || !Files.isDirectory(serverDir)) {
            return issues;
        }
        scanTree(serverDir.resolve("config"), serverDir, issues, 0);
        Path worldServerConfig = resolveWorldServerConfig(serverDir);
        if (worldServerConfig != null) {
            scanTree(worldServerConfig, serverDir, issues, 0);
        }
        return issues;
    }

    public static JsonArray toJson(List<Issue> issues) {
        JsonArray arr = new JsonArray();
        for (Issue i : issues) {
            JsonObject row = new JsonObject();
            row.addProperty("path", i.path());
            row.addProperty("reason", i.reason());
            if (i.modId() != null) {
                row.addProperty("mod_id", i.modId());
            }
            row.addProperty("severity", i.severity() != null ? i.severity() : "warning");
            arr.add(row);
        }
        return arr;
    }

    private static Path resolveWorldServerConfig(Path serverDir) {
        String world = ServerPropertiesReader.read(serverDir).levelName();
        Path sc = serverDir.resolve(world).resolve("serverconfig");
        return Files.isDirectory(sc) ? sc : null;
    }

    private static void scanTree(Path root, Path serverDir, List<Issue> issues, int depth) {
        if (root == null || !Files.isDirectory(root) || depth > 6) {
            return;
        }
        String rootName = root.getFileName() != null ? root.getFileName().toString() : "";
        if ("defaultconfigs".equalsIgnoreCase(rootName)) {
            return;
        }
        try {
            Files.walkFileTree(root, new SimpleFileVisitor<>() {
                @Override
                public FileVisitResult preVisitDirectory(Path dir, BasicFileAttributes attrs) {
                    String name = dir.getFileName() != null ? dir.getFileName().toString() : "";
                    if ("defaultconfigs".equalsIgnoreCase(name)) {
                        return FileVisitResult.SKIP_SUBTREE;
                    }
                    return FileVisitResult.CONTINUE;
                }

                @Override
                public FileVisitResult visitFile(Path file, BasicFileAttributes attrs) {
                    String name = file.getFileName().toString().toLowerCase(Locale.ROOT);
                    if (!(name.endsWith(".toml") || name.endsWith(".json") || name.endsWith(".properties"))) {
                        return FileVisitResult.CONTINUE;
                    }
                    Issue issue = checkFile(file, serverDir);
                    if (issue != null) {
                        issues.add(issue);
                    }
                    return FileVisitResult.CONTINUE;
                }
            });
        } catch (IOException ignored) {
            // skip unreadable tree
        }
    }

    private static Issue checkFile(Path file, Path serverDir) {
        String rel;
        try {
            rel = serverDir.relativize(file.toAbsolutePath().normalize()).toString().replace('\\', '/');
        } catch (Exception e) {
            rel = file.toString().replace('\\', '/');
        }
        try {
            if (Files.size(file) == 0) {
                return new Issue(rel, "empty", guessModFromName(file.getFileName().toString()), "warning");
            }
            String lower = file.getFileName().toString().toLowerCase(Locale.ROOT);
            String text = Files.readString(file, StandardCharsets.UTF_8);
            if (lower.endsWith(".json")) {
                JsonParser.parseString(text);
            } else if (lower.endsWith(".properties")) {
                Properties props = new Properties();
                props.load(new java.io.StringReader(text));
            } else if (lower.endsWith(".toml")) {
                // Lightweight TOML sanity: balanced quotes + no NULs; full NightConfig optional
                if (text.indexOf('\0') >= 0) {
                    return new Issue(rel, "parse_error", guessModFromName(file.getFileName().toString()), "warning");
                }
                long quotes = text.chars().filter(c -> c == '"').count();
                if (quotes % 2 != 0) {
                    return new Issue(rel, "parse_error", guessModFromName(file.getFileName().toString()), "warning");
                }
            }
        } catch (Exception e) {
            return new Issue(rel, "parse_error", guessModFromName(file.getFileName().toString()), "warning");
        }
        return null;
    }

    private static String guessModFromName(String fileName) {
        String base = fileName;
        int dot = base.lastIndexOf('.');
        if (dot > 0) {
            base = base.substring(0, dot);
        }
        if (base.toLowerCase(Locale.ROOT).endsWith("-server")) {
            base = base.substring(0, base.length() - 7);
        }
        if (base.toLowerCase(Locale.ROOT).endsWith("-common")) {
            base = base.substring(0, base.length() - 7);
        }
        return base.toLowerCase(Locale.ROOT);
    }
}
