package dev.mcstatus.watchtower.core.ops;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.analyze.DiskProjectionAnalyzer;
import dev.mcstatus.watchtower.core.collect.JoinRejectionSignatures;
import dev.mcstatus.watchtower.core.collect.SilentFailSignatures;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;

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
        return fromBackups(cache, trackingEnabled, BACKUP_FRESH_HOURS);
    }

    public static List<IssuesLiveRecord> fromBackups(
            JsonObject cache, boolean trackingEnabled, double staleHours) {
        List<IssuesLiveRecord> out = new ArrayList<>();
        if (!trackingEnabled || cache == null) {
            return out;
        }
        if (!cache.has(OpsCacheSchema.BACKUPS_LIVE) || !cache.get(OpsCacheSchema.BACKUPS_LIVE).isJsonObject()) {
            return out;
        }
        JsonObject backups = cache.getAsJsonObject(OpsCacheSchema.BACKUPS_LIVE);
        double gate = staleHours > 0 ? staleHours : BACKUP_FRESH_HOURS;
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
        boolean overFreshWindow = ageHours != null && ageHours > gate;
        boolean warnStale = "stale".equalsIgnoreCase(status) || bool(src, "stale");
        if (overFreshWindow || warnStale) {
            if (msg.isBlank()) {
                msg = formatBackupStaleMessage(gate);
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

        IssuesLiveRecord verifyIssue = fromBackupVerify(backups);
        if (verifyIssue != null) {
            out.add(verifyIssue);
        }
        return out;
    }

    static String formatBackupStaleMessage(double staleHours) {
        if (staleHours >= 48 && Math.abs(staleHours % 24.0) < 0.01) {
            int days = (int) Math.round(staleHours / 24.0);
            return "No backup in the last " + days + " day" + (days == 1 ? "" : "s") + ".";
        }
        if (Math.abs(staleHours - Math.rint(staleHours)) < 0.01) {
            int hours = (int) Math.rint(staleHours);
            return "No backup in the last " + hours + " hour" + (hours == 1 ? "" : "s") + ".";
        }
        return String.format(Locale.US, "No backup in the last %.1f hours.", staleHours);
    }

    /** Newest inventory row with broken/suspicious light verify. */
    static IssuesLiveRecord fromBackupVerify(JsonObject backups) {
        if (backups == null || !backups.has("inventory") || !backups.get("inventory").isJsonArray()) {
            return null;
        }
        JsonArray inv = backups.getAsJsonArray("inventory");
        if (inv.isEmpty()) {
            return null;
        }
        JsonObject newest = null;
        for (JsonElement el : inv) {
            if (el.isJsonObject()) {
                newest = el.getAsJsonObject();
                break; // inventory is newest-first from CraftyCollector
            }
        }
        if (newest == null || !newest.has("verify") || !newest.get("verify").isJsonObject()) {
            return null;
        }
        String vStatus = str(newest.getAsJsonObject("verify"), "status");
        if (!"broken".equalsIgnoreCase(vStatus) && !"suspicious".equalsIgnoreCase(vStatus)) {
            return null;
        }
        String file = str(newest, "filename");
        if (file.isBlank()) {
            file = str(newest, "path");
        }
        String message = "Newest backup failed integrity check (" + vStatus + ")"
                + (file.isBlank() ? "." : ": " + file);
        return IssuesLiveRecord.builder()
                .id("BACKUP_VERIFY_FAILED")
                .key("BACKUP_VERIFY_FAILED")
                .severity("warning")
                .message(message)
                .source(IssuesLiveSchema.SOURCE_OPS)
                .evidenceFingerprint("backup:verify:" + vStatus.toLowerCase(Locale.ROOT))
                .addEvidenceRef("ops:backups_live")
                .build();
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

    public static List<IssuesLiveRecord> fromModJarDrift(JsonObject cache) {
        List<IssuesLiveRecord> out = new ArrayList<>();
        if (cache == null || !cache.has(OpsCacheSchema.MODS_INVENTORY)
                || !cache.get(OpsCacheSchema.MODS_INVENTORY).isJsonObject()) {
            return out;
        }
        JsonObject inv = cache.getAsJsonObject(OpsCacheSchema.MODS_INVENTORY);
        if (!inv.has("diff") || !inv.get("diff").isJsonObject()) {
            return out;
        }
        JsonObject diff = inv.getAsJsonObject("diff");
        if (!diff.has("drift") || !diff.get("drift").isJsonArray()) {
            return out;
        }
        for (JsonElement el : diff.getAsJsonArray("drift")) {
            if (!el.isJsonObject()) {
                continue;
            }
            JsonObject d = el.getAsJsonObject();
            String jar = str(d, "jar");
            if (jar.isBlank()) {
                continue;
            }
            String id = "MOD_JAR_DRIFT:" + jar;
            String msg = "`" + jar + "` changed without a version bump — verify this was intentional.";
            out.add(IssuesLiveRecord.builder()
                    .id(id)
                    .key(id)
                    .severity("warning")
                    .message(msg)
                    .source(IssuesLiveSchema.SOURCE_OPS)
                    .evidenceFingerprint("mod_drift:" + jar)
                    .addEvidenceRef("ops:mods_inventory")
                    .addFixStep("Open Mods → Changes and confirm the jar swap was intentional.")
                    .addFixStep("If unexpected, restore the jar from a known-good backup and re-check.")
                    .build());
        }
        return out;
    }

    public static List<IssuesLiveRecord> fromClientOnServer(JsonObject cache, boolean enabled) {
        List<IssuesLiveRecord> out = new ArrayList<>();
        if (!enabled || cache == null) {
            return out;
        }
        Set<String> ignored = ignoredClientModIds(cache);
        JsonArray entries = clientOnlyEntries(cache);
        for (JsonElement el : entries) {
            if (!el.isJsonObject()) {
                continue;
            }
            JsonObject e = el.getAsJsonObject();
            String bucket = str(e, "bucket");
            if (bucket.isBlank()) {
                bucket = str(e, "side_score");
            }
            if (!"likely_removable".equals(bucket)) {
                continue;
            }
            String confidence = str(e, "confidence");
            if (!"high".equalsIgnoreCase(confidence)) {
                continue;
            }
            String modId = str(e, "mod_id");
            if (modId.isBlank()) {
                modId = str(e, "id");
            }
            if (modId.isBlank() || ignored.contains(modId.toLowerCase(Locale.ROOT))) {
                continue;
            }
            String id = "CLIENT_ON_SERVER:" + modId;
            String reason = str(e, "reason");
            String advice = str(e, "removal_advice");
            String display = str(e, "display_name");
            String label = !display.isBlank() ? display : modId;
            String msg = label + " looks client-only and is likely removable from this dedicated server.";
            if (!reason.isBlank()) {
                msg = label + " — " + reason;
            }
            IssuesLiveRecord.Builder b = IssuesLiveRecord.builder()
                    .id(id)
                    .key(id)
                    .severity("info")
                    .message(msg)
                    .source(IssuesLiveSchema.SOURCE_OPS)
                    .evidenceFingerprint("client_on_server:" + modId)
                    .addEvidenceRef("ops:mods_light")
                    .addFixStep("Open Mods → Overview (Client filter) and confirm this jar is not needed server-side.");
            if (!advice.isBlank()) {
                b.addFixStep(advice);
            } else {
                b.addFixStep("Remove or quarantine the jar if players do not need it on the server, then restart.");
            }
            out.add(b.build());
        }
        return out;
    }

    /**
     * Continuous issue from a post-mortem {@code external_kill} ops-cache verdict.
     */
    public static List<IssuesLiveRecord> fromExternalKill(JsonObject cache, boolean enabled) {
        List<IssuesLiveRecord> out = new ArrayList<>();
        if (!enabled || cache == null) {
            return out;
        }
        if (!cache.has(OpsCacheSchema.EXTERNAL_KILL) || !cache.get(OpsCacheSchema.EXTERNAL_KILL).isJsonObject()) {
            return out;
        }
        JsonObject ek = cache.getAsJsonObject(OpsCacheSchema.EXTERNAL_KILL);
        String subtype = str(ek, OpsCacheSchema.EXTERNAL_KILL_SUBTYPE);
        if (subtype.isBlank()) {
            return out;
        }
        String id = "EXTERNAL_KILL:" + subtype;
        String label = str(ek, "display_label");
        if (label.isBlank()) {
            if ("oom".equals(subtype)) {
                label = "Killed by the OS out-of-memory killer";
            } else if ("panel_watchdog".equals(subtype)) {
                label = "Force-killed from outside the server";
            } else {
                label = "External kill (" + subtype + ")";
            }
        }
        IssuesLiveRecord.Builder b = IssuesLiveRecord.builder()
                .id(id)
                .key(id)
                .severity("warning")
                .message(label)
                .source(IssuesLiveSchema.SOURCE_OPS)
                .evidenceFingerprint("external_kill:" + subtype + ":" + str(ek, OpsCacheSchema.EXTERNAL_KILL_KILLED_AT))
                .addEvidenceRef("ops:external_kill");
        int hintCount = 0;
        if (ek.has("fix_hints") && ek.get("fix_hints").isJsonArray()) {
            for (JsonElement h : ek.getAsJsonArray("fix_hints")) {
                if (h.isJsonPrimitive()) {
                    String step = h.getAsString();
                    if (!step.isBlank()) {
                        b.addFixStep(step);
                        hintCount++;
                    }
                }
            }
        }
        if (hintCount == 0) {
            b.addFixStep("Open Crashes for the full external-kill fix plan.");
        }
        out.add(b.build());
        return out;
    }

    /**
     * Continuous issue when the dedicated server process is up but ticks have stalled.
     */
    public static List<IssuesLiveRecord> fromSoftHang(JsonObject cache) {
        List<IssuesLiveRecord> out = new ArrayList<>();
        if (cache == null || !cache.has(OpsCacheSchema.SOFT_HANG) || !cache.get(OpsCacheSchema.SOFT_HANG).isJsonObject()) {
            return out;
        }
        JsonObject soft = cache.getAsJsonObject(OpsCacheSchema.SOFT_HANG);
        if (!bool(soft, OpsCacheSchema.SOFT_HANG_ACTIVE)) {
            return out;
        }
        String phase = str(soft, OpsCacheSchema.SOFT_HANG_PHASE);
        if (phase.isBlank()) {
            phase = "unknown";
        }
        long stall = soft.has(OpsCacheSchema.SOFT_HANG_STALL_SECONDS)
                && soft.get(OpsCacheSchema.SOFT_HANG_STALL_SECONDS).isJsonPrimitive()
                ? soft.get(OpsCacheSchema.SOFT_HANG_STALL_SECONDS).getAsLong()
                : 0L;
        String dumpPath = str(soft, OpsCacheSchema.SOFT_HANG_DUMP_PATH);
        StringBuilder msg = new StringBuilder("Server tick frozen");
        if (stall > 0) {
            msg.append(" for ").append(stall).append("s");
        }
        msg.append(" (phase: ").append(phase).append(")");
        if (!dumpPath.isBlank()) {
            msg.append(" — hang dump saved");
        }
        IssuesLiveRecord.Builder b = IssuesLiveRecord.builder()
                .id("SOFT_HANG")
                .key("SOFT_HANG")
                .severity("critical")
                .message(msg.toString())
                .source(IssuesLiveSchema.SOURCE_OPS)
                .evidenceFingerprint("soft_hang:" + str(soft, OpsCacheSchema.SOFT_HANG_STARTED_AT))
                .addEvidenceRef("ops:soft_hang")
                .addFixStep("Check whether a world save or pregen is stuck.")
                .addFixStep("If hang dumps are enabled, open the file under watchtower/hangs/.")
                .addFixStep("Build a Support pack for Discord or a bug report.")
                .addFixStep("WatchTower will not restart the server for you.");
        out.add(b.build());
        return out;
    }

    /**
     * Continuous issues from ops-cache {@code silent_fails} (KubeJS / CraftTweaker / datapack / reload).
     */
    public static List<IssuesLiveRecord> fromSilentFails(JsonObject cache, boolean enabled) {
        List<IssuesLiveRecord> out = new ArrayList<>();
        if (!enabled || cache == null) {
            return out;
        }
        if (!cache.has(OpsCacheSchema.SILENT_FAILS) || !cache.get(OpsCacheSchema.SILENT_FAILS).isJsonObject()) {
            return out;
        }
        JsonObject block = cache.getAsJsonObject(OpsCacheSchema.SILENT_FAILS);
        if (!block.has(OpsCacheSchema.SILENT_FAILS_ENTRIES)
                || !block.get(OpsCacheSchema.SILENT_FAILS_ENTRIES).isJsonArray()) {
            return out;
        }
        for (JsonElement el : block.getAsJsonArray(OpsCacheSchema.SILENT_FAILS_ENTRIES)) {
            if (!el.isJsonObject()) {
                continue;
            }
            JsonObject e = el.getAsJsonObject();
            String key = str(e, "key");
            if (key.isBlank()) {
                String kind = str(e, "kind");
                String path = str(e, "path");
                if (!kind.isBlank() && !path.isBlank()) {
                    key = kind + "|" + path + (e.has("line") ? ":" + e.get("line").getAsInt() : "");
                }
            }
            if (key.isBlank()) {
                continue;
            }
            String id = "SILENT_FAIL:" + key;
            String path = str(e, "path");
            String title = str(e, "title");
            if (title.isBlank()) {
                title = "Silent script/datapack failure";
            }
            String msg;
            if (path.isBlank()) {
                msg = title;
            } else {
                String pathRef = path;
                if (e.has("line") && !e.get("line").isJsonNull()) {
                    try {
                        pathRef = path + ":" + e.get("line").getAsInt();
                    } catch (Exception ignored) {
                        // keep path only
                    }
                }
                msg = title + " — `" + pathRef + "`";
            }
            IssuesLiveRecord.Builder b = IssuesLiveRecord.builder()
                    .id(id)
                    .key(id)
                    .severity(str(e, "severity").isBlank() ? "warning" : str(e, "severity"))
                    .message(msg)
                    .source(IssuesLiveSchema.SOURCE_OPS)
                    .evidenceFingerprint("silent_fail:" + key)
                    .addEvidenceRef("ops:silent_fails");
            for (String step : SilentFailSignatures.fixStepsFor(str(e, "kind"))) {
                b.addFixStep(step);
            }
            out.add(b.build());
            if (out.size() >= 30) {
                break;
            }
        }
        return out;
    }


    /**
     * Continuous issues from ops-cache {@code world_pressure.classifiers}.
     */
    public static List<IssuesLiveRecord> fromWorldPressure(JsonObject cache, boolean enabled) {
        List<IssuesLiveRecord> out = new ArrayList<>();
        if (!enabled || cache == null) {
            return out;
        }
        if (!cache.has(OpsCacheSchema.WORLD_PRESSURE) || !cache.get(OpsCacheSchema.WORLD_PRESSURE).isJsonObject()) {
            return out;
        }
        JsonObject block = cache.getAsJsonObject(OpsCacheSchema.WORLD_PRESSURE);
        if (!block.has(OpsCacheSchema.WORLD_PRESSURE_CLASSIFIERS)
                || !block.get(OpsCacheSchema.WORLD_PRESSURE_CLASSIFIERS).isJsonArray()) {
            return out;
        }
        for (JsonElement el : block.getAsJsonArray(OpsCacheSchema.WORLD_PRESSURE_CLASSIFIERS)) {
            if (!el.isJsonObject()) {
                continue;
            }
            JsonObject c = el.getAsJsonObject();
            String kind = str(c, "kind");
            String dimension = str(c, "dimension");
            if (kind.isBlank() || dimension.isBlank()) {
                continue;
            }
            String id = "WORLD_PRESSURE:" + kind + ":" + dimension;
            String headline = str(c, "headline");
            String detail = str(c, "detail");
            String msg;
            if (headline.isBlank()) {
                msg = detail.isBlank() ? "World pressure in " + dimension : detail;
            } else if (detail.isBlank()) {
                msg = headline;
            } else {
                msg = headline + " — " + detail;
            }
            IssuesLiveRecord.Builder b = IssuesLiveRecord.builder()
                    .id(id)
                    .key(id)
                    .severity(str(c, "severity").isBlank() ? "warning" : str(c, "severity"))
                    .message(msg)
                    .source(IssuesLiveSchema.SOURCE_OPS)
                    .evidenceFingerprint("world_pressure:" + kind + ":" + dimension)
                    .addEvidenceRef("ops:world_pressure");
            if (c.has("next_steps") && c.get("next_steps").isJsonArray()) {
                for (JsonElement step : c.getAsJsonArray("next_steps")) {
                    if (step.isJsonPrimitive()) {
                        b.addFixStep(step.getAsString());
                    }
                }
            }
            out.add(b.build());
            if (out.size() >= 30) {
                break;
            }
        }
        return out;
    }

    /**
     * Disabled jar still has world dimension folders / high world_risk (1.1.19).
     */
    public static List<IssuesLiveRecord> fromWorldRiskDisabled(JsonObject cache, boolean enabled) {
        List<IssuesLiveRecord> out = new ArrayList<>();
        if (!enabled || cache == null) {
            return out;
        }
        JsonArray mods = null;
        if (cache.has("mods_light") && cache.get("mods_light").isJsonObject()) {
            JsonObject light = cache.getAsJsonObject("mods_light");
            if (light.has("mods") && light.get("mods").isJsonArray()) {
                mods = light.getAsJsonArray("mods");
            }
        }
        if (mods == null) {
            return out;
        }
        for (JsonElement el : mods) {
            if (!el.isJsonObject()) {
                continue;
            }
            JsonObject mod = el.getAsJsonObject();
            boolean disabled = mod.has("disabled") && mod.get("disabled").getAsBoolean();
            if (!disabled) {
                continue;
            }
            if (!mod.has("world_risk") || !mod.get("world_risk").isJsonObject()) {
                continue;
            }
            JsonObject risk = mod.getAsJsonObject("world_risk");
            String level = str(risk, "level");
            if (!"high".equalsIgnoreCase(level)) {
                continue;
            }
            String modId = str(mod, "id");
            if (modId.isBlank()) {
                modId = str(mod, "mod_id");
            }
            if (modId.isBlank()) {
                continue;
            }
            String jar = str(mod, "jar_file");
            if (jar.isBlank()) {
                jar = str(mod, "jar");
            }
            String id = "WORLD_RISK_DISABLED:" + modId;
            String msg = "Disabled mod " + modId + " still looks tied to the world"
                    + (jar.isBlank() ? "" : " (" + jar + ")");
            IssuesLiveRecord.Builder b = IssuesLiveRecord.builder()
                    .id(id)
                    .key(id)
                    .severity("warning")
                    .message(msg)
                    .source(IssuesLiveSchema.SOURCE_OPS)
                    .evidenceFingerprint("world_risk_disabled:" + modId)
                    .addEvidenceRef("ops:mods_light")
                    .addFixStep("Enable the jar again, or migrate/remove that mod's world data offline before leaving it disabled");
            if (risk.has("reasons") && risk.get("reasons").isJsonArray()) {
                for (JsonElement r : risk.getAsJsonArray("reasons")) {
                    if (r.isJsonPrimitive()) {
                        b.addFixStep("Evidence: " + r.getAsString());
                    }
                }
            }
            out.add(b.build());
            if (out.size() >= 20) {
                break;
            }
        }
        return out;
    }

    /**
     * Continuous issues from ops-cache {@code join_clinic.entries}.
     */
    public static List<IssuesLiveRecord> fromJoinClinic(JsonObject cache, boolean enabled) {
        List<IssuesLiveRecord> out = new ArrayList<>();
        if (!enabled || cache == null) {
            return out;
        }
        if (!cache.has(OpsCacheSchema.JOIN_CLINIC) || !cache.get(OpsCacheSchema.JOIN_CLINIC).isJsonObject()) {
            return out;
        }
        JsonObject block = cache.getAsJsonObject(OpsCacheSchema.JOIN_CLINIC);
        if (!block.has(OpsCacheSchema.JOIN_CLINIC_ENTRIES)
                || !block.get(OpsCacheSchema.JOIN_CLINIC_ENTRIES).isJsonArray()) {
            return out;
        }
        for (JsonElement el : block.getAsJsonArray(OpsCacheSchema.JOIN_CLINIC_ENTRIES)) {
            if (!el.isJsonObject()) {
                continue;
            }
            JsonObject e = el.getAsJsonObject();
            String key = str(e, "key");
            if (key.isBlank()) {
                continue;
            }
            int missingCount = arraySize(e, "missing");
            int extraCount = arraySize(e, "extra");
            int wrongCount = arraySize(e, "wrong_version");
            if (missingCount == 0 && extraCount == 0 && wrongCount == 0) {
                continue;
            }
            String severity = (missingCount > 0 || wrongCount > 0) ? "warning" : "info";
            String player = str(e, "player");
            String kind = str(e, "kind");
            String kindLabel = switch (kind) {
                case "mismatched_channel" -> "mismatched channels";
                case "missing_mod" -> "missing mods";
                case "wrong_version" -> "wrong mod versions";
                case "registry" -> "registry mismatch";
                default -> "pack sync mismatch";
            };
            List<String> named = new ArrayList<>();
            named.addAll(modIdsFromArray(e, "missing"));
            named.addAll(modIdsFromArray(e, "wrong_version"));
            if (named.isEmpty()) {
                named.addAll(modIdsFromArray(e, "extra"));
            }
            String namePart = named.isEmpty() ? kindLabel : String.join(", ", named.subList(0, Math.min(4, named.size())));
            String msg;
            if (!player.isBlank()) {
                msg = player + " can't join — " + namePart + " (" + kindLabel + ")";
            } else {
                msg = "Join rejected — " + namePart + " (" + kindLabel + ")";
            }
            String id = "JOIN_SYNC:" + key;
            IssuesLiveRecord.Builder b = IssuesLiveRecord.builder()
                    .id(id)
                    .key(id)
                    .severity(severity)
                    .message(msg)
                    .source(IssuesLiveSchema.SOURCE_OPS)
                    .evidenceFingerprint("join_sync:" + key)
                    .addEvidenceRef("ops:join_clinic");
            for (String step : JoinRejectionSignatures.fixStepsFor(kind)) {
                b.addFixStep(step);
            }
            b.addFixStep("Open Session → Join clinic and Copy fix for a player-safe list.");
            out.add(b.build());
            if (out.size() >= 30) {
                break;
            }
        }
        return out;
    }

    private static int arraySize(JsonObject o, String k) {
        if (o != null && o.has(k) && o.get(k).isJsonArray()) {
            return o.getAsJsonArray(k).size();
        }
        return 0;
    }

    private static List<String> modIdsFromArray(JsonObject o, String k) {
        List<String> out = new ArrayList<>();
        if (o == null || !o.has(k) || !o.get(k).isJsonArray()) {
            return out;
        }
        for (JsonElement el : o.getAsJsonArray(k)) {
            if (!el.isJsonObject()) {
                continue;
            }
            String id = str(el.getAsJsonObject(), "mod_id");
            if (!id.isBlank()) {
                out.add(id);
            }
        }
        return out;
    }

    private static JsonArray clientOnlyEntries(JsonObject cache) {
        JsonArray out = new JsonArray();
        if (cache.has("mods_light") && cache.get("mods_light").isJsonObject()) {
            JsonObject light = cache.getAsJsonObject("mods_light");
            if (light.has("client_only_mods") && light.get("client_only_mods").isJsonArray()) {
                return light.getAsJsonArray("client_only_mods");
            }
        }
        if (cache.has(OpsCacheSchema.MODRINTH_SCAN) && cache.get(OpsCacheSchema.MODRINTH_SCAN).isJsonObject()) {
            JsonObject scan = cache.getAsJsonObject(OpsCacheSchema.MODRINTH_SCAN);
            if (scan.has("client_only_mods") && scan.get("client_only_mods").isJsonArray()) {
                return scan.getAsJsonArray("client_only_mods");
            }
            // Fall back: build pseudo-entries from mods with side_score
            if (scan.has("mods") && scan.get("mods").isJsonArray()) {
                for (JsonElement el : scan.getAsJsonArray("mods")) {
                    if (!el.isJsonObject()) {
                        continue;
                    }
                    JsonObject m = el.getAsJsonObject();
                    if ("likely_removable".equals(str(m, "side_score"))) {
                        out.add(m);
                    }
                }
            }
        }
        return out;
    }

    private static Set<String> ignoredClientModIds(JsonObject cache) {
        Set<String> ignored = new java.util.HashSet<>();
        JsonObject map = null;
        if (cache.has("mods_light") && cache.get("mods_light").isJsonObject()) {
            JsonObject light = cache.getAsJsonObject("mods_light");
            if (light.has("ignored_client_mods") && light.get("ignored_client_mods").isJsonObject()) {
                map = light.getAsJsonObject("ignored_client_mods");
            }
        }
        if (map == null && cache.has("ignored_client_mods") && cache.get("ignored_client_mods").isJsonObject()) {
            map = cache.getAsJsonObject("ignored_client_mods");
        }
        if (map == null) {
            return ignored;
        }
        for (String key : map.keySet()) {
            JsonElement el = map.get(key);
            if (el != null && !el.isJsonNull() && el.isJsonPrimitive() && el.getAsBoolean()) {
                ignored.add(key.toLowerCase(Locale.ROOT));
            }
        }
        return ignored;
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
        return evaluateAndMerge(cache, existing, backupTrackingEnabled, nowIso,
                DEFAULT_DISK_FILL_WARN_DAYS, true, true, true, true, true);
    }

    public static List<IssuesLiveRecord> evaluateAndMerge(
            JsonObject cache,
            List<IssuesLiveRecord> existing,
            boolean backupTrackingEnabled,
            String nowIso,
            double diskFillWarnDays
    ) {
        return evaluateAndMerge(cache, existing, backupTrackingEnabled, nowIso, diskFillWarnDays, true, true, true, true, true);
    }

    public static List<IssuesLiveRecord> evaluateAndMerge(
            JsonObject cache,
            List<IssuesLiveRecord> existing,
            boolean backupTrackingEnabled,
            String nowIso,
            double diskFillWarnDays,
            boolean clientOnServerIssuesEnabled
    ) {
        return evaluateAndMerge(cache, existing, backupTrackingEnabled, nowIso, diskFillWarnDays,
                clientOnServerIssuesEnabled, true, true, true, true);
    }

    public static List<IssuesLiveRecord> evaluateAndMerge(
            JsonObject cache,
            List<IssuesLiveRecord> existing,
            boolean backupTrackingEnabled,
            String nowIso,
            double diskFillWarnDays,
            boolean clientOnServerIssuesEnabled,
            boolean externalKillDetectEnabled
    ) {
        return evaluateAndMerge(cache, existing, backupTrackingEnabled, nowIso, diskFillWarnDays,
                clientOnServerIssuesEnabled, externalKillDetectEnabled, true, true, true);
    }

    public static List<IssuesLiveRecord> evaluateAndMerge(
            JsonObject cache,
            List<IssuesLiveRecord> existing,
            boolean backupTrackingEnabled,
            String nowIso,
            double diskFillWarnDays,
            boolean clientOnServerIssuesEnabled,
            boolean externalKillDetectEnabled,
            boolean silentFailDetectEnabled
    ) {
        return evaluateAndMerge(cache, existing, backupTrackingEnabled, nowIso, diskFillWarnDays,
                clientOnServerIssuesEnabled, externalKillDetectEnabled, silentFailDetectEnabled, true, true);
    }

    public static List<IssuesLiveRecord> evaluateAndMerge(
            JsonObject cache,
            List<IssuesLiveRecord> existing,
            boolean backupTrackingEnabled,
            String nowIso,
            double diskFillWarnDays,
            boolean clientOnServerIssuesEnabled,
            boolean externalKillDetectEnabled,
            boolean silentFailDetectEnabled,
            boolean worldPressureEnabled
    ) {
        return evaluateAndMerge(cache, existing, backupTrackingEnabled, nowIso, diskFillWarnDays,
                clientOnServerIssuesEnabled, externalKillDetectEnabled, silentFailDetectEnabled,
                worldPressureEnabled, true);
    }

    public static List<IssuesLiveRecord> evaluateAndMerge(
            JsonObject cache,
            List<IssuesLiveRecord> existing,
            boolean backupTrackingEnabled,
            String nowIso,
            double diskFillWarnDays,
            boolean clientOnServerIssuesEnabled,
            boolean externalKillDetectEnabled,
            boolean silentFailDetectEnabled,
            boolean worldPressureEnabled,
            boolean joinClinicEnabled
    ) {
        return evaluateAndMerge(cache, existing, backupTrackingEnabled, nowIso, diskFillWarnDays,
                clientOnServerIssuesEnabled, externalKillDetectEnabled, silentFailDetectEnabled,
                worldPressureEnabled, joinClinicEnabled, true);
    }

    public static List<IssuesLiveRecord> evaluateAndMerge(
            JsonObject cache,
            List<IssuesLiveRecord> existing,
            boolean backupTrackingEnabled,
            String nowIso,
            double diskFillWarnDays,
            boolean clientOnServerIssuesEnabled,
            boolean externalKillDetectEnabled,
            boolean silentFailDetectEnabled,
            boolean worldPressureEnabled,
            boolean joinClinicEnabled,
            boolean worldRiskEnabled
    ) {
        return evaluateAndMerge(cache, existing, backupTrackingEnabled, nowIso, diskFillWarnDays,
                clientOnServerIssuesEnabled, externalKillDetectEnabled, silentFailDetectEnabled,
                worldPressureEnabled, joinClinicEnabled, worldRiskEnabled, BACKUP_FRESH_HOURS);
    }

    public static List<IssuesLiveRecord> evaluateAndMerge(
            JsonObject cache,
            List<IssuesLiveRecord> existing,
            boolean backupTrackingEnabled,
            String nowIso,
            double diskFillWarnDays,
            boolean clientOnServerIssuesEnabled,
            boolean externalKillDetectEnabled,
            boolean silentFailDetectEnabled,
            boolean worldPressureEnabled,
            boolean joinClinicEnabled,
            boolean worldRiskEnabled,
            double backupStaleHours
    ) {
        List<IssuesLiveRecord> detected = new ArrayList<>();
        detected.addAll(fromLagIssues(cache));
        detected.addAll(fromLogStale(cache));
        detected.addAll(fromDisk(cache, diskFillWarnDays));
        detected.addAll(fromBackups(cache, backupTrackingEnabled, backupStaleHours));
        detected.addAll(fromModIssues(cache));
        detected.addAll(fromModJarDrift(cache));
        detected.addAll(fromClientOnServer(cache, clientOnServerIssuesEnabled));
        detected.addAll(fromExternalKill(cache, externalKillDetectEnabled));
        detected.addAll(fromSoftHang(cache));
        detected.addAll(fromSilentFails(cache, silentFailDetectEnabled));
        detected.addAll(fromWorldPressure(cache, worldPressureEnabled));
        detected.addAll(fromJoinClinic(cache, joinClinicEnabled));
        detected.addAll(fromWorldRiskDisabled(cache, worldRiskEnabled));

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
        boolean hasSoftHang = detected.stream().anyMatch(r -> "SOFT_HANG".equals(r.normalizedKey()));
        if (!hasSoftHang) {
            cur = IssuesLiveStore.resolve(cur, "SOFT_HANG", nowIso);
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
            cur = IssuesLiveStore.resolve(cur, "BACKUP_VERIFY_FAILED", nowIso);
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
            if (k.startsWith("CLIENT_ON_SERVER") && !detectedKeys.contains(k)) {
                cur = IssuesLiveStore.resolve(cur, k, nowIso);
            }
            if (k.startsWith("EXTERNAL_KILL") && !detectedKeys.contains(k)) {
                cur = IssuesLiveStore.resolve(cur, k, nowIso);
            }
            if (k.startsWith("SILENT_FAIL") && !detectedKeys.contains(k)) {
                cur = IssuesLiveStore.resolve(cur, k, nowIso);
            }
            if (k.startsWith("WORLD_PRESSURE") && !detectedKeys.contains(k)) {
                cur = IssuesLiveStore.resolve(cur, k, nowIso);
            }
            if (k.startsWith("JOIN_SYNC") && !detectedKeys.contains(k)) {
                cur = IssuesLiveStore.resolve(cur, k, nowIso);
            }
            if (k.startsWith("WORLD_RISK_DISABLED") && !detectedKeys.contains(k)) {
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
