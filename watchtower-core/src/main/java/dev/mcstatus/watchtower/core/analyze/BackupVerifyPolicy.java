package dev.mcstatus.watchtower.core.analyze;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.collect.CraftyCollector;
import dev.mcstatus.watchtower.core.report.ReportConfig;

import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

/**
 * Pure helpers for auto backup-verify scheduling (1.1.20).
 */
public final class BackupVerifyPolicy {

    private BackupVerifyPolicy() {
    }

    public static boolean shouldDeferAuto(int playersOnline, double mspt, ReportConfig config) {
        if (config == null) {
            return false;
        }
        if (config.backupVerifyDeferWhenPlayers() && playersOnline > 0) {
            return true;
        }
        int max = config.backupVerifyMaxMspt();
        return max > 0 && mspt > max;
    }

    /**
     * Inventory paths that lack a finished verify (no verify, or status pending).
     */
    public static List<String> pathsNeedingVerify(JsonObject backupsLive) {
        List<String> out = new ArrayList<>();
        if (backupsLive == null || !backupsLive.has("inventory") || !backupsLive.get("inventory").isJsonArray()) {
            return out;
        }
        for (JsonElement el : backupsLive.getAsJsonArray("inventory")) {
            if (!el.isJsonObject()) {
                continue;
            }
            JsonObject item = el.getAsJsonObject();
            String path = BackupVerifyAttacher.pathKey(item);
            if (path.isEmpty()) {
                continue;
            }
            if (!item.has("verify") || !item.get("verify").isJsonObject()) {
                out.add(path);
                continue;
            }
            String status = item.getAsJsonObject("verify").has("status")
                    ? item.getAsJsonObject("verify").get("status").getAsString()
                    : "";
            if (BackupVerifier.STATUS_PENDING.equals(status)) {
                out.add(path);
            }
        }
        return out;
    }

    public static boolean isPathUnderBackupDirs(Path file, ReportConfig config, String serverDir) {
        if (file == null || config == null) {
            return false;
        }
        Path abs = file.toAbsolutePath().normalize();
        for (Path dir : CraftyCollector.discoverBackupDirs(config, serverDir)) {
            if (dir == null) {
                continue;
            }
            Path root = dir.toAbsolutePath().normalize();
            if (abs.startsWith(root)) {
                return true;
            }
        }
        return false;
    }

    /** Mark inventory rows as pending for given paths (mutates). */
    public static void markPending(JsonArray inventory, Iterable<String> paths) {
        if (inventory == null || paths == null) {
            return;
        }
        java.util.HashSet<String> set = new java.util.HashSet<>();
        for (String p : paths) {
            String n = BackupVerifyAttacher.normalizePath(p);
            if (!n.isEmpty()) {
                set.add(n);
            }
        }
        if (set.isEmpty()) {
            return;
        }
        for (JsonElement el : inventory) {
            if (!el.isJsonObject()) {
                continue;
            }
            JsonObject item = el.getAsJsonObject();
            String path = BackupVerifyAttacher.pathKey(item);
            if (!set.contains(path)) {
                continue;
            }
            if (item.has("verify") && item.get("verify").isJsonObject()) {
                String st = item.getAsJsonObject("verify").has("status")
                        ? item.getAsJsonObject("verify").get("status").getAsString() : "";
                if (!st.isEmpty() && !BackupVerifier.STATUS_PENDING.equals(st)) {
                    continue;
                }
            }
            JsonObject pending = new JsonObject();
            pending.addProperty("status", BackupVerifier.STATUS_PENDING);
            pending.addProperty("mode", "light");
            pending.add("findings", new JsonArray());
            item.add("verify", pending);
        }
    }
}
