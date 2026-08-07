package dev.mcstatus.watchtower.core.collect;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Objects;
import java.util.Set;

/**
 * Path-safe jar swap / undo / quarantine under {@code mods/} with backups in
 * {@code watchtower/mod-backups/}. Caller verifies Modrinth hashes before apply.
 */
public final class ModJarSwap {
    private ModJarSwap() {
    }

    public record Result(
            boolean ok,
            String backupId,
            String jarBasename,
            String errorCode,
            String message) {
        public static Result success(String backupId, String jarBasename) {
            return new Result(true, backupId, jarBasename, null, null);
        }

        public static Result fail(String code, String message) {
            return new Result(false, null, null, code, message);
        }
    }

    public record SwapMeta(
            String fromVersion,
            String toVersion,
            String jobId,
            String actorId,
            String actorName,
            String stagingFilename) {
    }

    /**
     * Backup the live jar, then replace its bytes with {@code stagingFile} while
     * keeping {@code liveBasename}.
     */
    public static Result applySwap(
            Path modsDir,
            Path backupsDir,
            Path stagingFile,
            String modId,
            String liveBasename,
            SwapMeta meta) {
        Objects.requireNonNull(modsDir, "modsDir");
        Objects.requireNonNull(backupsDir, "backupsDir");
        if (stagingFile == null || !Files.isRegularFile(stagingFile)) {
            return Result.fail("staging_missing", "Staging jar not found");
        }
        Path live = ModJarPaths.resolveTopLevelJar(modsDir, liveBasename);
        if (live == null) {
            return Result.fail("invalid_jar", "Jar must be a top-level file under mods/");
        }
        if (!Files.isRegularFile(live)) {
            return Result.fail("not_found", "Live jar not found: " + liveBasename);
        }

        ModMutateBackupStore store = new ModMutateBackupStore(backupsDir);
        SwapMeta m = meta != null ? meta : new SwapMeta(null, null, null, null, null, null);
        ModMutateBackupStore.Result backup = store.createBackup(
                modsDir,
                modId,
                live.getFileName().toString(),
                m.fromVersion(),
                m.toVersion(),
                m.jobId(),
                m.actorId(),
                m.actorName(),
                ModMutateJob.KIND_SWAP);
        if (!backup.ok()) {
            return Result.fail(backup.errorCode(), backup.message());
        }

        Path temp = live.resolveSibling(live.getFileName().toString() + ".watchtower-tmp");
        try {
            Files.copy(stagingFile, temp, StandardCopyOption.REPLACE_EXISTING);
            try {
                Files.move(temp, live, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
            } catch (IOException atomicFail) {
                Files.move(temp, live, StandardCopyOption.REPLACE_EXISTING);
            }
            return Result.success(backup.record().backup_id, live.getFileName().toString());
        } catch (IOException e) {
            // Attempt restore from the backup we just wrote
            ModMutateBackupStore.Result restored = store.restore(modsDir, backup.record().backup_id);
            String msg = e.getMessage() != null ? e.getMessage() : "apply failed";
            if (!restored.ok()) {
                return Result.fail("needs_manual_repair",
                        msg + "; restore also failed: " + restored.message());
            }
            return Result.fail("io_error", msg);
        } finally {
            try {
                Files.deleteIfExists(temp);
            } catch (IOException ignored) {
            }
        }
    }

    /** Restore a prior backup into {@code mods/}. */
    public static Result undo(Path modsDir, Path backupsDir, String backupId) {
        if (backupId == null || backupId.isBlank()) {
            return Result.fail("invalid_backup", "backup_id required");
        }
        ModMutateBackupStore store = new ModMutateBackupStore(backupsDir);
        ModMutateBackupStore.Result restored = store.restore(modsDir, backupId);
        if (!restored.ok()) {
            return Result.fail(restored.errorCode(), restored.message());
        }
        return Result.success(restored.record().backup_id, restored.record().jar_basename);
    }

    /**
     * Move the live jar into backups and remove it from {@code mods/}.
     */
    public static Result quarantine(
            Path modsDir,
            Path backupsDir,
            String modId,
            String liveBasename,
            SwapMeta meta) {
        Path live = ModJarPaths.resolveTopLevelJar(modsDir, liveBasename);
        if (live == null) {
            return Result.fail("invalid_jar", "Jar must be a top-level file under mods/");
        }
        if (!Files.isRegularFile(live)) {
            return Result.fail("not_found", "Live jar not found: " + liveBasename);
        }

        ModMutateBackupStore store = new ModMutateBackupStore(backupsDir);
        SwapMeta m = meta != null ? meta : new SwapMeta(null, null, null, null, null, null);
        ModMutateBackupStore.Result backup = store.createBackup(
                modsDir,
                modId,
                live.getFileName().toString(),
                m.fromVersion(),
                "quarantined",
                m.jobId(),
                m.actorId(),
                m.actorName(),
                ModMutateJob.KIND_QUARANTINE);
        if (!backup.ok()) {
            return Result.fail(backup.errorCode(), backup.message());
        }
        try {
            Files.deleteIfExists(live);
            return Result.success(backup.record().backup_id, live.getFileName().toString());
        } catch (IOException e) {
            return Result.fail("io_error", e.getMessage() != null ? e.getMessage() : "quarantine delete failed");
        }
    }

    /** Undo latest backup for a mod (convenience). */
    public static Result undoLatest(Path modsDir, Path backupsDir, String modId) {
        ModMutateBackupStore store = new ModMutateBackupStore(backupsDir);
        var list = store.listBackups(modId);
        if (list.isEmpty()) {
            return Result.fail("not_found", "No backups for mod");
        }
        // listBackups preserves index order; pick newest by created_at
        ModMutateBackupStore.BackupRecord newest = list.stream()
                .max((a, b) -> {
                    String ca = a.created_at != null ? a.created_at : "";
                    String cb = b.created_at != null ? b.created_at : "";
                    return ca.compareTo(cb);
                })
                .orElse(null);
        if (newest == null) {
            return Result.fail("not_found", "No backups for mod");
        }
        return undo(modsDir, backupsDir, newest.backup_id);
    }

    /** Expose protect-set prune helper for runners holding in-flight backup ids. */
    public static void pruneBackups(Path backupsDir, Set<String> protectBackupIds) throws IOException {
        new ModMutateBackupStore(backupsDir).prune(protectBackupIds);
    }
}
