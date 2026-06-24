package dev.mcstatus.watchtower.core.ops;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import dev.mcstatus.watchtower.core.collect.CrashMtimeScanner;
import dev.mcstatus.watchtower.core.incident.IncidentReader;
import dev.mcstatus.watchtower.core.live.PerformanceRollupWriter;
import dev.mcstatus.watchtower.core.report.StateManager;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Writes and reconciles {@code watchtower/ops-cache.json}.
 */
public final class OpsCacheWriter {

    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    private static final DateTimeFormatter ISO = DateTimeFormatter.ISO_OFFSET_DATE_TIME;

    private OpsCacheWriter() {
    }

    public static JsonObject applyScanResult(
            Path opsCachePath,
            Path statePath,
            Path rollupsPath,
            CrashMtimeScanner.ScanResult scan,
            String source
    ) throws IOException {
        JsonObject cache = OpsCacheReader.load(opsCachePath);
        int seq = StateManager.incrementOpsCacheSeq(statePath);
        StateManager.updateCrashMtimeIndex(statePath, scan.updatedIndex());

        ZonedDateTime now = ZonedDateTime.now(ZoneId.systemDefault());
        cache.addProperty(OpsCacheSchema.SCHEMA_VERSION_KEY, OpsCacheSchema.SCHEMA_VERSION);
        cache.addProperty(OpsCacheSchema.UPDATED_AT, now.format(ISO));
        cache.addProperty(OpsCacheSchema.OPS_CACHE_SEQ, seq);
        cache.add(OpsCacheSchema.CRASHES, buildCrashesBlock(scan, source));
        if (!cache.has(OpsCacheSchema.SCORECARD)) {
            cache.add(OpsCacheSchema.SCORECARD, buildScorecardBlock(rollupsPath));
        } else {
            cache.add(OpsCacheSchema.SCORECARD, buildScorecardBlock(rollupsPath));
        }
        writeAtomic(opsCachePath, cache);
        return cache;
    }

    public static JsonObject applyActivityScanResult(
            Path opsCachePath,
            Path statePath,
            Path rollupsPath,
            ActivityLedgerScanner.ScanResult scan
    ) throws IOException {
        OpsLogTailScanner.ScanResult unified = new OpsLogTailScanner.ScanResult(
                scan.scannedAt(),
                scan.newCount(),
                scan.events(),
                new JsonArray(),
                List.of(),
                List.of(),
                scan.updatedOffset(),
                scan.context(),
                scan.newCount() > 0
        );
        return applyOpsLogScanResult(opsCachePath, statePath, rollupsPath, unified, null, null, null);
    }

    public static JsonObject applyOpsLogScanResult(
            Path opsCachePath,
            Path statePath,
            Path rollupsPath,
            OpsLogTailScanner.ScanResult scan,
            JsonObject pregenHint,
            JsonObject lagHint,
            JsonObject logStale
    ) throws IOException {
        JsonObject cache = OpsCacheReader.load(opsCachePath);
        if (!scan.hadNewData() && cache.has(OpsCacheSchema.MOD_LOG_ERRORS)) {
            ZonedDateTime now = ZonedDateTime.now(ZoneId.systemDefault());
            JsonObject activity = cache.has(OpsCacheSchema.ACTIVITY)
                    ? cache.getAsJsonObject(OpsCacheSchema.ACTIVITY).deepCopy()
                    : new JsonObject();
            activity.addProperty(OpsCacheSchema.ACTIVITY_SCANNED_AT, now.format(ISO));
            cache.add(OpsCacheSchema.ACTIVITY, activity);
            if (logStale != null) {
                cache.add(OpsCacheSchema.LOG_STALE, logStale.deepCopy());
            }
            if (pregenHint != null || lagHint != null || logStale != null || !scan.backgroundJobs().isEmpty()) {
                cache.add(OpsCacheSchema.RIGHT_NOW, buildRightNowBlock(cache, scan, pregenHint, lagHint, now));
            }
            writeAtomic(opsCachePath, cache);
            return cache;
        }

        int seq = StateManager.incrementOpsCacheSeq(statePath);
        int ledgerSeq = cache.has(OpsCacheSchema.LEDGER_SEQ) ? cache.get(OpsCacheSchema.LEDGER_SEQ).getAsInt() : 0;
        ledgerSeq++;

        JsonArray mergedEvents = mergeActivityEvents(cache, scan.activityEvents(), false);
        JsonArray mergedModErrors = mergeModLogErrors(cache, scan.modLogErrors());
        JsonArray modPeek = ModIssuePeekBuilder.buildPeekEntries(mergedModErrors);

        ZonedDateTime now = ZonedDateTime.now(ZoneId.systemDefault());
        cache.addProperty(OpsCacheSchema.SCHEMA_VERSION_KEY, OpsCacheSchema.SCHEMA_VERSION);
        cache.addProperty(OpsCacheSchema.UPDATED_AT, now.format(ISO));
        cache.addProperty(OpsCacheSchema.OPS_CACHE_SEQ, seq);
        cache.addProperty(OpsCacheSchema.LEDGER_SEQ, ledgerSeq);

        JsonObject activity = new JsonObject();
        activity.addProperty(OpsCacheSchema.ACTIVITY_SCANNED_AT, now.format(ISO));
        activity.addProperty(OpsCacheSchema.ACTIVITY_NEW_COUNT, scan.newActivityCount());
        activity.add(OpsCacheSchema.ACTIVITY_EVENTS, mergedEvents);
        cache.add(OpsCacheSchema.ACTIVITY, activity);

        JsonObject modBlock = new JsonObject();
        modBlock.addProperty(OpsCacheSchema.MOD_LOG_SCANNED_AT, now.format(ISO));
        modBlock.addProperty(OpsCacheSchema.MOD_LOG_NEW_COUNT, countNewModErrors(scan.modLogErrors()));
        modBlock.add(OpsCacheSchema.MOD_LOG_ENTRIES, mergedModErrors);
        cache.add(OpsCacheSchema.MOD_LOG_ERRORS, modBlock);

        JsonObject modIssues = new JsonObject();
        modIssues.addProperty(OpsCacheSchema.MOD_ISSUES_UPDATED_AT, now.format(ISO));
        modIssues.addProperty(OpsCacheSchema.MOD_ISSUES_ACTIVE_COUNT, modPeek.size());
        modIssues.add(OpsCacheSchema.MOD_ISSUES_ENTRIES, modPeek);
        cache.add(OpsCacheSchema.MOD_ISSUES, modIssues);

        if (logStale != null) {
            cache.add(OpsCacheSchema.LOG_STALE, logStale.deepCopy());
        }

        cache.add(OpsCacheSchema.RIGHT_NOW, buildRightNowBlock(cache, scan, pregenHint, lagHint, now));

        if (!cache.has(OpsCacheSchema.SCORECARD)) {
            cache.add(OpsCacheSchema.SCORECARD, buildScorecardBlock(rollupsPath));
        }
        writeAtomic(opsCachePath, cache);
        return cache;
    }

    public static JsonObject applyRunningMods(Path opsCachePath, Path statePath, JsonArray mods) throws IOException {
        JsonObject cache = OpsCacheReader.load(opsCachePath);
        ZonedDateTime now = ZonedDateTime.now(ZoneId.systemDefault());
        JsonObject block = new JsonObject();
        block.addProperty(OpsCacheSchema.RUNNING_MODS_SCANNED_AT, now.format(ISO));
        block.addProperty(OpsCacheSchema.RUNNING_MODS_COUNT, mods.size());
        block.add(OpsCacheSchema.RUNNING_MODS_MODS, mods.deepCopy());
        cache.add(OpsCacheSchema.RUNNING_MODS, block);
        cache.addProperty(OpsCacheSchema.SCHEMA_VERSION_KEY, OpsCacheSchema.SCHEMA_VERSION);
        cache.addProperty(OpsCacheSchema.UPDATED_AT, now.format(ISO));
        if (statePath != null) {
            cache.addProperty(OpsCacheSchema.OPS_CACHE_SEQ, StateManager.incrementOpsCacheSeq(statePath));
        }
        writeAtomic(opsCachePath, cache);
        return cache;
    }

    public static JsonObject applyModsInventory(
            Path opsCachePath,
            Path statePath,
            JsonObject block
    ) throws IOException {
        JsonObject cache = OpsCacheReader.load(opsCachePath);
        cache.add(OpsCacheSchema.MODS_INVENTORY, block);
        cache.addProperty(OpsCacheSchema.SCHEMA_VERSION_KEY, OpsCacheSchema.SCHEMA_VERSION);
        cache.addProperty(OpsCacheSchema.UPDATED_AT, ZonedDateTime.now(ZoneId.systemDefault()).format(ISO));
        if (statePath != null) {
            cache.addProperty(OpsCacheSchema.OPS_CACHE_SEQ, StateManager.incrementOpsCacheSeq(statePath));
        }
        writeAtomic(opsCachePath, cache);
        return cache;
    }

    public static JsonObject applyDiskJump(
            Path opsCachePath,
            Path statePath,
            JsonObject block
    ) throws IOException {
        JsonObject cache = OpsCacheReader.load(opsCachePath);
        cache.add(OpsCacheSchema.DISK_JUMP, block);
        cache.addProperty(OpsCacheSchema.SCHEMA_VERSION_KEY, OpsCacheSchema.SCHEMA_VERSION);
        cache.addProperty(OpsCacheSchema.UPDATED_AT, ZonedDateTime.now(ZoneId.systemDefault()).format(ISO));
        if (statePath != null) {
            cache.addProperty(OpsCacheSchema.OPS_CACHE_SEQ, StateManager.incrementOpsCacheSeq(statePath));
        }
        writeAtomic(opsCachePath, cache);
        return cache;
    }

    public static JsonObject applyBackupsLive(
            Path opsCachePath,
            Path statePath,
            JsonObject lastBackup,
            JsonElement backupInventory
    ) throws IOException {
        JsonObject cache = OpsCacheReader.load(opsCachePath);
        ZonedDateTime now = ZonedDateTime.now(ZoneId.systemDefault());
        JsonObject block = new JsonObject();
        block.addProperty("scanned_at", now.format(ISO));
        if (lastBackup != null) {
            block.add("last_backup", lastBackup.deepCopy());
        }
        if (backupInventory != null) {
            block.add("inventory_summary", backupInventory.deepCopy());
        }
        cache.add(OpsCacheSchema.BACKUPS_LIVE, block);
        cache.addProperty(OpsCacheSchema.SCHEMA_VERSION_KEY, OpsCacheSchema.SCHEMA_VERSION);
        cache.addProperty(OpsCacheSchema.UPDATED_AT, now.format(ISO));
        if (statePath != null) {
            cache.addProperty(OpsCacheSchema.OPS_CACHE_SEQ, StateManager.incrementOpsCacheSeq(statePath));
        }
        writeAtomic(opsCachePath, cache);
        return cache;
    }

    public static JsonObject applyBackupExternal(
            Path opsCachePath,
            Path statePath,
            JsonObject backupExternal
    ) throws IOException {
        JsonObject cache = OpsCacheReader.load(opsCachePath);
        ZonedDateTime now = ZonedDateTime.now(ZoneId.systemDefault());
        if (backupExternal != null) {
            cache.add(OpsCacheSchema.BACKUP_EXTERNAL, backupExternal.deepCopy());
        }
        cache.addProperty(OpsCacheSchema.SCHEMA_VERSION_KEY, OpsCacheSchema.SCHEMA_VERSION);
        cache.addProperty(OpsCacheSchema.UPDATED_AT, now.format(ISO));
        if (statePath != null) {
            cache.addProperty(OpsCacheSchema.OPS_CACHE_SEQ, StateManager.incrementOpsCacheSeq(statePath));
        }
        writeAtomic(opsCachePath, cache);
        return cache;
    }

    private static int countNewModErrors(JsonArray incoming) {
        if (incoming == null) {
            return 0;
        }
        int n = 0;
        for (JsonElement el : incoming) {
            if (el.isJsonObject() && el.getAsJsonObject().has("total")) {
                n += el.getAsJsonObject().get("total").getAsInt();
            } else if (el.isJsonObject()) {
                n++;
            }
        }
        return n;
    }

    private static JsonArray mergeModLogErrors(JsonObject cache, JsonArray incoming) {
        Map<String, JsonObject> merged = new LinkedHashMap<>();
        long cutoff = Instant.now().getEpochSecond()
                - (long) OpsCacheSchema.MOD_ERROR_RETENTION_DAYS * 86400L;

        if (cache.has(OpsCacheSchema.MOD_LOG_ERRORS)) {
            JsonObject block = cache.getAsJsonObject(OpsCacheSchema.MOD_LOG_ERRORS);
            if (block.has(OpsCacheSchema.MOD_LOG_ENTRIES)) {
                for (JsonElement el : block.getAsJsonArray(OpsCacheSchema.MOD_LOG_ENTRIES)) {
                    if (!el.isJsonObject()) {
                        continue;
                    }
                    JsonObject row = el.getAsJsonObject();
                    String key = modErrorKey(row);
                    if (row.has("last_seen_epoch") && row.get("last_seen_epoch").getAsLong() < cutoff) {
                        continue;
                    }
                    merged.put(key, row.deepCopy());
                }
            }
        }

        long nowEpoch = Instant.now().getEpochSecond();
        if (incoming != null) {
            for (JsonElement el : incoming) {
                if (!el.isJsonObject()) {
                    continue;
                }
                JsonObject row = el.getAsJsonObject().deepCopy();
                row.addProperty("last_seen_epoch", nowEpoch);
                String key = modErrorKey(row);
                if (merged.containsKey(key)) {
                    JsonObject existing = merged.get(key);
                    int total = (existing.has("total") ? existing.get("total").getAsInt() : 0)
                            + (row.has("total") ? row.get("total").getAsInt() : 1);
                    existing.addProperty("total", total);
                    if (row.has("sample_line")) {
                        existing.addProperty("sample_line", row.get("sample_line").getAsString());
                    }
                } else {
                    if (!row.has("total")) {
                        row.addProperty("total", 1);
                    }
                    merged.put(key, row);
                }
            }
        }

        JsonArray arr = new JsonArray();
        merged.values().stream()
                .sorted((a, b) -> Integer.compare(
                        b.has("total") ? b.get("total").getAsInt() : 0,
                        a.has("total") ? a.get("total").getAsInt() : 0))
                .forEach(arr::add);
        return arr;
    }

    private static String modErrorKey(JsonObject row) {
        String modId = row.has("mod_id") ? row.get("mod_id").getAsString() : "unknown";
        String cat = row.has("top_category") ? row.get("top_category").getAsString()
                : (row.has("by_category") ? firstCategory(row) : "logger_error");
        return modId + "|" + cat;
    }

    private static String firstCategory(JsonObject row) {
        if (!row.has("by_category") || !row.get("by_category").isJsonObject()) {
            return "logger_error";
        }
        JsonObject cats = row.getAsJsonObject("by_category");
        String best = "logger_error";
        int bestN = 0;
        for (String k : cats.keySet()) {
            int n = cats.get(k).getAsInt();
            if (n > bestN) {
                bestN = n;
                best = k;
            }
        }
        return best;
    }

    private static JsonObject buildRightNowBlock(
            JsonObject cache,
            OpsLogTailScanner.ScanResult scan,
            JsonObject pregenHint,
            JsonObject lagHint,
            ZonedDateTime now
    ) {
        JsonObject block = new JsonObject();
        block.addProperty(OpsCacheSchema.RIGHT_NOW_UPDATED_AT, now.format(ISO));
        JsonArray signals = new JsonArray();

        if (pregenHint != null) {
            if (pregenHint.has("chunky_active") && pregenHint.get("chunky_active").getAsBoolean()) {
                signals.add(signal("chunky_pregen", "Chunky pregen active",
                        "info", pregenHint.has("chunky_detail") ? pregenHint.get("chunky_detail").getAsString() : null, "overview"));
            }
            if (pregenHint.has("dh_active") && pregenHint.get("dh_active").getAsBoolean()) {
                signals.add(signal("dh_pregen", "DH pregen active",
                        "info", pregenHint.has("dh_detail") ? pregenHint.get("dh_detail").getAsString() : null, "overview"));
            }
        }

        for (JsonObject kube : scan.kubejsFailures()) {
            signals.add(signal("kubejs", "KubeJS script error",
                    "warning", kube.has("sample_line") ? kube.get("sample_line").getAsString() : null, "mods"));
        }

        int modCount = 0;
        if (cache.has(OpsCacheSchema.MOD_ISSUES)) {
            JsonObject mi = cache.getAsJsonObject(OpsCacheSchema.MOD_ISSUES);
            if (mi.has(OpsCacheSchema.MOD_ISSUES_ACTIVE_COUNT)) {
                modCount = mi.get(OpsCacheSchema.MOD_ISSUES_ACTIVE_COUNT).getAsInt();
            }
        }
        if (modCount == 0 && scan.modLogErrors() != null) {
            for (JsonElement el : scan.modLogErrors()) {
                if (el.isJsonObject() && !"client_noise".equals(el.getAsJsonObject().get("mod_id").getAsString())) {
                    modCount++;
                }
            }
        }
        if (modCount > 0) {
            signals.add(signal("mod_errors", modCount + " mod log error" + (modCount == 1 ? "" : "s"),
                    "warning", null, "mods"));
        }

        int lagActive = 0;
        if (cache.has(OpsCacheSchema.LAG_ISSUES)) {
            JsonObject li = cache.getAsJsonObject(OpsCacheSchema.LAG_ISSUES);
            if (li.has(OpsCacheSchema.LAG_ISSUES_ACTIVE_COUNT)) {
                lagActive = li.get(OpsCacheSchema.LAG_ISSUES_ACTIVE_COUNT).getAsInt();
            }
        }
        if (lagActive > 0) {
            signals.add(signal("lag", lagActive + " active lag incident" + (lagActive == 1 ? "" : "s"),
                    "warning", null, "issues"));
        }

        for (JsonObject job : scan.backgroundJobs()) {
            String type = job.has("type") ? job.get("type").getAsString() : "job";
            String detail = job.has("detail") ? job.get("detail").getAsString() : "";
            switch (type) {
                case "backup_job" -> signals.add(signal("backup_job", "Backup in progress",
                        "warning", detail.isEmpty() ? null : detail, "backups"));
                case "restart_scheduled" -> signals.add(signal("restart_scheduled", "Restart scheduled",
                        "warning", detail.isEmpty() ? null : detail, "activity"));
                case "chunky_pregen", "dh_pregen" -> { /* covered by pregen hint when live */ }
                default -> signals.add(signal(type, type.replace('_', ' '), "info",
                        detail.isEmpty() ? null : detail, "overview"));
            }
        }

        if (cache.has(OpsCacheSchema.LOG_STALE)) {
            JsonObject ls = cache.getAsJsonObject(OpsCacheSchema.LOG_STALE);
            if (ls.has("active") && ls.get("active").getAsBoolean()) {
                String detail = ls.has("gap_minutes")
                        ? String.format("%.0f min since last log write", ls.get("gap_minutes").getAsDouble())
                        : null;
                signals.add(signal("log_stale", "Log output stale", "warning", detail, "issues"));
            }
        }

        block.add(OpsCacheSchema.RIGHT_NOW_SIGNALS, signals);
        return block;
    }

    private static JsonObject signal(String type, String label, String severity, String detail, String tab) {
        JsonObject s = new JsonObject();
        s.addProperty("type", type);
        s.addProperty("label", label);
        s.addProperty("severity", severity);
        if (detail != null) {
            s.addProperty("detail", detail);
        }
        if (tab != null) {
            s.addProperty("tab", tab);
        }
        return s;
    }

    public static JsonObject applyLagIncident(
            Path opsCachePath,
            Path statePath,
            JsonObject incident,
            JsonObject lagIssueEntry,
            JsonObject lagIncidentEvent
    ) throws IOException {
        JsonObject cache = OpsCacheReader.load(opsCachePath);
        int seq = StateManager.incrementOpsCacheSeq(statePath);
        int ledgerSeq = cache.has(OpsCacheSchema.LEDGER_SEQ) ? cache.get(OpsCacheSchema.LEDGER_SEQ).getAsInt() : 0;
        ledgerSeq++;

        List<JsonObject> newEvents = new java.util.ArrayList<>();
        if (lagIncidentEvent != null) {
            newEvents.add(lagIncidentEvent);
        }
        JsonArray merged = mergeActivityEvents(cache, newEvents, false);

        JsonObject lagIssues = cache.has(OpsCacheSchema.LAG_ISSUES)
                ? cache.getAsJsonObject(OpsCacheSchema.LAG_ISSUES).deepCopy()
                : new JsonObject();
        JsonArray entries = lagIssues.has(OpsCacheSchema.LAG_ISSUES_ENTRIES)
                ? lagIssues.getAsJsonArray(OpsCacheSchema.LAG_ISSUES_ENTRIES)
                : new JsonArray();
        JsonArray updatedEntries = new JsonArray();
        updatedEntries.add(lagIssueEntry);
        for (JsonElement el : entries) {
            updatedEntries.add(el.deepCopy());
        }
        while (updatedEntries.size() > 50) {
            updatedEntries.remove(updatedEntries.size() - 1);
        }
        int active = 0;
        for (JsonElement el : updatedEntries) {
            if (!el.getAsJsonObject().has("resolved")
                    || !el.getAsJsonObject().get("resolved").getAsBoolean()) {
                active++;
            }
        }
        ZonedDateTime now = ZonedDateTime.now(ZoneId.systemDefault());
        lagIssues.addProperty(OpsCacheSchema.LAG_ISSUES_UPDATED_AT, now.format(ISO));
        lagIssues.addProperty(OpsCacheSchema.LAG_ISSUES_ACTIVE_COUNT, active);
        lagIssues.add(OpsCacheSchema.LAG_ISSUES_ENTRIES, updatedEntries);

        cache.addProperty(OpsCacheSchema.SCHEMA_VERSION_KEY, OpsCacheSchema.SCHEMA_VERSION);
        cache.addProperty(OpsCacheSchema.UPDATED_AT, now.format(ISO));
        cache.addProperty(OpsCacheSchema.OPS_CACHE_SEQ, seq);
        cache.addProperty(OpsCacheSchema.LEDGER_SEQ, ledgerSeq);
        cache.add(OpsCacheSchema.LAG_ISSUES, lagIssues);

        JsonObject activity = new JsonObject();
        activity.addProperty(OpsCacheSchema.ACTIVITY_SCANNED_AT, now.format(ISO));
        activity.addProperty(OpsCacheSchema.ACTIVITY_NEW_COUNT, lagIncidentEvent != null ? 1 : 0);
        activity.add(OpsCacheSchema.ACTIVITY_EVENTS, merged);
        cache.add(OpsCacheSchema.ACTIVITY, activity);

        writeAtomic(opsCachePath, cache);
        return cache;
    }

    public static JsonObject applyPerformanceSpikeEvents(
            Path opsCachePath,
            Path statePath,
            JsonArray stickyEpisodes
    ) throws IOException {
        if (stickyEpisodes == null || stickyEpisodes.isEmpty()) {
            return OpsCacheReader.load(opsCachePath);
        }
        JsonObject cache = OpsCacheReader.load(opsCachePath);
        List<JsonObject> incoming = new ArrayList<>();
        ZonedDateTime now = ZonedDateTime.now(ZoneId.systemDefault());
        long nowEpoch = Instant.now().getEpochSecond();
        for (JsonElement el : stickyEpisodes) {
            if (!el.isJsonObject()) {
                continue;
            }
            JsonObject ep = el.getAsJsonObject();
            if (!ep.has("ended_at")) {
                continue;
            }
            Instant ended = dev.mcstatus.watchtower.core.util.TimeParse.parseTime(ep.get("ended_at").getAsString());
            if (ended == null || nowEpoch - ended.getEpochSecond() > 600) {
                continue;
            }
            JsonObject ev = new JsonObject();
            ev.addProperty(OpsCacheSchema.EVENT_TIME, ep.get("ended_at").getAsString());
            ev.addProperty(OpsCacheSchema.EVENT_TYPE, "performance_spike");
            ev.addProperty(OpsCacheSchema.EVENT_DETAIL,
                    ep.has("narrative") ? ep.get("narrative").getAsString() : "Sticky lag after players left");
            ev.addProperty(OpsCacheSchema.EVENT_SOURCE, OpsCacheSchema.SOURCE_SCAN);
            incoming.add(ev);
        }
        if (incoming.isEmpty()) {
            return cache;
        }
        int seq = StateManager.incrementOpsCacheSeq(statePath);
        int ledgerSeq = cache.has(OpsCacheSchema.LEDGER_SEQ) ? cache.get(OpsCacheSchema.LEDGER_SEQ).getAsInt() : 0;
        ledgerSeq++;
        JsonArray merged = mergeActivityEvents(cache, incoming, false);
        cache.addProperty(OpsCacheSchema.SCHEMA_VERSION_KEY, OpsCacheSchema.SCHEMA_VERSION);
        cache.addProperty(OpsCacheSchema.UPDATED_AT, now.format(ISO));
        cache.addProperty(OpsCacheSchema.OPS_CACHE_SEQ, seq);
        cache.addProperty(OpsCacheSchema.LEDGER_SEQ, ledgerSeq);
        JsonObject activity = cache.has(OpsCacheSchema.ACTIVITY)
                ? cache.getAsJsonObject(OpsCacheSchema.ACTIVITY).deepCopy()
                : new JsonObject();
        activity.addProperty(OpsCacheSchema.ACTIVITY_SCANNED_AT, now.format(ISO));
        activity.addProperty(OpsCacheSchema.ACTIVITY_NEW_COUNT, incoming.size());
        activity.add(OpsCacheSchema.ACTIVITY_EVENTS, merged);
        cache.add(OpsCacheSchema.ACTIVITY, activity);
        writeAtomic(opsCachePath, cache);
        return cache;
    }

    public static JsonObject updateLagIssueResolution(
            Path opsCachePath,
            double tps,
            double mspt,
            double tpsWarn,
            double msptWarn
    ) throws IOException {
        JsonObject cache = OpsCacheReader.load(opsCachePath);
        if (!cache.has(OpsCacheSchema.LAG_ISSUES)) {
            return cache;
        }
        JsonObject lagIssues = cache.getAsJsonObject(OpsCacheSchema.LAG_ISSUES).deepCopy();
        LagIssueBuilder.updateResolvedFlags(lagIssues, tps, mspt, tpsWarn, msptWarn,
                Instant.now().getEpochSecond());
        cache.add(OpsCacheSchema.LAG_ISSUES, lagIssues);
        writeAtomic(opsCachePath, cache);
        return cache;
    }

    public static JsonObject reconcileFromFacts(
            Path opsCachePath,
            Path statePath,
            Path rollupsPath,
            JsonObject facts,
            int lookbackHours
    ) throws IOException {
        String serverDir = facts.has("meta") && facts.getAsJsonObject("meta").has("server_dir")
                ? facts.getAsJsonObject("meta").get("server_dir").getAsString()
                : null;
        if (serverDir == null || serverDir.isBlank()) {
            return OpsCacheReader.load(opsCachePath);
        }

        double cutoff = Instant.now().getEpochSecond() - (long) lookbackHours * 3600L;
        CrashMtimeScanner.ScanResult scan = CrashMtimeScanner.scanForReconcile(serverDir, statePath, cutoff);

        Map<String, JsonObject> merged = new LinkedHashMap<>();
        for (CrashMtimeScanner.CrashEntry entry : scan.entries()) {
            JsonObject row = entryToJson(entry, OpsCacheSchema.SOURCE_SCAN);
            merged.put(entry.file(), row);
        }

        if (facts.has("optional") && facts.getAsJsonObject("optional").has("crash_summaries")) {
            for (JsonElement el : facts.getAsJsonObject("optional").getAsJsonArray("crash_summaries")) {
                if (!el.isJsonObject()) {
                    continue;
                }
                JsonObject summary = el.getAsJsonObject();
                String file = summary.has("file") ? summary.get("file").getAsString() : null;
                if (file == null || file.isBlank()) {
                    continue;
                }
                String bare = bareFile(file);
                JsonObject row = merged.getOrDefault(bare, new JsonObject());
                row.addProperty(OpsCacheSchema.ENTRY_FILE, bare);
                row.addProperty(OpsCacheSchema.ENTRY_SOURCE, OpsCacheSchema.SOURCE_REPORT);
                copyIfPresent(summary, row, "time");
                copyIfPresent(summary, row, "summary");
                copyIfPresent(summary, row, "display_label");
                copyIfPresent(summary, row, "exception");
                copyIfPresent(summary, row, "mod_file");
                copyIfPresent(summary, row, "category");
                copyIfPresent(summary, row, "suspect_mod_id");
                copyIfPresent(summary, row, "plain_english");
                copyIfPresent(summary, row, "historical");
                if (!row.has(OpsCacheSchema.ENTRY_MTIME) && summary.has("time")) {
                    Instant ct = dev.mcstatus.watchtower.core.util.TimeParse.parseTime(summary.get("time").getAsString());
                    if (ct != null) {
                        row.addProperty(OpsCacheSchema.ENTRY_MTIME, ct.getEpochSecond());
                    }
                }
                if (summary.has("acknowledged")) {
                    row.add("acknowledged", summary.get("acknowledged"));
                }
                if (summary.has("pre_crash")) {
                    row.add("pre_crash", summary.get("pre_crash").deepCopy());
                }
                merged.put(bare, row);
            }
        }

        JsonArray entriesArr = new JsonArray();
        merged.values().stream()
                .sorted((a, b) -> Long.compare(
                        b.has(OpsCacheSchema.ENTRY_MTIME) ? b.get(OpsCacheSchema.ENTRY_MTIME).getAsLong() : 0,
                        a.has(OpsCacheSchema.ENTRY_MTIME) ? a.get(OpsCacheSchema.ENTRY_MTIME).getAsLong() : 0))
                .forEach(entriesArr::add);

        JsonObject acks = StateManager.getAcknowledgedCrashes(statePath);
        int unreviewed = 0;
        for (JsonElement el : entriesArr) {
            JsonObject row = el.getAsJsonObject();
            String file = row.get(OpsCacheSchema.ENTRY_FILE).getAsString();
            if (!StateManager.isCrashAcked(acks, file)) {
                unreviewed++;
            }
        }

        JsonObject cache = OpsCacheReader.load(opsCachePath);
        int seq = StateManager.incrementOpsCacheSeq(statePath);
        StateManager.updateCrashMtimeIndex(statePath, scan.updatedIndex());

        ZonedDateTime now = ZonedDateTime.now(ZoneId.systemDefault());
        cache.addProperty(OpsCacheSchema.SCHEMA_VERSION_KEY, OpsCacheSchema.SCHEMA_VERSION);
        cache.addProperty(OpsCacheSchema.UPDATED_AT, now.format(ISO));
        cache.addProperty(OpsCacheSchema.REPORT_RECONCILE_AT, now.format(ISO));
        cache.addProperty(OpsCacheSchema.OPS_CACHE_SEQ, seq);

        JsonObject crashes = new JsonObject();
        crashes.addProperty(OpsCacheSchema.CRASHES_SCANNED_AT, now.format(ISO));
        crashes.addProperty(OpsCacheSchema.CRASHES_COUNT, entriesArr.size());
        crashes.addProperty(OpsCacheSchema.CRASHES_UNREVIEWED, unreviewed);
        if (!entriesArr.isEmpty()) {
            crashes.add(OpsCacheSchema.CRASHES_LATEST, entriesArr.get(0).deepCopy());
        }
        crashes.add(OpsCacheSchema.CRASHES_ENTRIES, entriesArr);
        cache.add(OpsCacheSchema.CRASHES, crashes);
        cache.add(OpsCacheSchema.SCORECARD, buildScorecardBlock(rollupsPath));

        if (facts.has("events")) {
            JsonArray reportEvents = facts.getAsJsonArray("events");
            List<JsonObject> parsed = new java.util.ArrayList<>();
            for (JsonElement el : reportEvents) {
                if (el.isJsonObject()) {
                    JsonObject ev = el.getAsJsonObject().deepCopy();
                    ev.addProperty(OpsCacheSchema.EVENT_SOURCE, OpsCacheSchema.SOURCE_REPORT);
                    parsed.add(ev);
                }
            }
            JsonArray mergedEvents = mergeActivityEvents(cache, parsed, false);
            JsonObject activity = cache.has(OpsCacheSchema.ACTIVITY)
                    ? cache.getAsJsonObject(OpsCacheSchema.ACTIVITY).deepCopy()
                    : new JsonObject();
            activity.addProperty(OpsCacheSchema.ACTIVITY_SCANNED_AT, now.format(ISO));
            activity.add(OpsCacheSchema.ACTIVITY_EVENTS, mergedEvents);
            cache.add(OpsCacheSchema.ACTIVITY, activity);
        }

        reconcileLagIssues(Path.of(serverDir), (long) cutoff, cache, now);
        reconcileModLogErrorsFromFacts(facts, cache, now);

        writeAtomic(opsCachePath, cache);
        return cache;
    }

    private static void reconcileModLogErrorsFromFacts(JsonObject facts, JsonObject cache, ZonedDateTime now) {
        if (!facts.has("optional") || !facts.getAsJsonObject("optional").has("mod_log_errors")) {
            return;
        }
        JsonArray reportErrors = facts.getAsJsonObject("optional").getAsJsonArray("mod_log_errors");
        JsonArray merged = mergeModLogErrors(cache, reportErrors);
        for (JsonElement el : merged) {
            if (el.isJsonObject()) {
                el.getAsJsonObject().addProperty(OpsCacheSchema.ENTRY_SOURCE, OpsCacheSchema.SOURCE_REPORT);
            }
        }
        JsonArray modPeek = ModIssuePeekBuilder.buildPeekEntries(merged);

        JsonObject modBlock = new JsonObject();
        modBlock.addProperty(OpsCacheSchema.MOD_LOG_SCANNED_AT, now.format(ISO));
        modBlock.addProperty(OpsCacheSchema.MOD_LOG_NEW_COUNT, 0);
        modBlock.add(OpsCacheSchema.MOD_LOG_ENTRIES, merged);
        cache.add(OpsCacheSchema.MOD_LOG_ERRORS, modBlock);

        JsonObject modIssues = new JsonObject();
        modIssues.addProperty(OpsCacheSchema.MOD_ISSUES_UPDATED_AT, now.format(ISO));
        modIssues.addProperty(OpsCacheSchema.MOD_ISSUES_ACTIVE_COUNT, modPeek.size());
        modIssues.add(OpsCacheSchema.MOD_ISSUES_ENTRIES, modPeek);
        cache.add(OpsCacheSchema.MOD_ISSUES, modIssues);
    }

    private static void reconcileLagIssues(Path serverDir, long cutoffEpoch, JsonObject cache, ZonedDateTime now)
            throws IOException {
        Path incidentsDir = serverDir.resolve("watchtower").resolve("incidents");
        List<JsonObject> summaries = IncidentReader.listSummaries(incidentsDir, 100);

        Map<String, JsonObject> merged = new LinkedHashMap<>();
        if (cache.has(OpsCacheSchema.LAG_ISSUES)) {
            JsonObject existing = cache.getAsJsonObject(OpsCacheSchema.LAG_ISSUES);
            if (existing.has(OpsCacheSchema.LAG_ISSUES_ENTRIES)) {
                for (JsonElement el : existing.getAsJsonArray(OpsCacheSchema.LAG_ISSUES_ENTRIES)) {
                    if (!el.isJsonObject()) {
                        continue;
                    }
                    JsonObject entry = el.getAsJsonObject();
                    if (entryEpoch(entry) < cutoffEpoch) {
                        continue;
                    }
                    String key = lagIssueKey(entry);
                    if (key != null) {
                        merged.put(key, entry.deepCopy());
                    }
                }
            }
        }

        List<JsonObject> incidentEvents = new ArrayList<>();
        for (JsonObject summary : summaries) {
            if (!summary.has("id")) {
                continue;
            }
            String id = summary.get("id").getAsString();
            Instant pinned = summary.has("pinned_at")
                    ? dev.mcstatus.watchtower.core.util.TimeParse.parseTime(summary.get("pinned_at").getAsString())
                    : null;
            if (pinned != null && pinned.getEpochSecond() < cutoffEpoch) {
                continue;
            }
            JsonObject full = IncidentReader.loadById(incidentsDir, id);
            if (full == null) {
                continue;
            }
            merged.put(id, LagIssueBuilder.buildPeekEntry(full));
            if (pinned != null) {
                JsonObject ev = ActivityLedgerScanner.lagIncidentEvent(id, pinned);
                ev.addProperty(OpsCacheSchema.EVENT_SOURCE, OpsCacheSchema.SOURCE_REPORT);
                incidentEvents.add(ev);
            }
        }

        List<JsonObject> sorted = new ArrayList<>(merged.values());
        sorted.sort((a, b) -> Long.compare(entryEpoch(b), entryEpoch(a)));
        JsonArray entriesArr = new JsonArray();
        sorted.stream().limit(50).forEach(entriesArr::add);

        int active = 0;
        for (JsonElement el : entriesArr) {
            JsonObject row = el.getAsJsonObject();
            if (!row.has("resolved") || !row.get("resolved").getAsBoolean()) {
                active++;
            }
        }

        JsonObject lagIssues = new JsonObject();
        lagIssues.addProperty(OpsCacheSchema.LAG_ISSUES_UPDATED_AT, now.format(ISO));
        lagIssues.addProperty(OpsCacheSchema.LAG_ISSUES_ACTIVE_COUNT, active);
        lagIssues.add(OpsCacheSchema.LAG_ISSUES_ENTRIES, entriesArr);
        cache.add(OpsCacheSchema.LAG_ISSUES, lagIssues);

        if (!incidentEvents.isEmpty()) {
            JsonArray mergedEvents = mergeActivityEvents(cache, incidentEvents, false);
            JsonObject activity = cache.has(OpsCacheSchema.ACTIVITY)
                    ? cache.getAsJsonObject(OpsCacheSchema.ACTIVITY).deepCopy()
                    : new JsonObject();
            activity.addProperty(OpsCacheSchema.ACTIVITY_SCANNED_AT, now.format(ISO));
            activity.add(OpsCacheSchema.ACTIVITY_EVENTS, mergedEvents);
            cache.add(OpsCacheSchema.ACTIVITY, activity);
        }
    }

    private static String lagIssueKey(JsonObject entry) {
        if (entry.has("incident_id")) {
            return entry.get("incident_id").getAsString();
        }
        if (entry.has("id")) {
            return entry.get("id").getAsString();
        }
        return null;
    }

    private static long entryEpoch(JsonObject entry) {
        if (!entry.has("time")) {
            return 0;
        }
        Instant t = dev.mcstatus.watchtower.core.util.TimeParse.parseTime(entry.get("time").getAsString());
        return t != null ? t.getEpochSecond() : 0;
    }

    private static JsonArray mergeActivityEvents(JsonObject cache, List<JsonObject> incoming, boolean replaceWithReport) {
        Map<String, JsonObject> merged = new LinkedHashMap<>();
        if (!replaceWithReport && cache.has(OpsCacheSchema.ACTIVITY)) {
            JsonObject activity = cache.getAsJsonObject(OpsCacheSchema.ACTIVITY);
            if (activity.has(OpsCacheSchema.ACTIVITY_EVENTS)) {
                for (JsonElement el : activity.getAsJsonArray(OpsCacheSchema.ACTIVITY_EVENTS)) {
                    if (el.isJsonObject()) {
                        JsonObject ev = el.getAsJsonObject();
                        merged.put(activityKey(ev), ev);
                    }
                }
            }
        }
        for (JsonObject ev : incoming) {
            merged.put(activityKey(ev), ev);
        }
        JsonArray arr = new JsonArray();
        merged.values().stream()
                .sorted((a, b) -> {
                    long tb = eventEpoch(b);
                    long ta = eventEpoch(a);
                    return Long.compare(tb, ta);
                })
                .limit(OpsLogTailScanner.MAX_LEDGER_EVENTS)
                .forEach(arr::add);
        return arr;
    }

    private static String activityKey(JsonObject ev) {
        String time = ev.has(OpsCacheSchema.EVENT_TIME) ? ev.get(OpsCacheSchema.EVENT_TIME).getAsString() : "";
        String type = ev.has(OpsCacheSchema.EVENT_TYPE) ? ev.get(OpsCacheSchema.EVENT_TYPE).getAsString() : "";
        String detail = ev.has(OpsCacheSchema.EVENT_DETAIL) ? ev.get(OpsCacheSchema.EVENT_DETAIL).getAsString() : "";
        return time + "|" + type + "|" + detail;
    }

    private static long eventEpoch(JsonObject ev) {
        if (!ev.has(OpsCacheSchema.EVENT_TIME)) {
            return 0;
        }
        Instant t = dev.mcstatus.watchtower.core.util.TimeParse.parseTime(ev.get(OpsCacheSchema.EVENT_TIME).getAsString());
        return t != null ? t.getEpochSecond() : 0;
    }

    private static JsonObject buildCrashesBlock(CrashMtimeScanner.ScanResult scan, String source) {
        JsonObject crashes = new JsonObject();
        ZonedDateTime scanned = scan.scannedAt().atZone(ZoneId.systemDefault());
        crashes.addProperty(OpsCacheSchema.CRASHES_SCANNED_AT, scanned.format(ISO));
        crashes.addProperty(OpsCacheSchema.CRASHES_COUNT, scan.entries().size());
        crashes.addProperty(OpsCacheSchema.CRASHES_UNREVIEWED, scan.unreviewed());

        JsonArray entries = new JsonArray();
        for (CrashMtimeScanner.CrashEntry entry : scan.entries()) {
            entries.add(entryToJson(entry, source));
        }
        crashes.add(OpsCacheSchema.CRASHES_ENTRIES, entries);
        if (!scan.entries().isEmpty()) {
            crashes.add(OpsCacheSchema.CRASHES_LATEST, entryToJson(scan.entries().get(0), source));
        }
        return crashes;
    }

    private static JsonObject entryToJson(CrashMtimeScanner.CrashEntry entry, String source) {
        JsonObject row = new JsonObject();
        row.addProperty(OpsCacheSchema.ENTRY_FILE, entry.file());
        row.addProperty(OpsCacheSchema.ENTRY_MTIME, entry.mtime());
        row.addProperty(OpsCacheSchema.ENTRY_SIZE, entry.size());
        row.addProperty(OpsCacheSchema.ENTRY_SOURCE, source);
        if (entry.displayLabel() != null && !entry.displayLabel().isBlank()) {
            row.addProperty(OpsCacheSchema.ENTRY_DISPLAY_LABEL, entry.displayLabel());
        }
        return row;
    }

    private static JsonObject buildScorecardBlock(Path rollupsPath) {
        JsonObject scorecard = new JsonObject();
        JsonObject s24 = PerformanceRollupWriter.summarizeFromFile(rollupsPath, 24);
        JsonObject s7d = PerformanceRollupWriter.summarizeFromFile(rollupsPath, 24 * 7);
        if (s24.has("low_tps_minutes")) {
            scorecard.addProperty("low_tps_minutes_24h", s24.get("low_tps_minutes").getAsInt());
        }
        if (s7d.has("low_tps_minutes")) {
            scorecard.addProperty("low_tps_minutes_7d", s7d.get("low_tps_minutes").getAsInt());
        }
        if (s24.has("mspt_p95")) {
            scorecard.addProperty("mspt_p95_24h", s24.get("mspt_p95").getAsDouble());
        }
        if (s24.has("mspt_jitter_max_24h")) {
            scorecard.addProperty("mspt_jitter_max_24h", s24.get("mspt_jitter_max_24h").getAsDouble());
        }
        return scorecard;
    }

    private static void copyIfPresent(JsonObject from, JsonObject to, String key) {
        if (from.has(key) && !from.get(key).isJsonNull()) {
            to.add(key, from.get(key));
        }
    }

    private static String bareFile(String file) {
        if (file.startsWith("crash-reports/")) {
            return file.substring("crash-reports/".length());
        }
        return file;
    }

    public static void writeAtomic(Path opsCachePath, JsonObject cache) throws IOException {
        if (opsCachePath == null) {
            return;
        }
        Files.createDirectories(opsCachePath.getParent());
        Path tmp = opsCachePath.resolveSibling(opsCachePath.getFileName() + ".tmp");
        Files.writeString(tmp, GSON.toJson(cache) + System.lineSeparator(), StandardCharsets.UTF_8);
        Files.move(tmp, opsCachePath, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
    }
}
