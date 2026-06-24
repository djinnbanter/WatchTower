package dev.mcstatus.watchtower.core.report;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import dev.mcstatus.watchtower.core.collect.ModChangeDetector;
import dev.mcstatus.watchtower.core.util.TimeParse;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.Map;

/**
 * Persists incremental report state (ported from mc-status-report.sh post-run Python block).
 */
public final class StateManager {

    private static final int MAX_SAMPLES = 288;
    private static final DateTimeFormatter ISO = DateTimeFormatter.ISO_OFFSET_DATE_TIME;

    private StateManager() {
    }

    public static void updateAfterReport(Path statePath, String windowStart, JsonObject facts, int lookbackHours)
            throws IOException {
        ZonedDateTime now = ZonedDateTime.now(ZoneId.systemDefault());
        double cutoff = now.toEpochSecond() - (long) lookbackHours * 3600L;

        JsonObject state = loadState(statePath);
        JsonObject preservedAcks = state.has("acknowledged_crashes")
                ? state.getAsJsonObject("acknowledged_crashes").deepCopy()
                : null;
        JsonObject preservedClientIgnores = state.has("ignored_client_mods")
                ? state.getAsJsonObject("ignored_client_mods").deepCopy()
                : null;
        JsonObject preservedCrashIndex = state.has("crash_mtime_index")
                ? state.getAsJsonObject("crash_mtime_index").deepCopy()
                : null;
        int preservedOpsSeq = state.has("ops_cache_seq") ? state.get("ops_cache_seq").getAsInt() : 0;
        JsonArray preservedModsSnapshot = state.has("last_mods_snapshot")
                ? state.getAsJsonArray("last_mods_snapshot").deepCopy() : null;
        JsonObject preservedDiskBaseline = state.has("disk_baseline")
                ? state.getAsJsonObject("disk_baseline").deepCopy() : null;
        JsonObject system = facts.getAsJsonObject("system");
        JsonObject minecraft = facts.has("minecraft") ? facts.getAsJsonObject("minecraft") : new JsonObject();
        JsonObject optional = facts.has("optional") ? facts.getAsJsonObject("optional") : new JsonObject();

        Double hostPct = jsonDouble(system, "host_cpu_pct_now");
        Double javaPct = jsonDouble(system, "java_cpu_pct_avg");

        JsonArray samples = state.has("cpu_samples") ? state.getAsJsonArray("cpu_samples") : new JsonArray();
        if (hostPct != null) {
            JsonObject entry = new JsonObject();
            entry.addProperty("time", now.format(ISO));
            entry.addProperty("host_pct", hostPct);
            if (javaPct != null) {
                entry.addProperty("java_pct", javaPct);
            }
            samples.add(entry);
        }
        state.add("cpu_samples", pruneSamples(samples, cutoff));

        JsonArray tpsSamples = state.has("tps_samples") ? state.getAsJsonArray("tps_samples") : new JsonArray();
        JsonObject tpsData = minecraft.has("tps") ? minecraft.getAsJsonObject("tps") : null;
        if (tpsData != null && tpsData.has("overworld")) {
            JsonObject ow = tpsData.getAsJsonObject("overworld");
            if (ow.has("mspt")) {
                JsonObject entry = new JsonObject();
                entry.addProperty("time", now.format(ISO));
                entry.addProperty("mspt", ow.get("mspt").getAsDouble());
                entry.addProperty("source", tpsData.has("source") ? tpsData.get("source").getAsString() : "unknown");
                tpsSamples.add(entry);
            }
        }
        state.add("tps_samples", pruneSamples(tpsSamples, cutoff));

        JsonArray worldHistory = state.has("world_size_history")
                ? state.getAsJsonArray("world_size_history")
                : new JsonArray();
        JsonObject storage = optional.has("storage") ? optional.getAsJsonObject("storage") : null;
        Long wb = storage != null && storage.has("world_bytes") ? storage.get("world_bytes").getAsLong() : null;
        if (wb != null) {
            JsonObject wh = new JsonObject();
            wh.addProperty("ts", now.toEpochSecond());
            wh.addProperty("world_bytes", wb);
            worldHistory.add(wh);
        }
        state.add("world_size_history", pruneWorldHistory(worldHistory, cutoff));
        if (wb != null) {
            state.addProperty("world_size_bytes", wb);
        }

        if (optional.has("bandwidth")) {
            state.add("bandwidth_sample", optional.getAsJsonObject("bandwidth").deepCopy());
        }
        if (minecraft.has("mod_count")) {
            state.addProperty("mod_count", minecraft.get("mod_count").getAsInt());
        }
        JsonObject nativeBlob = optional.has("watchtower_native")
                ? optional.getAsJsonObject("watchtower_native") : null;
        if (nativeBlob != null && nativeBlob.has("mods")) {
            state.add("mod_ids", ModChangeDetector.modIdsArray(nativeBlob));
            state.addProperty("mod_ids_full", true);
        }

        state.addProperty("last_run", now.format(ISO));
        state.addProperty("window_start", windowStart);
        if (preservedAcks != null) {
            state.add("acknowledged_crashes", preservedAcks);
        }
        if (preservedClientIgnores != null) {
            state.add("ignored_client_mods", preservedClientIgnores);
        }
        if (preservedCrashIndex != null) {
            state.add("crash_mtime_index", preservedCrashIndex);
        }
        if (preservedOpsSeq > 0) {
            state.addProperty("ops_cache_seq", preservedOpsSeq);
        }
        if (optional.has("mods_inventory_snapshot")) {
            state.add("last_mods_snapshot", optional.getAsJsonArray("mods_inventory_snapshot").deepCopy());
        } else if (preservedModsSnapshot != null) {
            state.add("last_mods_snapshot", preservedModsSnapshot);
        }
        if (optional.has("disk_baseline")) {
            state.add("disk_baseline", optional.getAsJsonObject("disk_baseline").deepCopy());
        } else if (preservedDiskBaseline != null) {
            state.add("disk_baseline", preservedDiskBaseline);
        } else if (system != null && system.has("disk_use_pct")) {
            state.add("disk_baseline", dev.mcstatus.watchtower.core.analyze.DiskJumpEvaluator.baselineFromSystem(system));
        }

        Files.createDirectories(statePath.getParent());
        Files.writeString(statePath, state.toString() + System.lineSeparator(), StandardCharsets.UTF_8);
    }

    public static void acknowledgeCrash(Path statePath, String crashFile, Instant when) throws IOException {
        acknowledgeCrash(statePath, crashFile, when, null, null, null);
    }

    public static void acknowledgeCrash(
            Path statePath,
            String crashFile,
            Instant when,
            String by,
            String category,
            String plainEnglish) throws IOException {
        if (crashFile == null || crashFile.isBlank()) {
            return;
        }
        JsonObject state = loadState(statePath);
        JsonObject acks = state.has("acknowledged_crashes")
                ? state.getAsJsonObject("acknowledged_crashes")
                : new JsonObject();
        JsonObject record = buildAckRecord(when, by, category, plainEnglish);
        storeAckKeys(acks, crashFile, record);
        state.add("acknowledged_crashes", acks);
        writeState(statePath, state);
    }

    public static void unacknowledgeCrash(Path statePath, String crashFile) throws IOException {
        if (crashFile == null || crashFile.isBlank()) {
            return;
        }
        JsonObject state = loadState(statePath);
        if (!state.has("acknowledged_crashes")) {
            return;
        }
        JsonObject acks = state.getAsJsonObject("acknowledged_crashes");
        removeAckKeys(acks, crashFile);
        state.add("acknowledged_crashes", acks);
        writeState(statePath, state);
    }

    public static JsonObject getAcknowledgedCrashes(Path statePath) throws IOException {
        JsonObject state = loadState(statePath);
        if (!state.has("acknowledged_crashes")) {
            return new JsonObject();
        }
        return state.getAsJsonObject("acknowledged_crashes").deepCopy();
    }

    public static void ignoreClientMod(Path statePath, String modId, Instant when) throws IOException {
        ignoreClientMod(statePath, modId, when, null, null);
    }

    public static void ignoreClientMod(
            Path statePath,
            String modId,
            Instant when,
            String by,
            String note) throws IOException {
        if (modId == null || modId.isBlank()) {
            return;
        }
        JsonObject state = loadState(statePath);
        JsonObject ignores = state.has("ignored_client_mods")
                ? state.getAsJsonObject("ignored_client_mods")
                : new JsonObject();
        ignores.add(modId, buildIgnoreRecord(when, by, note));
        state.add("ignored_client_mods", ignores);
        writeState(statePath, state);
    }

    public static void unignoreClientMod(Path statePath, String modId) throws IOException {
        if (modId == null || modId.isBlank()) {
            return;
        }
        JsonObject state = loadState(statePath);
        if (!state.has("ignored_client_mods")) {
            return;
        }
        JsonObject ignores = state.getAsJsonObject("ignored_client_mods");
        ignores.remove(modId);
        state.add("ignored_client_mods", ignores);
        writeState(statePath, state);
    }

    public static JsonObject getIgnoredClientMods(Path statePath) throws IOException {
        JsonObject state = loadState(statePath);
        if (!state.has("ignored_client_mods")) {
            return new JsonObject();
        }
        return state.getAsJsonObject("ignored_client_mods").deepCopy();
    }

    public static Map<String, Long> getCrashMtimeIndex(Path statePath) throws IOException {
        JsonObject state = loadState(statePath);
        Map<String, Long> index = new HashMap<>();
        if (!state.has("crash_mtime_index")) {
            return index;
        }
        JsonObject obj = state.getAsJsonObject("crash_mtime_index");
        for (String key : obj.keySet()) {
            index.put(key, obj.get(key).getAsLong());
        }
        return index;
    }

    public static void updateCrashMtimeIndex(Path statePath, Map<String, Long> index) throws IOException {
        JsonObject state = loadState(statePath);
        JsonObject obj = new JsonObject();
        for (Map.Entry<String, Long> e : index.entrySet()) {
            obj.addProperty(e.getKey(), e.getValue());
        }
        state.add("crash_mtime_index", obj);
        writeState(statePath, state);
    }

    public static int incrementOpsCacheSeq(Path statePath) throws IOException {
        JsonObject state = loadState(statePath);
        int seq = state.has("ops_cache_seq") ? state.get("ops_cache_seq").getAsInt() : 0;
        seq++;
        state.addProperty("ops_cache_seq", seq);
        writeState(statePath, state);
        return seq;
    }

    public static long getLastLagIncidentAt(Path statePath) throws IOException {
        JsonObject state = loadState(statePath);
        return state.has("last_lag_incident_at") ? state.get("last_lag_incident_at").getAsLong() : 0L;
    }

    public static void setLastLagIncidentAt(Path statePath, long epochSec) throws IOException {
        JsonObject state = loadState(statePath);
        state.addProperty("last_lag_incident_at", epochSec);
        writeState(statePath, state);
    }

    public static int getLagBreachStreak(Path statePath) throws IOException {
        JsonObject state = loadState(statePath);
        return state.has("lag_breach_streak") ? state.get("lag_breach_streak").getAsInt() : 0;
    }

    public static void setLagBreachStreak(Path statePath, int streak) throws IOException {
        JsonObject state = loadState(statePath);
        state.addProperty("lag_breach_streak", streak);
        writeState(statePath, state);
    }

    public static int getLagHealthyStreak(Path statePath) throws IOException {
        JsonObject state = loadState(statePath);
        return state.has("lag_healthy_streak") ? state.get("lag_healthy_streak").getAsInt() : 0;
    }

    public static void setLagHealthyStreak(Path statePath, int streak) throws IOException {
        JsonObject state = loadState(statePath);
        state.addProperty("lag_healthy_streak", streak);
        writeState(statePath, state);
    }

    public static JsonObject getActivityLogOffset(Path statePath) throws IOException {
        return getOpsLogOffset(statePath);
    }

    public static void updateActivityLogOffset(Path statePath, JsonObject offset) throws IOException {
        updateOpsLogOffset(statePath, offset);
    }

    public static JsonObject getOpsLogOffset(Path statePath) throws IOException {
        JsonObject state = loadState(statePath);
        if (state.has("ops_log_offset")) {
            return state.getAsJsonObject("ops_log_offset").deepCopy();
        }
        if (state.has("activity_log_offset")) {
            return state.getAsJsonObject("activity_log_offset").deepCopy();
        }
        return new JsonObject();
    }

    public static void updateOpsLogOffset(Path statePath, JsonObject offset) throws IOException {
        JsonObject state = loadState(statePath);
        JsonObject copy = offset.deepCopy();
        state.add("ops_log_offset", copy);
        state.add("activity_log_offset", copy.deepCopy());
        writeState(statePath, state);
    }

    public static long getLastTickLagEventAt(Path statePath) throws IOException {
        JsonObject state = loadState(statePath);
        return state.has("last_tick_lag_event_at") ? state.get("last_tick_lag_event_at").getAsLong() : 0L;
    }

    public static void setLastTickLagEventAt(Path statePath, long epochSec) throws IOException {
        JsonObject state = loadState(statePath);
        state.addProperty("last_tick_lag_event_at", epochSec);
        writeState(statePath, state);
    }

    public static String getLastScheduledSlot(Path statePath) throws IOException {
        JsonObject state = loadState(statePath);
        return state.has("last_scheduled_slot") ? state.get("last_scheduled_slot").getAsString() : null;
    }

    public static String getLastScheduledReportAt(Path statePath) throws IOException {
        JsonObject state = loadState(statePath);
        return state.has("last_scheduled_report_at") ? state.get("last_scheduled_report_at").getAsString() : null;
    }

    public static void updateScheduleState(Path statePath, String slotKey, String reportAtIso) throws IOException {
        JsonObject state = loadState(statePath);
        if (slotKey != null && !slotKey.isBlank()) {
            state.addProperty("last_scheduled_slot", slotKey);
        }
        if (reportAtIso != null && !reportAtIso.isBlank()) {
            state.addProperty("last_scheduled_report_at", reportAtIso);
        }
        writeState(statePath, state);
    }

    public static boolean isCrashAcked(JsonObject acks, String crashFile) {
        if (crashFile == null || crashFile.isBlank()) {
            return false;
        }
        String bare = bareKey(crashFile);
        return acks.has(bare) || acks.has("crash-reports/" + bare) || acks.has(crashFile);
    }

    private static JsonObject buildAckRecord(Instant when, String by, String category, String plainEnglish) {
        JsonObject record = new JsonObject();
        record.addProperty("ackedAt", when.atZone(ZoneId.systemDefault()).format(ISO));
        record.addProperty("by", by != null && !by.isBlank() ? by : "dashboard");
        if (category != null && !category.isBlank()) {
            record.addProperty("category", category);
        }
        if (plainEnglish != null && !plainEnglish.isBlank()) {
            record.addProperty("plain_english", plainEnglish);
        }
        return record;
    }

    private static JsonObject buildIgnoreRecord(Instant when, String by, String note) {
        JsonObject record = new JsonObject();
        record.addProperty("ignoredAt", when.atZone(ZoneId.systemDefault()).format(ISO));
        record.addProperty("by", by != null && !by.isBlank() ? by : "dashboard");
        if (note != null && !note.isBlank()) {
            record.addProperty("note", note);
        }
        return record;
    }

    private static void storeAckKeys(JsonObject acks, String crashFile, JsonObject record) {
        String bare = bareKey(crashFile);
        acks.add(bare, record.deepCopy());
        acks.add("crash-reports/" + bare, record.deepCopy());
    }

    private static void removeAckKeys(JsonObject acks, String crashFile) {
        String bare = bareKey(crashFile);
        acks.remove(bare);
        acks.remove("crash-reports/" + bare);
        acks.remove(crashFile);
    }

    private static String bareKey(String crashFile) {
        if (crashFile.startsWith("crash-reports/")) {
            return crashFile.substring("crash-reports/".length());
        }
        return crashFile;
    }

    private static void writeState(Path statePath, JsonObject state) throws IOException {
        Files.createDirectories(statePath.getParent());
        Files.writeString(statePath, state.toString() + System.lineSeparator(), StandardCharsets.UTF_8);
    }

    public static JsonObject loadStateObject(Path statePath) throws IOException {
        return loadState(statePath);
    }

    private static JsonObject loadState(Path path) throws IOException {
        if (!Files.isRegularFile(path)) {
            return new JsonObject();
        }
        String text = Files.readString(path, StandardCharsets.UTF_8);
        try {
            return JsonParser.parseString(text).getAsJsonObject();
        } catch (Exception e) {
            return new JsonObject();
        }
    }

    private static JsonArray pruneSamples(JsonArray samples, double cutoff) {
        JsonArray out = new JsonArray();
        for (JsonElement el : samples) {
            JsonObject s = el.getAsJsonObject();
            String t = s.has("time") ? s.get("time").getAsString() : "";
            Instant inst = TimeParse.parseTime(t);
            if (inst != null && inst.getEpochSecond() >= cutoff) {
                out.add(s);
            }
        }
        return trimTail(out, MAX_SAMPLES);
    }

    private static JsonArray pruneWorldHistory(JsonArray history, double cutoff) {
        JsonArray out = new JsonArray();
        for (JsonElement el : history) {
            JsonObject e = el.getAsJsonObject();
            double ts = e.has("ts") ? e.get("ts").getAsDouble() : 0;
            if (ts >= cutoff) {
                out.add(e);
            }
        }
        return trimTail(out, MAX_SAMPLES);
    }

    private static JsonArray trimTail(JsonArray arr, int max) {
        if (arr.size() <= max) {
            return arr;
        }
        JsonArray out = new JsonArray();
        for (int i = arr.size() - max; i < arr.size(); i++) {
            out.add(arr.get(i));
        }
        return out;
    }

    private static Double jsonDouble(JsonObject obj, String key) {
        if (obj == null || !obj.has(key) || obj.get(key).isJsonNull()) {
            return null;
        }
        return obj.get(key).getAsDouble();
    }
}
