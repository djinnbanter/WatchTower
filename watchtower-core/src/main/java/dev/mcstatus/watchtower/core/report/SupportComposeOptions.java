package dev.mcstatus.watchtower.core.report;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Objects;

/**
 * Options for Support compose / Bundle Builder. Immutable; use factories or {@link #toBuilder()}.
 */
public final class SupportComposeOptions {

    public static final long SOFT_BUDGET_BYTES = 25L * 1024 * 1024;
    public static final long HARD_BUDGET_BYTES = 100L * 1024 * 1024;
    public static final long DEFAULT_MAX_SPARK_BYTES = 8L * 1024 * 1024;
    public static final long DEFAULT_MAX_CRASH_BYTES = 2L * 1024 * 1024;
    public static final long DEFAULT_MAX_LOG_BYTES_TOTAL = 50L * 1024 * 1024;

    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();

    public enum Preset {
        QUICK,
        SERVER_TRIAGE,
        WATCHTOWER_BUG,
        FULL_EVIDENCE,
        CUSTOM;

        public static Preset parse(String raw) {
            if (raw == null || raw.isBlank()) {
                return QUICK;
            }
            try {
                return Preset.valueOf(raw.trim().toUpperCase(Locale.ROOT));
            } catch (IllegalArgumentException e) {
                return CUSTOM;
            }
        }
    }

    public enum LogMode {
        OFF,
        TAIL,
        FULL;

        public static LogMode parse(String raw) {
            if (raw == null || raw.isBlank()) {
                return OFF;
            }
            try {
                return LogMode.valueOf(raw.trim().toUpperCase(Locale.ROOT));
            } catch (IllegalArgumentException e) {
                return OFF;
            }
        }
    }

    public record LogSelection(String file, LogMode mode, int tailLines) {
        public LogSelection {
            file = file == null ? "" : file.trim();
            mode = mode == null ? LogMode.OFF : mode;
            tailLines = Math.max(0, tailLines);
        }
    }

    private final Preset preset;
    private final String category;
    private final String note;
    private final int logTailLines;
    private final long maxLogBytesTotal;
    private final int maxCrashFiles;
    private final long maxCrashBytesEach;
    private final long maxSparkBytes;
    private final long maxZipEvidenceBytes;
    private final boolean includeLatestLogTail;
    private final boolean includeSpark;
    private final boolean includeCrashes;
    private final boolean includeBootExcerpt;
    private final boolean includeConf;
    private final boolean includeServerToml;
    private final boolean includeState;
    private final boolean includeModsList;
    private final boolean includeJvmFlags;
    private final boolean includeServerProperties;
    private final boolean includeSnapshot;
    private final boolean includeRollups;
    private final boolean includeLiveHistory;
    private final int liveHistoryMinutes;
    private final int rollupsHours;
    private final List<LogSelection> logs;
    private final List<String> crashFiles;
    private final List<String> sparkPaths;
    private final int crashLastN;

    private SupportComposeOptions(Builder b) {
        this.preset = b.preset != null ? b.preset : Preset.QUICK;
        this.category = b.category != null ? b.category : "";
        this.note = b.note != null ? b.note : "";
        this.logTailLines = b.logTailLines > 0 ? b.logTailLines : 500;
        this.maxLogBytesTotal = b.maxLogBytesTotal > 0 ? b.maxLogBytesTotal : DEFAULT_MAX_LOG_BYTES_TOTAL;
        this.maxCrashFiles = Math.max(0, b.maxCrashFiles);
        this.maxCrashBytesEach = b.maxCrashBytesEach > 0 ? b.maxCrashBytesEach : DEFAULT_MAX_CRASH_BYTES;
        this.maxSparkBytes = b.maxSparkBytes > 0 ? b.maxSparkBytes : DEFAULT_MAX_SPARK_BYTES;
        this.maxZipEvidenceBytes = b.maxZipEvidenceBytes > 0 ? b.maxZipEvidenceBytes : HARD_BUDGET_BYTES;
        this.includeLatestLogTail = b.includeLatestLogTail;
        this.includeSpark = b.includeSpark;
        this.includeCrashes = b.includeCrashes;
        this.includeBootExcerpt = b.includeBootExcerpt;
        this.includeConf = b.includeConf;
        this.includeServerToml = b.includeServerToml;
        this.includeState = b.includeState;
        this.includeModsList = b.includeModsList;
        this.includeJvmFlags = b.includeJvmFlags;
        this.includeServerProperties = b.includeServerProperties;
        this.includeSnapshot = b.includeSnapshot;
        this.includeRollups = b.includeRollups;
        this.includeLiveHistory = b.includeLiveHistory;
        this.liveHistoryMinutes = Math.max(0, b.liveHistoryMinutes);
        this.rollupsHours = Math.max(0, b.rollupsHours);
        this.logs = List.copyOf(b.logs);
        this.crashFiles = List.copyOf(b.crashFiles);
        this.sparkPaths = List.copyOf(b.sparkPaths);
        this.crashLastN = Math.max(0, b.crashLastN);
    }

    /** Phase-0 / CLI / schedule: match pre-builder behavior (500-line latest tail + one Spark). */
    public static SupportComposeOptions quickDefaults() {
        return new Builder()
                .preset(Preset.QUICK)
                .logTailLines(500)
                .includeLatestLogTail(true)
                .includeSpark(true)
                .includeCrashes(false)
                .includeRollups(true)
                .logs(List.of(new LogSelection("latest.log", LogMode.TAIL, 500)))
                .build();
    }

    public static SupportComposeOptions forPreset(Preset preset) {
        return switch (preset == null ? Preset.QUICK : preset) {
            case QUICK -> new Builder()
                    .preset(Preset.QUICK)
                    .logTailLines(2000)
                    .includeLatestLogTail(true)
                    .includeSpark(false)
                    .includeCrashes(false)
                    .includeConf(true)
                    .includeServerToml(true)
                    .includeModsList(true)
                    .includeRollups(true)
                    .logs(List.of(new LogSelection("latest.log", LogMode.TAIL, 2000)))
                    .build();
            case SERVER_TRIAGE -> new Builder()
                    .preset(Preset.SERVER_TRIAGE)
                    .logTailLines(5000)
                    .includeLatestLogTail(true)
                    .includeSpark(true)
                    .includeCrashes(true)
                    .crashLastN(3)
                    .includeBootExcerpt(true)
                    .includeConf(true)
                    .includeServerToml(true)
                    .includeModsList(true)
                    .includeSnapshot(true)
                    .includeRollups(true)
                    .rollupsHours(24 * 7)
                    .logs(List.of(
                            new LogSelection("latest.log", LogMode.TAIL, 5000),
                            new LogSelection("stderr.log", LogMode.TAIL, 2000),
                            new LogSelection("stderr_stream.log", LogMode.TAIL, 2000)))
                    .build();
            case WATCHTOWER_BUG -> new Builder()
                    .preset(Preset.WATCHTOWER_BUG)
                    .logTailLines(2000)
                    .includeLatestLogTail(true)
                    .includeSpark(false)
                    .includeCrashes(true)
                    .crashLastN(1)
                    .includeConf(true)
                    .includeServerToml(true)
                    .includeState(true)
                    .includeModsList(true)
                    .includeJvmFlags(true)
                    .includeRollups(true)
                    .logs(List.of(new LogSelection("latest.log", LogMode.TAIL, 2000)))
                    .build();
            case FULL_EVIDENCE -> new Builder()
                    .preset(Preset.FULL_EVIDENCE)
                    .logTailLines(5000)
                    .includeLatestLogTail(true)
                    .includeSpark(true)
                    .includeCrashes(true)
                    .crashLastN(5)
                    .includeBootExcerpt(true)
                    .includeConf(true)
                    .includeServerToml(true)
                    .includeState(true)
                    .includeModsList(true)
                    .includeJvmFlags(true)
                    .includeServerProperties(true)
                    .includeSnapshot(true)
                    .includeRollups(true)
                    .includeLiveHistory(true)
                    .liveHistoryMinutes(60)
                    .rollupsHours(24 * 7)
                    .logs(List.of(new LogSelection("latest.log", LogMode.TAIL, 5000)))
                    .build();
            case CUSTOM -> new Builder().preset(Preset.CUSTOM).includeRollups(true).build();
        };
    }

    public static SupportComposeOptions fromJson(JsonObject json) {
        if (json == null) {
            return quickDefaults();
        }
        Preset preset = Preset.parse(str(json, "preset"));
        Builder b = forPreset(preset).toBuilder();
        if (json.has("category")) {
            b.category(str(json, "category"));
        }
        if (json.has("note")) {
            b.note(str(json, "note"));
        }
        if (json.has("log_tail_lines")) {
            b.logTailLines(json.get("log_tail_lines").getAsInt());
        }
        if (json.has("max_log_bytes_total")) {
            b.maxLogBytesTotal(json.get("max_log_bytes_total").getAsLong());
        }
        if (json.has("max_crash_files")) {
            b.maxCrashFiles(json.get("max_crash_files").getAsInt());
        }
        if (json.has("max_crash_bytes_each")) {
            b.maxCrashBytesEach(json.get("max_crash_bytes_each").getAsLong());
        }
        if (json.has("max_spark_bytes")) {
            b.maxSparkBytes(json.get("max_spark_bytes").getAsLong());
        }
        if (json.has("max_zip_evidence_bytes")) {
            b.maxZipEvidenceBytes(json.get("max_zip_evidence_bytes").getAsLong());
        }
        applyBool(json, "include_latest_log_tail", b::includeLatestLogTail);
        applyBool(json, "include_spark", b::includeSpark);
        applyBool(json, "include_crashes", b::includeCrashes);
        applyBool(json, "include_boot_excerpt", b::includeBootExcerpt);
        applyBool(json, "include_conf", b::includeConf);
        applyBool(json, "include_server_toml", b::includeServerToml);
        applyBool(json, "include_state", b::includeState);
        applyBool(json, "include_mods_list", b::includeModsList);
        applyBool(json, "include_jvm_flags", b::includeJvmFlags);
        applyBool(json, "include_server_properties", b::includeServerProperties);
        applyBool(json, "include_snapshot", b::includeSnapshot);
        applyBool(json, "include_rollups", b::includeRollups);
        applyBool(json, "include_live_history", b::includeLiveHistory);
        if (json.has("live_history_minutes")) {
            b.liveHistoryMinutes(json.get("live_history_minutes").getAsInt());
        }
        if (json.has("rollups_hours")) {
            b.rollupsHours(json.get("rollups_hours").getAsInt());
        }
        if (json.has("crash_last_n")) {
            b.crashLastN(json.get("crash_last_n").getAsInt());
        }
        if (json.has("logs") && json.get("logs").isJsonArray()) {
            List<LogSelection> sels = new ArrayList<>();
            for (JsonElement el : json.getAsJsonArray("logs")) {
                if (!el.isJsonObject()) {
                    continue;
                }
                JsonObject row = el.getAsJsonObject();
                sels.add(new LogSelection(
                        str(row, "file"),
                        LogMode.parse(str(row, "mode")),
                        row.has("tail_lines") ? row.get("tail_lines").getAsInt() : 2000));
            }
            b.logs(sels);
            if (!sels.isEmpty()) {
                b.preset(Preset.CUSTOM.equals(preset) ? Preset.CUSTOM : preset);
            }
        }
        if (json.has("crash_files") && json.get("crash_files").isJsonArray()) {
            List<String> files = new ArrayList<>();
            for (JsonElement el : json.getAsJsonArray("crash_files")) {
                if (el.isJsonPrimitive()) {
                    files.add(el.getAsString());
                }
            }
            b.crashFiles(files);
        }
        if (json.has("spark_paths") && json.get("spark_paths").isJsonArray()) {
            List<String> paths = new ArrayList<>();
            for (JsonElement el : json.getAsJsonArray("spark_paths")) {
                if (el.isJsonPrimitive()) {
                    paths.add(el.getAsString());
                }
            }
            b.sparkPaths(paths);
        }
        return b.build();
    }

    public JsonObject toJson() {
        JsonObject o = new JsonObject();
        o.addProperty("preset", preset.name());
        o.addProperty("category", category);
        o.addProperty("note", note);
        o.addProperty("log_tail_lines", logTailLines);
        o.addProperty("max_log_bytes_total", maxLogBytesTotal);
        o.addProperty("max_crash_files", maxCrashFiles);
        o.addProperty("max_crash_bytes_each", maxCrashBytesEach);
        o.addProperty("max_spark_bytes", maxSparkBytes);
        o.addProperty("max_zip_evidence_bytes", maxZipEvidenceBytes);
        o.addProperty("include_latest_log_tail", includeLatestLogTail);
        o.addProperty("include_spark", includeSpark);
        o.addProperty("include_crashes", includeCrashes);
        o.addProperty("include_boot_excerpt", includeBootExcerpt);
        o.addProperty("include_conf", includeConf);
        o.addProperty("include_server_toml", includeServerToml);
        o.addProperty("include_state", includeState);
        o.addProperty("include_mods_list", includeModsList);
        o.addProperty("include_jvm_flags", includeJvmFlags);
        o.addProperty("include_server_properties", includeServerProperties);
        o.addProperty("include_snapshot", includeSnapshot);
        o.addProperty("include_rollups", includeRollups);
        o.addProperty("include_live_history", includeLiveHistory);
        o.addProperty("live_history_minutes", liveHistoryMinutes);
        o.addProperty("rollups_hours", rollupsHours);
        o.addProperty("crash_last_n", crashLastN);
        JsonArray logsArr = new JsonArray();
        for (LogSelection sel : logs) {
            JsonObject row = new JsonObject();
            row.addProperty("file", sel.file());
            row.addProperty("mode", sel.mode().name());
            row.addProperty("tail_lines", sel.tailLines());
            logsArr.add(row);
        }
        o.add("logs", logsArr);
        JsonArray crashesArr = new JsonArray();
        crashFiles.forEach(crashesArr::add);
        o.add("crash_files", crashesArr);
        JsonArray sparkArr = new JsonArray();
        sparkPaths.forEach(sparkArr::add);
        o.add("spark_paths", sparkArr);
        return o;
    }

    public String toPrettyJson() {
        return GSON.toJson(toJson());
    }

    public Builder toBuilder() {
        return new Builder()
                .preset(preset)
                .category(category)
                .note(note)
                .logTailLines(logTailLines)
                .maxLogBytesTotal(maxLogBytesTotal)
                .maxCrashFiles(maxCrashFiles)
                .maxCrashBytesEach(maxCrashBytesEach)
                .maxSparkBytes(maxSparkBytes)
                .maxZipEvidenceBytes(maxZipEvidenceBytes)
                .includeLatestLogTail(includeLatestLogTail)
                .includeSpark(includeSpark)
                .includeCrashes(includeCrashes)
                .includeBootExcerpt(includeBootExcerpt)
                .includeConf(includeConf)
                .includeServerToml(includeServerToml)
                .includeState(includeState)
                .includeModsList(includeModsList)
                .includeJvmFlags(includeJvmFlags)
                .includeServerProperties(includeServerProperties)
                .includeSnapshot(includeSnapshot)
                .includeRollups(includeRollups)
                .includeLiveHistory(includeLiveHistory)
                .liveHistoryMinutes(liveHistoryMinutes)
                .rollupsHours(rollupsHours)
                .logs(logs)
                .crashFiles(crashFiles)
                .sparkPaths(sparkPaths)
                .crashLastN(crashLastN);
    }

    public Preset preset() { return preset; }
    public String category() { return category; }
    public String note() { return note; }
    public int logTailLines() { return logTailLines; }
    public long maxLogBytesTotal() { return maxLogBytesTotal; }
    public int maxCrashFiles() { return maxCrashFiles; }
    public long maxCrashBytesEach() { return maxCrashBytesEach; }
    public long maxSparkBytes() { return maxSparkBytes; }
    public long maxZipEvidenceBytes() { return maxZipEvidenceBytes; }
    public boolean includeLatestLogTail() { return includeLatestLogTail; }
    public boolean includeSpark() { return includeSpark; }
    public boolean includeCrashes() { return includeCrashes; }
    public boolean includeBootExcerpt() { return includeBootExcerpt; }
    public boolean includeConf() { return includeConf; }
    public boolean includeServerToml() { return includeServerToml; }
    public boolean includeState() { return includeState; }
    public boolean includeModsList() { return includeModsList; }
    public boolean includeJvmFlags() { return includeJvmFlags; }
    public boolean includeServerProperties() { return includeServerProperties; }
    public boolean includeSnapshot() { return includeSnapshot; }
    public boolean includeRollups() { return includeRollups; }
    public boolean includeLiveHistory() { return includeLiveHistory; }
    public int liveHistoryMinutes() { return liveHistoryMinutes; }
    public int rollupsHours() { return rollupsHours; }
    public List<LogSelection> logs() { return logs; }
    public List<String> crashFiles() { return crashFiles; }
    public List<String> sparkPaths() { return sparkPaths; }
    public int crashLastN() { return crashLastN; }

    private static String str(JsonObject o, String key) {
        return o.has(key) && o.get(key).isJsonPrimitive() ? o.get(key).getAsString() : "";
    }

    private static void applyBool(JsonObject json, String key, java.util.function.Consumer<Boolean> setter) {
        if (json.has(key) && json.get(key).isJsonPrimitive()) {
            setter.accept(json.get(key).getAsBoolean());
        }
    }

    public static final class Builder {
        private Preset preset = Preset.QUICK;
        private String category = "";
        private String note = "";
        private int logTailLines = 500;
        private long maxLogBytesTotal = DEFAULT_MAX_LOG_BYTES_TOTAL;
        private int maxCrashFiles = 5;
        private long maxCrashBytesEach = DEFAULT_MAX_CRASH_BYTES;
        private long maxSparkBytes = DEFAULT_MAX_SPARK_BYTES;
        private long maxZipEvidenceBytes = HARD_BUDGET_BYTES;
        private boolean includeLatestLogTail = true;
        private boolean includeSpark = true;
        private boolean includeCrashes;
        private boolean includeBootExcerpt;
        private boolean includeConf = true;
        private boolean includeServerToml = true;
        private boolean includeState;
        private boolean includeModsList;
        private boolean includeJvmFlags;
        private boolean includeServerProperties;
        private boolean includeSnapshot;
        private boolean includeRollups = true;
        private boolean includeLiveHistory;
        private int liveHistoryMinutes = 60;
        private int rollupsHours;
        private List<LogSelection> logs = new ArrayList<>();
        private List<String> crashFiles = new ArrayList<>();
        private List<String> sparkPaths = new ArrayList<>();
        private int crashLastN;

        public Builder preset(Preset v) { this.preset = v; return this; }
        public Builder category(String v) { this.category = v; return this; }
        public Builder note(String v) { this.note = v; return this; }
        public Builder logTailLines(int v) { this.logTailLines = v; return this; }
        public Builder maxLogBytesTotal(long v) { this.maxLogBytesTotal = v; return this; }
        public Builder maxCrashFiles(int v) { this.maxCrashFiles = v; return this; }
        public Builder maxCrashBytesEach(long v) { this.maxCrashBytesEach = v; return this; }
        public Builder maxSparkBytes(long v) { this.maxSparkBytes = v; return this; }
        public Builder maxZipEvidenceBytes(long v) { this.maxZipEvidenceBytes = v; return this; }
        public Builder includeLatestLogTail(boolean v) { this.includeLatestLogTail = v; return this; }
        public Builder includeSpark(boolean v) { this.includeSpark = v; return this; }
        public Builder includeCrashes(boolean v) { this.includeCrashes = v; return this; }
        public Builder includeBootExcerpt(boolean v) { this.includeBootExcerpt = v; return this; }
        public Builder includeConf(boolean v) { this.includeConf = v; return this; }
        public Builder includeServerToml(boolean v) { this.includeServerToml = v; return this; }
        public Builder includeState(boolean v) { this.includeState = v; return this; }
        public Builder includeModsList(boolean v) { this.includeModsList = v; return this; }
        public Builder includeJvmFlags(boolean v) { this.includeJvmFlags = v; return this; }
        public Builder includeServerProperties(boolean v) { this.includeServerProperties = v; return this; }
        public Builder includeSnapshot(boolean v) { this.includeSnapshot = v; return this; }
        public Builder includeRollups(boolean v) { this.includeRollups = v; return this; }
        public Builder includeLiveHistory(boolean v) { this.includeLiveHistory = v; return this; }
        public Builder liveHistoryMinutes(int v) { this.liveHistoryMinutes = v; return this; }
        public Builder rollupsHours(int v) { this.rollupsHours = v; return this; }
        public Builder logs(List<LogSelection> v) {
            this.logs = v != null ? new ArrayList<>(v) : new ArrayList<>();
            return this;
        }
        public Builder crashFiles(List<String> v) {
            this.crashFiles = v != null ? new ArrayList<>(v) : new ArrayList<>();
            return this;
        }
        public Builder sparkPaths(List<String> v) {
            this.sparkPaths = v != null ? new ArrayList<>(v) : new ArrayList<>();
            return this;
        }
        public Builder crashLastN(int v) { this.crashLastN = v; return this; }

        public SupportComposeOptions build() {
            return new SupportComposeOptions(this);
        }
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof SupportComposeOptions that)) {
            return false;
        }
        return Objects.equals(toJson(), that.toJson());
    }

    @Override
    public int hashCode() {
        return Objects.hash(toJson());
    }
}
