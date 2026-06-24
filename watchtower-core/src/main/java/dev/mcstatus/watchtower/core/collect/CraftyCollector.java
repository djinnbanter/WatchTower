package dev.mcstatus.watchtower.core.collect;

import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.report.ReportConfig;
import dev.mcstatus.watchtower.core.panel.PanelPaths;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Stream;

/**
 * Crafty panel audit log and backup discovery (ported from build_staging).
 */
public final class CraftyCollector {

    private static final Gson GSON = new Gson();
    private static final Pattern CRAFTY_UUID_DIR = Pattern.compile(
            "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
            Pattern.CASE_INSENSITIVE);
    private static final DateTimeFormatter AUDIT_TS = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss,SSS");

    private CraftyCollector() {
    }

    public static void scanCraftyAudit(JsonObject staging, double cutoff, ReportConfig config) {
        String craftyApp = config.craftyApp();
        if (craftyApp == null || craftyApp.isBlank()) {
            return;
        }
        Path audit = Path.of(craftyApp, "logs", "audit.log");
        if (!Files.isRegularFile(audit)) {
            return;
        }

        List<JsonObject> cmds = new ArrayList<>();
        JsonObject counts = new JsonObject();
        counts.addProperty("start", 0);
        counts.addProperty("stop", 0);
        counts.addProperty("restart", 0);
        counts.addProperty("kill", 0);

        List<String> lines;
        try {
            lines = Files.readAllLines(audit, StandardCharsets.UTF_8);
        } catch (IOException e) {
            return;
        }
        int start = Math.max(0, lines.size() - 1000);
        for (int i = start; i < lines.size(); i++) {
            String line = lines.get(i);
            JsonObject row;
            try {
                row = GSON.fromJson(line, JsonObject.class);
            } catch (com.google.gson.JsonSyntaxException e) {
                continue;
            }
            String msg = CollectSupport.getString(row, "log_msg");
            String t = CollectSupport.getString(row, "time");
            if (!msg.contains("start_server") && !msg.contains("stop_server")
                    && !msg.contains("restart_server") && !msg.contains("kill_server")
                    && !msg.contains("pregen")) {
                continue;
            }
            ZonedDateTime ts = null;
            if (!t.isEmpty()) {
                try {
                    ts = java.time.LocalDateTime.parse(t, AUDIT_TS)
                            .atZone(ZoneId.of("UTC"))
                            .withZoneSameInstant(ZoneId.systemDefault());
                    if (CollectSupport.epochSeconds(ts) < cutoff) {
                        continue;
                    }
                } catch (Exception ignored) {
                    ts = null;
                }
            }

            JsonObject cmd = new JsonObject();
            cmd.addProperty("time", t);
            cmd.addProperty("cmd", msg);
            cmds.add(cmd);

            if (msg.contains("start_server")) {
                counts.addProperty("start", counts.get("start").getAsInt() + 1);
            }
            if (msg.contains("stop_server")) {
                counts.addProperty("stop", counts.get("stop").getAsInt() + 1);
            }
            if (msg.contains("restart_server")) {
                counts.addProperty("restart", counts.get("restart").getAsInt() + 1);
            }
            if (msg.contains("kill_server")) {
                counts.addProperty("kill", counts.get("kill").getAsInt() + 1);
            }

            JsonObject event = new JsonObject();
            event.addProperty("time", t.isEmpty() ? "" : t.replace(" ", "T"));
            event.addProperty("type", "panel_command");
            event.addProperty("source", "audit");
            event.addProperty("detail", msg);
            event.addProperty("importance", 6);
            CollectSupport.appendEvent(staging, event);
        }

        if (!cmds.isEmpty()) {
            JsonObject optional = staging.getAsJsonObject("optional");
            JsonArray cmdArr = new JsonArray();
            int from = Math.max(0, cmds.size() - 20);
            for (int i = from; i < cmds.size(); i++) {
                cmdArr.add(cmds.get(i));
            }
            optional.add("crafty_commands", cmdArr);
            optional.add("panel_command_counts", counts);
        }
    }

    public static Path backupDirForServer(ReportConfig config) {
        String configured = config.backupDir();
        if (configured != null && !configured.isBlank()) {
            Path p = Path.of(configured);
            return Files.isDirectory(p) ? p : null;
        }
        return null;
    }

    public static List<Path> discoverBackupDirs(ReportConfig config, String serverDir) {
        List<Path> dirs = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        for (String extra : config.backupDirs()) {
            if (extra == null || extra.isBlank()) {
                continue;
            }
            Path configured = Path.of(extra);
            addBackupDir(dirs, seen, configured);
            expandConfiguredBackupSubdirs(dirs, seen, configured, 2);
        }
        Path primary = backupDirForServer(config);
        if (primary != null) {
            addBackupDir(dirs, seen, primary);
            for (Path sub : backupSearchDirs(primary, serverDir)) {
                addBackupDir(dirs, seen, sub);
            }
        }
        return dirs;
    }

    private static void addBackupDir(List<Path> dirs, Set<String> seen, Path path) {
        if (path == null) {
            return;
        }
        try {
            if (!Files.isDirectory(path)) {
                return;
            }
            String key = path.toRealPath().toString();
            if (seen.add(key)) {
                dirs.add(path);
            }
        } catch (IOException e) {
            String key = path.toAbsolutePath().normalize().toString();
            if (seen.add(key)) {
                dirs.add(path);
            }
        }
    }

    public static List<Path> backupSearchDirs(Path backupDir, String serverDir) {
        List<Path> dirs = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        addBackupDir(dirs, seen, backupDir);
        if (serverDir != null && !serverDir.isBlank()) {
            addBackupDir(dirs, seen, backupDir.resolve(Path.of(serverDir).getFileName()));
        }
        expandConfiguredBackupSubdirs(dirs, seen, backupDir, 2);
        return dirs;
    }

    private static void expandConfiguredBackupSubdirs(List<Path> dirs, Set<String> seen, Path root, int depth) {
        if (depth <= 0 || root == null || !Files.isDirectory(root)) {
            return;
        }
        try (Stream<Path> stream = Files.list(root)) {
            for (Path child : stream.filter(Files::isDirectory).toList()) {
                addBackupDir(dirs, seen, child);
                expandConfiguredBackupSubdirs(dirs, seen, child, depth - 1);
            }
        } catch (IOException ignored) {
            // optional expansion under user-configured path
        }
    }

    public static boolean backupMatchesServer(Path path, String serverDir) {
        String serverName = Path.of(serverDir).getFileName().toString().toLowerCase(Locale.ROOT);
        String uuidPrefix = serverName.length() >= 8 ? serverName.substring(0, 8) : serverName;
        String name = path.getFileName().toString().toLowerCase(Locale.ROOT);
        return name.contains(uuidPrefix) || name.contains(serverName);
    }

    /**
     * Crafty, DiscoPanel, PufferPanel, MineOS, AMP, and similar layouts store backups under a
     * per-server directory (timestamp or generic filenames). Flat Wings stores use backup UUIDs.
     */
    public static boolean skipServerFilenameMatch(Path searchDir, String serverDir) {
        return backupSearchDirIsServerScoped(searchDir, serverDir)
                || backupSearchDirIsCraftyUuidFolder(searchDir)
                || backupSearchDirIsInstanceBackupsFolder(searchDir, serverDir)
                || backupSearchDirIsServerDataDir(searchDir, serverDir)
                || backupSearchDirIsFlatPanelStore(searchDir)
                || backupSearchDirIsMineOsServerBackup(searchDir, serverDir);
    }

    /** Crafty {@code backups/<server-uuid>/} — timestamp filenames do not embed the server id. */
    public static boolean backupSearchDirIsCraftyUuidFolder(Path searchDir) {
        if (searchDir == null) {
            return false;
        }
        Path parent = searchDir.getParent();
        if (parent == null || parent.getFileName() == null) {
            return false;
        }
        if (!"backups".equalsIgnoreCase(parent.getFileName().toString())) {
            return false;
        }
        Path fileName = searchDir.getFileName();
        return fileName != null && CRAFTY_UUID_DIR.matcher(fileName.toString()).matches();
    }

    /**
     * True when {@code dir} is {@code backups/<server-uuid>/} or any nested folder under it
     * (Crafty backup-job UUID subfolders).
     */
    public static boolean backupPathUnderCraftyServerBackup(Path dir, String serverDir, String craftyServerUuid) {
        String serverId = craftyServerId(serverDir, craftyServerUuid);
        if (serverId == null || dir == null) {
            return false;
        }
        Path walk = dir.normalize();
        while (walk != null) {
            Path parent = walk.getParent();
            if (parent != null && parent.getFileName() != null
                    && "backups".equalsIgnoreCase(parent.getFileName().toString())) {
                Path name = walk.getFileName();
                if (name != null && name.toString().equalsIgnoreCase(serverId)) {
                    return true;
                }
            }
            walk = parent;
        }
        return false;
    }

    public static boolean isUnderUserConfiguredBackupDir(Path dir, ReportConfig config) {
        if (dir == null || config == null) {
            return false;
        }
        Path normalized = normalizePath(dir);
        String primary = config.backupDir();
        if (primary != null && !primary.isBlank() && pathEqualsOrDescendant(normalized, Path.of(primary))) {
            return true;
        }
        for (String extra : config.backupDirs()) {
            if (extra != null && !extra.isBlank() && pathEqualsOrDescendant(normalized, Path.of(extra))) {
                return true;
            }
        }
        return false;
    }

    public static boolean trustBackupArchive(Path trustDir, String serverDir, ReportConfig config) {
        if (trustDir == null) {
            return false;
        }
        if (config != null && isUnderUserConfiguredBackupDir(trustDir, config)) {
            return true;
        }
        String craftyUuid = config != null ? config.craftyServerUuid() : "";
        return skipServerFilenameMatch(trustDir, serverDir)
                || backupPathUnderCraftyServerBackup(trustDir, serverDir, craftyUuid);
    }

    private static String craftyServerId(String serverDir, String craftyServerUuid) {
        if (craftyServerUuid != null && !craftyServerUuid.isBlank()) {
            return craftyServerUuid;
        }
        if (serverDir != null && !serverDir.isBlank()) {
            return Path.of(serverDir).getFileName().toString();
        }
        return null;
    }

    private static Path normalizePath(Path path) {
        try {
            return path.toRealPath();
        } catch (IOException e) {
            return path.toAbsolutePath().normalize();
        }
    }

    private static boolean pathEqualsOrDescendant(Path child, Path root) {
        Path r = normalizePath(root);
        Path c = normalizePath(child);
        return c.startsWith(r);
    }

    public static boolean backupSearchDirIsServerScoped(Path searchDir, String serverDir) {
        if (serverDir == null || serverDir.isBlank() || searchDir == null) {
            return false;
        }
        String serverName = Path.of(serverDir).getFileName().toString().toLowerCase(Locale.ROOT);
        if (serverName.isEmpty()) {
            return false;
        }
        Path fileName = searchDir.getFileName();
        if (fileName == null) {
            return false;
        }
        return fileName.toString().toLowerCase(Locale.ROOT).equals(serverName);
    }

    /** AMP {@code Instances/<name>/Backups/} and similar instance-local backup folders. */
    public static boolean backupSearchDirIsInstanceBackupsFolder(Path searchDir, String serverDir) {
        if (serverDir == null || serverDir.isBlank() || searchDir == null) {
            return false;
        }
        Path sd = Path.of(serverDir).normalize();
        Path parent = searchDir.getParent();
        if (parent == null || !parent.normalize().equals(sd)) {
            return false;
        }
        Path fileName = searchDir.getFileName();
        return fileName != null && "backups".equalsIgnoreCase(fileName.toString());
    }

    /** Multicraft world backups ({@code world.zip}) live in the server directory itself. */
    public static boolean backupSearchDirIsServerDataDir(Path searchDir, String serverDir) {
        if (serverDir == null || serverDir.isBlank() || searchDir == null) {
            return false;
        }
        return Path.of(serverDir).normalize().equals(searchDir.normalize());
    }

    /**
     * Pterodactyl/Pelican Wings local backups: {@code {backup-uuid}.tar.gz} in a flat node directory
     * (filename does not contain the server UUID).
     */
    public static boolean backupSearchDirIsFlatPanelStore(Path searchDir) {
        if (searchDir == null) {
            return false;
        }
        String norm = PanelPaths.normalizedPathString(searchDir);
        return norm.endsWith("/pterodactyl/backups")
                || norm.endsWith("/pelican/backups")
                || norm.equals("/var/lib/pterodactyl/backups")
                || norm.equals("/var/lib/pelican/backups");
    }

    /** MineOS: {@code .../backup/<server>/} or {@code .../archive/<server>/}. */
    public static boolean backupSearchDirIsMineOsServerBackup(Path searchDir, String serverDir) {
        if (serverDir == null || serverDir.isBlank() || searchDir == null) {
            return false;
        }
        String serverName = Path.of(serverDir).getFileName().toString().toLowerCase(Locale.ROOT);
        Path fileName = searchDir.getFileName();
        if (fileName == null || !fileName.toString().toLowerCase(Locale.ROOT).equals(serverName)) {
            return false;
        }
        Path parent = searchDir.getParent();
        if (parent == null || parent.getFileName() == null) {
            return false;
        }
        String parentName = parent.getFileName().toString().toLowerCase(Locale.ROOT);
        return "backup".equals(parentName) || "archive".equals(parentName);
    }

    public static List<Path> iterBackupCandidates(List<Path> searchDirs, String serverDir) {
        return iterBackupCandidates(searchDirs, serverDir, ReportConfig.builder().build());
    }

    public static List<Path> iterBackupCandidates(List<Path> searchDirs, String serverDir, ReportConfig config) {
        List<Path> candidates = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        for (Path root : searchDirs) {
            for (Path p : collectBackupEntries(root)) {
                if (!Files.isRegularFile(p)) {
                    continue;
                }
                String key;
                try {
                    key = p.toRealPath().toString();
                } catch (IOException e) {
                    key = p.toAbsolutePath().normalize().toString();
                }
                if (seen.contains(key)) {
                    continue;
                }
                String low = p.getFileName().toString().toLowerCase(Locale.ROOT);
                boolean suffixMatch = false;
                for (String sfx : LogPatterns.BACKUP_SUFFIXES) {
                    if (low.endsWith(sfx)) {
                        suffixMatch = true;
                        break;
                    }
                }
                if (!suffixMatch) {
                    continue;
                }
                Path trustDir = p.getParent() != null ? p.getParent() : root;
                if (!trustBackupArchive(trustDir, serverDir, config)
                        && serverDir != null && !serverDir.isBlank() && !backupMatchesServer(p, serverDir)) {
                    continue;
                }
                seen.add(key);
                candidates.add(p);
            }
        }
        return candidates;
    }

    public static void scanBackups(JsonObject staging, String serverDir, double cutoff, ReportConfig config) {
        JsonObject optional = staging.getAsJsonObject("optional");
        List<Path> searchDirs = discoverBackupDirs(config, serverDir);
        if (searchDirs.isEmpty()) {
            JsonObject unconfigured = new JsonObject();
            unconfigured.addProperty("status", "unconfigured");
            unconfigured.addProperty("hint", "Choose a backup folder in the dashboard Backups tab, or set BACKUP_DIR / BACKUP_DIRS in watchtower/watchtower.conf");
            optional.add("last_backup", unconfigured);
            return;
        }

        BackupScanStats stats = scanBackupDirs(searchDirs, serverDir, config);
        List<Path> candidates = stats.candidates();

        JsonArray searchedArr = new JsonArray();
        searchDirs.forEach(p -> searchedArr.add(p.toString()));

        if (candidates.isEmpty()) {
            JsonObject notFound = new JsonObject();
            notFound.addProperty("status", "not_found");
            notFound.addProperty("dir", searchDirs.getFirst().toString());
            notFound.addProperty("reason", stats.reason());
            notFound.addProperty("files_seen", stats.filesSeen());
            notFound.addProperty("files_matching_suffix", stats.filesMatchingSuffix());
            notFound.addProperty("files_matching_server", stats.filesMatchingServer());
            notFound.add("search_dirs", searchedArr);
            notFound.addProperty("searched_dirs", searchDirs.size());
            notFound.addProperty("inventory_count", 0);
            optional.add("last_backup", notFound);
            return;
        }

        candidates.sort(Comparator.comparingLong(p -> {
            try {
                return -Files.getLastModifiedTime(p).toMillis();
            } catch (IOException e) {
                return 0;
            }
        }));

        Path newest = candidates.getFirst();
        long mtime;
        long size;
        try {
            mtime = Files.getLastModifiedTime(newest).toMillis() / 1000L;
            size = Files.size(newest);
        } catch (IOException e) {
            return;
        }

        ZonedDateTime when = Instant.ofEpochSecond(mtime).atZone(ZoneId.systemDefault());
        double sizeGb = Math.round(size / (1024.0 * 1024.0 * 1024.0) * 10.0) / 10.0;
        boolean inWindow = mtime >= cutoff;

        JsonObject lastBackup = new JsonObject();
        lastBackup.addProperty("status", inWindow ? "success" : "stale");
        lastBackup.addProperty("path", newest.getFileName().toString());
        lastBackup.addProperty("size_gb", sizeGb);
        lastBackup.addProperty("time", CollectSupport.iso(when));
        lastBackup.addProperty("dir", searchDirs.getFirst().toString());
        lastBackup.add("search_dirs", searchedArr);
        lastBackup.addProperty("searched_dirs", searchDirs.size());
        lastBackup.addProperty("newest_on_disk", CollectSupport.iso(when));
        lastBackup.addProperty("newest_size_gb", sizeGb);
        double ageDays = Math.round((Instant.now().getEpochSecond() - mtime) / 86400.0 * 10.0) / 10.0;
        lastBackup.addProperty("age_days", ageDays);
        int warnDays = config.backupWarnDays();
        lastBackup.addProperty("warn_days", warnDays);
        lastBackup.addProperty("stale", Instant.now().getEpochSecond() - mtime > (long) warnDays * 86400L);

        JsonArray inventory = buildBackupInventory(candidates, serverDir, 15);
        lastBackup.addProperty("inventory_count", inventory.size());
        optional.add("backup_inventory", inventory);
        optional.add("last_backup", lastBackup);
    }

    private static JsonArray buildBackupInventory(List<Path> candidates, String serverDir, int limit) {
        JsonArray inventory = new JsonArray();
        int count = Math.min(limit, candidates.size());
        for (int i = 0; i < count; i++) {
            Path p = candidates.get(i);
            try {
                long mtime = Files.getLastModifiedTime(p).toMillis() / 1000L;
                long size = Files.size(p);
                ZonedDateTime when = Instant.ofEpochSecond(mtime).atZone(ZoneId.systemDefault());
                double sizeGb = Math.round(size / (1024.0 * 1024.0 * 1024.0) * 10.0) / 10.0;
                double ageDays = Math.round((Instant.now().getEpochSecond() - mtime) / 86400.0 * 10.0) / 10.0;
                JsonObject row = new JsonObject();
                row.addProperty("path", p.toString());
                row.addProperty("filename", p.getFileName().toString());
                row.addProperty("size_gb", sizeGb);
                row.addProperty("time", CollectSupport.iso(when));
                row.addProperty("age_days", ageDays);
                row.addProperty("matches_server",
                        backupMatchesServer(p, serverDir)
                                || skipServerFilenameMatch(p.getParent(), serverDir));
                inventory.add(row);
            } catch (IOException ignored) {
                // skip unreadable entry
            }
        }
        return inventory;
    }

    private record BackupScanStats(
            List<Path> candidates,
            int filesSeen,
            int filesMatchingSuffix,
            int filesMatchingServer,
            String reason
    ) {
    }

    private static BackupScanStats scanBackupDirs(List<Path> searchDirs, String serverDir, ReportConfig config) {
        List<Path> candidates = new ArrayList<>();
        int filesSeen = 0;
        int suffixMatch = 0;
        int serverMatch = 0;
        Set<String> seen = new HashSet<>();
        for (Path root : searchDirs) {
            for (Path p : collectBackupEntries(root)) {
                if (!Files.isRegularFile(p)) {
                    continue;
                }
                filesSeen++;
                String key;
                try {
                    key = p.toRealPath().toString();
                } catch (IOException e) {
                    key = p.toAbsolutePath().normalize().toString();
                }
                if (seen.contains(key)) {
                    continue;
                }
                String low = p.getFileName().toString().toLowerCase(Locale.ROOT);
                boolean hasSuffix = false;
                for (String sfx : LogPatterns.BACKUP_SUFFIXES) {
                    if (low.endsWith(sfx)) {
                        hasSuffix = true;
                        break;
                    }
                }
                if (!hasSuffix) {
                    continue;
                }
                suffixMatch++;
                Path trustDir = p.getParent() != null ? p.getParent() : root;
                if (!trustBackupArchive(trustDir, serverDir, config)
                        && serverDir != null && !serverDir.isBlank() && !backupMatchesServer(p, serverDir)) {
                    continue;
                }
                seen.add(key);
                serverMatch++;
                candidates.add(p);
            }
        }
        String reason;
        if (filesSeen == 0) {
            reason = "empty";
        } else if (suffixMatch == 0) {
            reason = "no_suffix_match";
        } else if (serverMatch == 0) {
            reason = "no_server_match";
        } else {
            reason = "none";
        }
        return new BackupScanStats(candidates, filesSeen, suffixMatch, serverMatch, reason);
    }

    /**
     * Lists regular files in {@code root}, plus archives in nested subdirectories (Crafty
     * {@code backups/<server-uuid>/<backup-job-uuid>/} layout).
     */
    public static List<Path> collectBackupEntries(Path root) {
        List<Path> entries = new ArrayList<>();
        collectBackupEntriesRecursive(root, entries, 0, 3);
        return entries;
    }

    private static void collectBackupEntriesRecursive(Path dir, List<Path> entries, int depth, int maxDepth) {
        if (depth > maxDepth || !Files.isDirectory(dir)) {
            return;
        }
        List<Path> subdirs = new ArrayList<>();
        try (Stream<Path> stream = Files.list(dir)) {
            for (Path p : stream.toList()) {
                if (Files.isRegularFile(p)) {
                    entries.add(p);
                } else if (Files.isDirectory(p)) {
                    subdirs.add(p);
                }
            }
        } catch (IOException ignored) {
            return;
        }
        if (depth < maxDepth) {
            for (Path sub : subdirs) {
                collectBackupEntriesRecursive(sub, entries, depth + 1, maxDepth);
            }
        }
    }
}
