package dev.mcstatus.watchtower.core.ops;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.analyze.DiskProjectionAnalyzer;

import java.util.ArrayList;
import java.util.List;

/**
 * Maps existing ops-cache peeks into {@link IssuesLiveRecord} detections (no StagingBuilder).
 */
public final class IssuesLiveEvaluators {

    /** BAU Issues freshness gate for backups — not report {@code LOOKBACK_HOURS}. */
    public static final double BACKUP_FRESH_HOURS = 24.0;

    /** Default disk-fill warn window when callers omit {@code DISK_FILL_WARN_DAYS}. */
    public static final double DEFAULT_DISK_FILL_WARN_DAYS = 14.0;

    private IssuesLiveEvaluators() {
    }

    public static List<IssuesLiveRecord> fromLagIssues(JsonObject cache) {
        List<IssuesLiveRecord> out = new ArrayList<>();
        if (cache == null || !cache.has(OpsCacheSchema.LAG_ISSUES)) {
            return out;
        }
        JsonObject block = cache.getAsJsonObject(OpsCacheSchema.LAG_ISSUES);
        if (block == null || !block.has(OpsCacheSchema.LAG_ISSUES_ENTRIES)) {
            return out;
        }
        JsonArray entries = block.getAsJsonArray(OpsCacheSchema.LAG_ISSUES_ENTRIES);
        boolean anyCritical = false;
        boolean anyWarn = false;
        String bestMsg = "Tick lag detected";
        String incidentRef = null;
        int openCount = 0;
        for (JsonElement el : entries) {
            if (!el.isJsonObject()) {
                continue;
            }
            JsonObject e = el.getAsJsonObject();
            if (e.has("resolved") && e.get("resolved").getAsBoolean()) {
                continue;
            }
            openCount++;
            String sev = str(e, "severity");
            if ("critical".equalsIgnoreCase(sev) || "error".equalsIgnoreCase(sev)) {
                anyCritical = true;
            } else {
                anyWarn = true;
            }
            String msg = str(e, "message");
            if (msg.isBlank()) {
                msg = str(e, "summary");
            }
            if (!msg.isBlank()) {
                bestMsg = msg;
            }
            String iid = str(e, "incident_id");
            if (!iid.isBlank()) {
                incidentRef = "incident:" + iid;
            }
        }
        if (openCount == 0) {
            return out;
        }
        String key = anyCritical ? "TICK_LAG" : "MSPT_HIGH";
        // Stable fingerprint — severity band only (not open entry count; count drift reopens reviewed).
        IssuesLiveRecord.Builder b = IssuesLiveRecord.builder()
                .id(key)
                .key(key)
                .severity(anyCritical ? "critical" : "warning")
                .message(bestMsg)
                .source(IssuesLiveSchema.SOURCE_LIVE)
                .evidenceFingerprint(anyCritical ? "lag:c" : "lag:w")
                .addEvidenceRef("ops:lag_issues");
        if (incidentRef != null) {
            b.addEvidenceRef(incidentRef);
        }
        out.add(b.build());
        return out;
    }

    public static List<IssuesLiveRecord> fromLogStale(JsonObject cache) {
        List<IssuesLiveRecord> out = new ArrayList<>();
        if (cache == null || !cache.has(OpsCacheSchema.LOG_STALE) || !cache.get(OpsCacheSchema.LOG_STALE).isJsonObject()) {
            return out;
        }
        JsonObject stale = cache.getAsJsonObject(OpsCacheSchema.LOG_STALE);
        // Canonical LogStaleEvaluator field is {@code active}; tolerate legacy {@code stale}.
        boolean isStale = bool(stale, "active") || bool(stale, "stale");
        if (!isStale) {
            return out;
        }
        String msg = str(stale, "message");
        if (msg.isBlank()) {
            msg = "Server log looks stale — the process may have stopped writing.";
        }
        out.add(IssuesLiveRecord.builder()
                .id("LOG_STALE")
                .key("LOG_STALE")
                .severity("warning")
                .message(msg)
                .source(IssuesLiveSchema.SOURCE_OPS)
                .evidenceFingerprint("log_stale")
                .addEvidenceRef("ops:log_stale")
                .build());
        return out;
    }

    public static List<IssuesLiveRecord> fromDisk(JsonObject cache) {
        return fromDisk(cache, DEFAULT_DISK_FILL_WARN_DAYS);
    }

    public static List<IssuesLiveRecord> fromDisk(JsonObject cache, double warnDays) {
        List<IssuesLiveRecord> out = new ArrayList<>();
        if (cache == null) {
            return out;
        }
        double warn = warnDays > 0 ? warnDays : DEFAULT_DISK_FILL_WARN_DAYS;
        if (cache.has(OpsCacheSchema.DISK_PROJECTION) && cache.get(OpsCacheSchema.DISK_PROJECTION).isJsonObject()) {
            JsonObject proj = cache.getAsJsonObject(OpsCacheSchema.DISK_PROJECTION);
            if (DiskProjectionAnalyzer.shouldRaiseIssue(proj, warn)) {
                String msg = str(proj, "message");
                if (msg.isBlank()) {
                    msg = "Disk may fill at the current growth rate.";
                }
                // Stable fingerprint — do not embed days_until_full (reopens reviewed on daily drift).
                out.add(IssuesLiveRecord.builder()
                        .id("DISK_FILL_PROJECTED")
                        .key("DISK_FILL_PROJECTED")
                        .severity("warning")
                        .message(msg)
                        .source(IssuesLiveSchema.SOURCE_OPS)
                        .evidenceFingerprint("disk_fill_projected")
                        .addEvidenceRef("ops:disk_projection")
                        .build());
            }
        }
        if (cache.has(OpsCacheSchema.DISK_JUMP) && cache.get(OpsCacheSchema.DISK_JUMP).isJsonObject()) {
            JsonObject jump = cache.getAsJsonObject(OpsCacheSchema.DISK_JUMP);
            boolean active = jump.has("active") && jump.get("active").getAsBoolean();
            if (active) {
                String msg = str(jump, "message");
                if (msg.isBlank()) {
                    msg = "Sudden disk free-space drop detected.";
                }
                out.add(IssuesLiveRecord.builder()
                        .id("DISK_HIGH")
                        .key("DISK_HIGH")
                        .severity("warning")
                        .message(msg)
                        .source(IssuesLiveSchema.SOURCE_OPS)
                        .evidenceFingerprint("disk_jump")
                        .addEvidenceRef("ops:disk_jump")
                        .build());
            }
        }
        return out;
    }

    public static List<IssuesLiveRecord> fromBackups(JsonObject cache, boolean trackingEnabled) {
        List<IssuesLiveRecord> out = new ArrayList<>();
        if (!trackingEnabled || cache == null) {
            return out;
        }
        if (!cache.has(OpsCacheSchema.BACKUPS_LIVE) || !cache.get(OpsCacheSchema.BACKUPS_LIVE).isJsonObject()) {
            return out;
        }
        JsonObject backups = cache.getAsJsonObject(OpsCacheSchema.BACKUPS_LIVE);
        // Status/age live on last_backup (see OpsCacheWriter.applyBackupsLive); top-level is legacy/fallback.
        JsonObject last = null;
        if (backups.has("last_backup") && backups.get("last_backup").isJsonObject()) {
            last = backups.getAsJsonObject("last_backup");
        }
        JsonObject src = last != null ? last : backups;
        String status = str(src, "status");
        if (status.isBlank() && last == null) {
            status = str(backups, "overall");
        }
        if ("unconfigured".equalsIgnoreCase(status)) {
            return out;
        }

        String msg = str(src, "message");
        if (msg.isBlank() && last == null) {
            msg = str(backups, "message");
        }

        if ("missing".equalsIgnoreCase(status) || "not_found".equalsIgnoreCase(status)) {
            if (msg.isBlank()) {
                msg = "No backup archive found.";
            }
            out.add(IssuesLiveRecord.builder()
                    .id("BACKUP_NOT_FOUND")
                    .key("BACKUP_NOT_FOUND")
                    .severity("warning")
                    .message(msg)
                    .source(IssuesLiveSchema.SOURCE_OPS)
                    .evidenceFingerprint("backup:not_found")
                    .addEvidenceRef("ops:backups_live")
                    .build());
            return out;
        }

        Double ageHours = dbl(src, "age_hours");
        if (ageHours == null) {
            Double ageDays = dbl(src, "age_days");
            if (ageDays != null) {
                ageHours = ageDays * 24.0;
            }
        }
        boolean overFreshWindow = ageHours != null && ageHours > BACKUP_FRESH_HOURS;
        boolean warnStale = "stale".equalsIgnoreCase(status) || bool(src, "stale");
        if (overFreshWindow || warnStale) {
            if (msg.isBlank()) {
                msg = "No backup in the last 24 hours.";
            }
            // Stable fingerprint — do not embed hourly age (reopens reviewed on every poll).
            out.add(IssuesLiveRecord.builder()
                    .id("BACKUP_STALE")
                    .key("BACKUP_STALE")
                    .severity("warning")
                    .message(msg)
                    .source(IssuesLiveSchema.SOURCE_OPS)
                    .evidenceFingerprint("backup:stale")
                    .addEvidenceRef("ops:backups_live")
                    .build());
        }
        return out;
    }

    public static List<IssuesLiveRecord> fromModIssues(JsonObject cache) {
        List<IssuesLiveRecord> out = new ArrayList<>();
        if (cache == null || !cache.has(OpsCacheSchema.MOD_ISSUES)) {
            return out;
        }
        JsonObject block = cache.getAsJsonObject(OpsCacheSchema.MOD_ISSUES);
        if (block == null || !block.has(OpsCacheSchema.MOD_ISSUES_ENTRIES)) {
            return out;
        }
        for (JsonElement el : block.getAsJsonArray(OpsCacheSchema.MOD_ISSUES_ENTRIES)) {
            if (!el.isJsonObject()) {
                continue;
            }
            JsonObject e = el.getAsJsonObject();
            String id = str(e, "id");
            if (id.isBlank()) {
                id = str(e, "issue_id");
            }
            if (id.isBlank()) {
                id = str(e, "mod_id");
                if (!id.isBlank()) {
                    id = "MOD_LOG:" + id;
                }
            }
            if (id.isBlank()) {
                continue;
            }
            String msg = str(e, "message");
            if (msg.isBlank()) {
                msg = str(e, "summary");
            }
            if (msg.isBlank()) {
                msg = "Mod issue detected";
            }
            out.add(IssuesLiveRecord.builder()
                    .id(id)
                    .key(id)
                    .severity(str(e, "severity").isBlank() ? "warning" : str(e, "severity"))
                    .message(msg)
                    .source(IssuesLiveSchema.SOURCE_OPS)
                    .evidenceFingerprint("mod:" + id)
                    .addEvidenceRef("ops:mod_issues")
                    .build());
        }
        return out;
    }

    /**
     * Merge all cheap detections into the ledger; resolve lag/log_stale/disk/backup keys when evidence clears.
     */
    public static List<IssuesLiveRecord> evaluateAndMerge(
            JsonObject cache,
            List<IssuesLiveRecord> existing,
            boolean backupTrackingEnabled,
            String nowIso
    ) {
        return evaluateAndMerge(cache, existing, backupTrackingEnabled, nowIso, DEFAULT_DISK_FILL_WARN_DAYS);
    }

    public static List<IssuesLiveRecord> evaluateAndMerge(
            JsonObject cache,
            List<IssuesLiveRecord> existing,
            boolean backupTrackingEnabled,
            String nowIso,
            double diskFillWarnDays
    ) {
        List<IssuesLiveRecord> detected = new ArrayList<>();
        detected.addAll(fromLagIssues(cache));
        detected.addAll(fromLogStale(cache));
        detected.addAll(fromDisk(cache, diskFillWarnDays));
        detected.addAll(fromBackups(cache, backupTrackingEnabled));
        detected.addAll(fromModIssues(cache));

        List<IssuesLiveRecord> cur = existing;
        for (IssuesLiveRecord d : detected) {
            cur = IssuesLiveStore.upsert(cur, d, nowIso);
        }

        // Explicit clears for known condition keys when not detected this pass
        boolean hasLag = detected.stream().anyMatch(r ->
                "TICK_LAG".equals(r.normalizedKey()) || "MSPT_HIGH".equals(r.normalizedKey()) || "TPS_LOW".equals(r.normalizedKey()));
        if (!hasLag) {
            cur = IssuesLiveStore.resolve(cur, "TICK_LAG", nowIso);
            cur = IssuesLiveStore.resolve(cur, "MSPT_HIGH", nowIso);
            cur = IssuesLiveStore.resolve(cur, "TPS_LOW", nowIso);
        }
        boolean hasLogStale = detected.stream().anyMatch(r -> "LOG_STALE".equals(r.normalizedKey()));
        if (!hasLogStale) {
            cur = IssuesLiveStore.resolve(cur, "LOG_STALE", nowIso);
        }
        boolean hasDiskFill = detected.stream().anyMatch(r -> "DISK_FILL_PROJECTED".equals(r.normalizedKey()));
        if (!hasDiskFill) {
            cur = IssuesLiveStore.resolve(cur, "DISK_FILL_PROJECTED", nowIso);
        }
        boolean hasDiskHigh = detected.stream().anyMatch(r -> "DISK_HIGH".equals(r.normalizedKey()));
        if (!hasDiskHigh) {
            cur = IssuesLiveStore.resolve(cur, "DISK_HIGH", nowIso);
        }
        boolean hasBackup = detected.stream().anyMatch(r ->
                r.normalizedKey().startsWith("BACKUP_"));
        if (!hasBackup) {
            cur = IssuesLiveStore.resolve(cur, "BACKUP_STALE", nowIso);
            cur = IssuesLiveStore.resolve(cur, "BACKUP_NOT_FOUND", nowIso);
        }
        // Mod peek keys clear when absent from this pass (otherwise fixed log errors stick open)
        java.util.Set<String> detectedKeys = new java.util.HashSet<>();
        for (IssuesLiveRecord d : detected) {
            detectedKeys.add(d.normalizedKey());
        }
        for (IssuesLiveRecord r : List.copyOf(cur)) {
            String k = r.normalizedKey();
            if (k.startsWith("MOD_") && !detectedKeys.contains(k)) {
                cur = IssuesLiveStore.resolve(cur, k, nowIso);
            }
        }
        return cur;
    }

    private static String str(JsonObject o, String k) {
        if (o == null || !o.has(k) || o.get(k).isJsonNull()) {
            return "";
        }
        try {
            return o.get(k).getAsString();
        } catch (Exception e) {
            return "";
        }
    }

    private static Double dbl(JsonObject o, String k) {
        if (o == null || !o.has(k) || o.get(k).isJsonNull()) {
            return null;
        }
        try {
            return o.get(k).getAsDouble();
        } catch (Exception e) {
            return null;
        }
    }

    private static boolean bool(JsonObject o, String k) {
        if (o == null || !o.has(k) || o.get(k).isJsonNull()) {
            return false;
        }
        try {
            return o.get(k).getAsBoolean();
        } catch (Exception e) {
            return false;
        }
    }
}
