package dev.mcstatus.watchtower.core.collect;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.reflect.TypeToken;

import java.io.IOException;
import java.lang.reflect.Type;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Durable jar backups under {@code watchtower/mod-backups/} with an {@code index.json}.
 * Layout: {@code <modId>/<timestamp>__from__to/<basename>.jar} + {@code meta.json}.
 */
public final class ModMutateBackupStore {
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    private static final Type INDEX_TYPE = new TypeToken<List<BackupRecord>>() {}.getType();
    private static final int MAX_PER_MOD = 5;
    private static final DateTimeFormatter TS =
            DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss'Z'").withZone(java.time.ZoneOffset.UTC);

    public static final class BackupRecord {
        public String backup_id;
        public String mod_id;
        public String jar_basename;
        public String created_at;
        public String relative_dir;
        public String from_version;
        public String to_version;
        public String sha512;
        public String job_id;
        public String actor_id;
        public String actor_name;
        public String kind;
    }

    public static final class BackupMeta {
        public String backup_id;
        public String mod_id;
        public String jar_basename;
        public String created_at;
        public String from_version;
        public String to_version;
        public String sha512;
        public String size_bytes;
        public String job_id;
        public String actor_id;
        public String actor_name;
        public String kind;
        public String staging_filename;
    }

    public record Result(boolean ok, BackupRecord record, String errorCode, String message) {
        public static Result success(BackupRecord record) {
            return new Result(true, record, null, null);
        }

        public static Result fail(String code, String message) {
            return new Result(false, null, code, message);
        }
    }

    private final Path backupsDir;

    public ModMutateBackupStore(Path backupsDir) {
        this.backupsDir = Objects.requireNonNull(backupsDir, "backupsDir").toAbsolutePath().normalize();
    }

    public Path backupsDir() {
        return backupsDir;
    }

    /**
     * Copy {@code modsDir/jarBasename} into a new backup folder and append to the index.
     * Prunes older backups for the same mod (keeping last {@value MAX_PER_MOD}), never pruning
     * ids in {@code protectBackupIds}.
     */
    public Result createBackup(
            Path modsDir,
            String modId,
            String jarBasename,
            String fromVersion,
            String toVersion,
            String jobId,
            String actorId,
            String actorName,
            String kind,
            Set<String> protectBackupIds) {
        String safeMod = ModJarPaths.safeSegment(modId);
        if (safeMod == null) {
            return Result.fail("invalid_mod_id", "Invalid mod id");
        }
        Path live = ModJarPaths.resolveTopLevelJar(modsDir, jarBasename);
        if (live == null) {
            return Result.fail("invalid_jar", "Jar must be a top-level file under mods/");
        }
        if (!Files.isRegularFile(live)) {
            return Result.fail("not_found", "Jar not found: " + jarBasename);
        }

        String backupId = "bak_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16);
        String ts = TS.format(Instant.now());
        String fromSeg = sanitizeFolderToken(fromVersion, "from");
        String toSeg = sanitizeFolderToken(toVersion, "to");
        String folderName = ts + "__" + fromSeg + "__to__" + toSeg;
        Path destDir = backupsDir.resolve(safeMod).resolve(folderName).normalize();
        if (!destDir.startsWith(backupsDir)) {
            return Result.fail("path_escape", "Backup path escapes backups directory");
        }

        try {
            Files.createDirectories(destDir);
            Path destJar = destDir.resolve(live.getFileName().toString());
            Files.copy(live, destJar, StandardCopyOption.REPLACE_EXISTING);

            String sha512 = null;
            try {
                sha512 = ModrinthLookupService.sha512Hex(destJar);
            } catch (Exception ignored) {
                // optional checksum in meta
            }

            BackupMeta meta = new BackupMeta();
            meta.backup_id = backupId;
            meta.mod_id = safeMod;
            meta.jar_basename = live.getFileName().toString();
            meta.created_at = Instant.now().toString();
            meta.from_version = fromVersion;
            meta.to_version = toVersion;
            meta.sha512 = sha512;
            meta.size_bytes = String.valueOf(Files.size(destJar));
            meta.job_id = jobId;
            meta.actor_id = actorId;
            meta.actor_name = actorName;
            meta.kind = kind != null ? kind : "swap";
            Files.writeString(destDir.resolve("meta.json"), GSON.toJson(meta) + System.lineSeparator(),
                    StandardCharsets.UTF_8);

            BackupRecord record = new BackupRecord();
            record.backup_id = backupId;
            record.mod_id = safeMod;
            record.jar_basename = meta.jar_basename;
            record.created_at = meta.created_at;
            record.relative_dir = safeMod + "/" + folderName;
            record.from_version = fromVersion;
            record.to_version = toVersion;
            record.sha512 = sha512;
            record.job_id = jobId;
            record.actor_id = actorId;
            record.actor_name = actorName;
            record.kind = meta.kind;

            List<BackupRecord> index = loadIndex();
            index.add(record);
            pruneIndex(index, protectBackupIds != null ? protectBackupIds : Set.of());
            saveIndex(index);
            return Result.success(record);
        } catch (IOException e) {
            return Result.fail("io_error", e.getMessage() != null ? e.getMessage() : "backup failed");
        }
    }

    public Result createBackup(
            Path modsDir,
            String modId,
            String jarBasename,
            String fromVersion,
            String toVersion,
            String jobId,
            String actorId,
            String actorName,
            String kind) {
        return createBackup(modsDir, modId, jarBasename, fromVersion, toVersion,
                jobId, actorId, actorName, kind, Set.of());
    }

    public List<BackupRecord> listBackups(String modIdOptional) {
        List<BackupRecord> index = loadIndex();
        if (modIdOptional == null || modIdOptional.isBlank()) {
            return List.copyOf(index);
        }
        String wanted = modIdOptional.trim();
        return index.stream()
                .filter(r -> wanted.equalsIgnoreCase(r.mod_id))
                .collect(Collectors.toUnmodifiableList());
    }

    public BackupRecord findById(String backupId) {
        if (backupId == null || backupId.isBlank()) {
            return null;
        }
        for (BackupRecord r : loadIndex()) {
            if (backupId.equals(r.backup_id)) {
                return r;
            }
        }
        return null;
    }

    /**
     * Restore backup bytes into {@code modsDir} using the basename from meta.
     */
    public Result restore(Path modsDir, String backupId) {
        BackupRecord record = findById(backupId);
        if (record == null) {
            return Result.fail("not_found", "Unknown backup_id");
        }
        Path jarPath = resolveBackupJar(record);
        if (jarPath == null) {
            return Result.fail("path_escape", "Backup path invalid");
        }
        if (!Files.isRegularFile(jarPath)) {
            return Result.fail("not_found", "Backup jar missing on disk");
        }
        Path live = ModJarPaths.resolveTopLevelJar(modsDir, record.jar_basename);
        if (live == null) {
            return Result.fail("invalid_jar", "Invalid jar basename in backup meta");
        }
        try {
            Files.createDirectories(modsDir);
            Files.copy(jarPath, live, StandardCopyOption.REPLACE_EXISTING);
            return Result.success(record);
        } catch (IOException e) {
            return Result.fail("io_error", e.getMessage() != null ? e.getMessage() : "restore failed");
        }
    }

    /** Prune index + delete on-disk folders older than last {@value MAX_PER_MOD} per mod. */
    public void prune(Set<String> protectBackupIds) throws IOException {
        List<BackupRecord> index = loadIndex();
        pruneIndex(index, protectBackupIds != null ? protectBackupIds : Set.of());
        saveIndex(index);
    }

    private Path resolveBackupJar(BackupRecord record) {
        if (record.relative_dir == null || record.jar_basename == null) {
            return null;
        }
        String rel = record.relative_dir.replace('\\', '/');
        if (rel.contains("..") || rel.startsWith("/")) {
            return null;
        }
        Path dir = backupsDir.resolve(rel).normalize();
        if (!dir.startsWith(backupsDir)) {
            return null;
        }
        return ModJarPaths.resolveTopLevelJar(dir, record.jar_basename);
    }

    private void pruneIndex(List<BackupRecord> index, Set<String> protect) throws IOException {
        Set<String> protectIds = new HashSet<>(protect);
        List<String> modIds = index.stream()
                .map(r -> r.mod_id)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        Set<String> removeIds = new HashSet<>();
        for (String modId : modIds) {
            List<BackupRecord> forMod = index.stream()
                    .filter(r -> modId.equals(r.mod_id))
                    .sorted(Comparator.comparing(
                            (BackupRecord r) -> r.created_at != null ? r.created_at : "",
                            Comparator.reverseOrder()))
                    .toList();
            for (int i = 0; i < forMod.size(); i++) {
                BackupRecord r = forMod.get(i);
                if (i < MAX_PER_MOD) {
                    continue;
                }
                if (protectIds.contains(r.backup_id)) {
                    continue;
                }
                removeIds.add(r.backup_id);
            }
        }
        if (removeIds.isEmpty()) {
            return;
        }
        List<BackupRecord> remaining = new ArrayList<>();
        for (BackupRecord r : index) {
            if (removeIds.contains(r.backup_id)) {
                deleteBackupDir(r);
            } else {
                remaining.add(r);
            }
        }
        index.clear();
        index.addAll(remaining);
    }

    private void deleteBackupDir(BackupRecord r) {
        try {
            if (r.relative_dir == null) {
                return;
            }
            String rel = r.relative_dir.replace('\\', '/');
            if (rel.contains("..")) {
                return;
            }
            Path dir = backupsDir.resolve(rel).normalize();
            if (!dir.startsWith(backupsDir) || !Files.isDirectory(dir)) {
                return;
            }
            try (var walk = Files.walk(dir)) {
                walk.sorted(Comparator.reverseOrder()).forEach(p -> {
                    try {
                        Files.deleteIfExists(p);
                    } catch (IOException ignored) {
                    }
                });
            }
        } catch (IOException ignored) {
        }
    }

    private List<BackupRecord> loadIndex() {
        Path indexPath = backupsDir.resolve("index.json");
        if (!Files.isRegularFile(indexPath)) {
            return new ArrayList<>();
        }
        try {
            String text = Files.readString(indexPath, StandardCharsets.UTF_8);
            List<BackupRecord> loaded = GSON.fromJson(text, INDEX_TYPE);
            return loaded != null ? new ArrayList<>(loaded) : new ArrayList<>();
        } catch (IOException e) {
            return new ArrayList<>();
        }
    }

    private void saveIndex(List<BackupRecord> index) throws IOException {
        Files.createDirectories(backupsDir);
        Path indexPath = backupsDir.resolve("index.json");
        Path temp = backupsDir.resolve("index.json.tmp");
        Files.writeString(temp, GSON.toJson(index) + System.lineSeparator(), StandardCharsets.UTF_8);
        try {
            Files.move(temp, indexPath, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
        } catch (IOException e) {
            Files.move(temp, indexPath, StandardCopyOption.REPLACE_EXISTING);
        }
    }

    private static String sanitizeFolderToken(String raw, String fallback) {
        if (raw == null || raw.isBlank()) {
            return fallback;
        }
        String cleaned = raw.trim()
                .replaceAll("[^A-Za-z0-9._-]+", "_")
                .replaceAll("_+", "_");
        if (cleaned.length() > 40) {
            cleaned = cleaned.substring(0, 40);
        }
        return cleaned.isBlank() ? fallback : cleaned.toLowerCase(Locale.ROOT);
    }
}
