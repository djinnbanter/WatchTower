package dev.mcstatus.watchtower.core.fs;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.collect.CraftyCollector;
import dev.mcstatus.watchtower.core.collect.LogPatterns;
import dev.mcstatus.watchtower.core.panel.PanelPaths;
import dev.mcstatus.watchtower.core.report.ReportConfig;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Stream;

/**
 * Read-only directory browser for dashboard backup folder picker.
 */
public final class FsBrowseService {

    public static final int MAX_ENTRIES = 200;

    private FsBrowseService() {
    }

    public static JsonObject listRoots(String serverDir, ReportConfig config, JsonArray lastSearchDirs) {
        JsonArray roots = new JsonArray();
        Set<String> seen = new HashSet<>();

        addRoot(roots, seen, serverDir, "Server directory");
        if (serverDir != null && !serverDir.isBlank()) {
            Path sd = Path.of(serverDir);
            Path watchtower = sd.resolve("watchtower");
            addRoot(roots, seen, watchtower.toString(), "Watchtower folder");
            Path craftyRoot = PanelPaths.craftyRootFromServerDir(sd);
            if (craftyRoot != null) {
                Path craftyBackups = craftyRoot.resolve("backups");
                addRoot(roots, seen, craftyBackups.toString(), "Crafty backups");
                String uuid = config.craftyServerUuid();
                if (uuid != null && !uuid.isBlank()) {
                    addRoot(roots, seen, craftyBackups.resolve(uuid).toString(), "Crafty server backups");
                }
                String folder = sd.getFileName().toString();
                if (!folder.isBlank()) {
                    addRoot(roots, seen, craftyBackups.resolve(folder).toString(), "Crafty backups (server folder)");
                }
            }
        }

        String backupDir = config.backupDir();
        if (backupDir != null && !backupDir.isBlank()) {
            addRoot(roots, seen, backupDir, "Configured BACKUP_DIR");
        }
        for (String extra : config.backupDirs()) {
            addRoot(roots, seen, extra, "Configured BACKUP_DIRS");
        }

        if (lastSearchDirs != null) {
            for (var el : lastSearchDirs) {
                if (el.isJsonPrimitive()) {
                    addRoot(roots, seen, el.getAsString(), "Previously searched");
                }
            }
        }

        JsonObject out = new JsonObject();
        out.add("roots", roots);
        return out;
    }

    public static JsonObject listDirectory(String pathStr) throws IOException {
        if (pathStr == null || pathStr.isBlank()) {
            throw new IOException("Path required");
        }
        if (pathStr.contains("..")) {
            throw new IOException("Invalid path");
        }

        Path dir = Path.of(pathStr).normalize();
        if (!Files.isDirectory(dir)) {
            throw new IOException("Not a directory");
        }
        Path realDir;
        try {
            realDir = dir.toRealPath();
        } catch (IOException e) {
            realDir = dir.toAbsolutePath().normalize();
        }

        JsonObject out = new JsonObject();
        out.addProperty("path", realDir.toString());

        JsonArray parentParts = new JsonArray();
        Path walk = realDir;
        List<Path> chain = new ArrayList<>();
        while (walk != null) {
            chain.add(walk);
            walk = walk.getParent();
        }
        for (int i = chain.size() - 1; i >= 0; i--) {
            parentParts.add(chain.get(i).toString());
        }
        out.add("breadcrumbs", parentParts);

        List<JsonObject> entries = new ArrayList<>();
        boolean truncated = false;
        try (Stream<Path> stream = Files.list(realDir)) {
            List<Path> children = stream
                    .sorted(Comparator.comparing(p -> p.getFileName().toString().toLowerCase(Locale.ROOT)))
                    .toList();
            int limit = Math.min(children.size(), MAX_ENTRIES);
            if (children.size() > MAX_ENTRIES) {
                truncated = true;
            }
            for (int i = 0; i < limit; i++) {
                Path p = children.get(i);
                entries.add(toEntry(p));
            }
        }

        JsonArray arr = new JsonArray();
        entries.forEach(arr::add);
        out.add("entries", arr);
        out.addProperty("truncated", truncated);
        out.addProperty("archive_count", countArchivesInDir(realDir));
        return out;
    }

    private static void addRoot(JsonArray roots, Set<String> seen, String path, String label) {
        if (path == null || path.isBlank()) {
            return;
        }
        Path p = Path.of(path);
        if (!Files.isDirectory(p)) {
            return;
        }
        String key;
        try {
            key = p.toRealPath().toString();
        } catch (IOException e) {
            key = p.toAbsolutePath().normalize().toString();
        }
        if (!seen.add(key)) {
            return;
        }
        JsonObject row = new JsonObject();
        row.addProperty("path", key);
        row.addProperty("label", label);
        row.addProperty("archive_count", countArchivesInDir(p));
        roots.add(row);
    }

    private static JsonObject toEntry(Path p) throws IOException {
        JsonObject row = new JsonObject();
        String name = p.getFileName().toString();
        row.addProperty("name", name);
        String pathKey;
        try {
            pathKey = p.toRealPath().toString();
        } catch (IOException e) {
            pathKey = p.toAbsolutePath().normalize().toString();
        }
        row.addProperty("path", pathKey);
        if (Files.isDirectory(p)) {
            row.addProperty("kind", "dir");
            row.addProperty("archive", false);
            row.addProperty("archive_count", countArchivesInDir(p));
        } else if (Files.isRegularFile(p)) {
            row.addProperty("kind", "file");
            boolean archive = isArchiveName(name);
            row.addProperty("archive", archive);
            if (archive) {
                try {
                    row.addProperty("size_bytes", Files.size(p));
                } catch (IOException ignored) {
                }
            }
        } else {
            row.addProperty("kind", "other");
            row.addProperty("archive", false);
        }
        return row;
    }

    static int countArchivesInDir(Path dir) {
        if (!Files.isDirectory(dir)) {
            return 0;
        }
        int count = 0;
        for (Path p : CraftyCollector.collectBackupEntries(dir)) {
            if (Files.isRegularFile(p) && isArchiveName(p.getFileName().toString())) {
                count++;
            }
        }
        return count;
    }

    static boolean isArchiveName(String name) {
        String low = name.toLowerCase(Locale.ROOT);
        for (String sfx : LogPatterns.BACKUP_SUFFIXES) {
            if (low.endsWith(sfx)) {
                return true;
            }
        }
        return false;
    }
}
