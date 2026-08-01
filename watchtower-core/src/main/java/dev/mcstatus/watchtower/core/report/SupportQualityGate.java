package dev.mcstatus.watchtower.core.report;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.ops.OpsCacheReader;
import dev.mcstatus.watchtower.core.ops.OpsModsTreeSource;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Preflight checklist for support packs. Never hard-blocks — warnings only in v1.
 */
public final class SupportQualityGate {

    public static final long INCIDENT_WINDOW_GRACE_SECONDS = 2L * 60L * 60L;

    public enum Status {
        PASS,
        WARN,
        SKIP
    }

    public record Check(String id, Status status, String message, boolean required) {
    }

    public record Summary(int pass, int warn, int skip) {
    }

    public record Result(
            Instant evaluatedAt,
            boolean overrideAllowed,
            Summary summary,
            List<Check> checks
    ) {
        public boolean hasWarnings() {
            for (Check c : checks) {
                if (c.status() == Status.WARN) {
                    return true;
                }
            }
            return false;
        }

        public JsonObject toJson() {
            JsonObject out = new JsonObject();
            out.addProperty("override_allowed", overrideAllowed);
            JsonObject sum = new JsonObject();
            sum.addProperty("pass", summary.pass());
            sum.addProperty("warn", summary.warn());
            sum.addProperty("skip", summary.skip());
            out.add("summary", sum);
            JsonArray arr = new JsonArray();
            for (Check c : checks) {
                arr.add(checkJson(c));
            }
            out.add("checks", arr);
            return out;
        }

        public JsonObject toManifestJson(boolean override) {
            JsonObject out = toJson();
            out.addProperty("evaluated_at", evaluatedAt.toString());
            out.addProperty("override", override);
            return out;
        }

        private static JsonObject checkJson(Check c) {
            JsonObject row = new JsonObject();
            row.addProperty("id", c.id());
            row.addProperty("status", c.status().name().toLowerCase(Locale.ROOT));
            row.addProperty("message", c.message());
            row.addProperty("required", c.required());
            return row;
        }
    }

    private SupportQualityGate() {
    }

    public static Result evaluate(
            Path serverDir,
            Path opsCachePath,
            JsonObject catalog,
            SupportComposeOptions options
    ) {
        Instant at = Instant.now();
        SupportComposeOptions opts = options != null ? options : SupportComposeOptions.quickDefaults();
        JsonObject cat = catalog != null ? catalog : new JsonObject();
        JsonObject ops;
        try {
            ops = OpsCacheReader.load(opsCachePath);
        } catch (Exception e) {
            ops = OpsCacheReader.empty();
        }

        List<Check> checks = new ArrayList<>();
        checks.add(checkLogPresent(serverDir, opts));
        checks.add(checkModList(ops));
        checks.add(checkJavaLoader(ops));
        checks.add(new Check(
                "secrets_redacted",
                Status.PASS,
                "Secrets, IPs, and UUIDs are stripped when the zip is built.",
                false));
        checks.add(checkCrashIfRelevant(opts, cat));
        checks.add(checkIncidentWindow(opts, cat));
        checks.add(new Check(
                "hang_dump",
                Status.SKIP,
                "Hang dumps come in a later WatchTower update.",
                false));

        int pass = 0;
        int warn = 0;
        int skip = 0;
        for (Check c : checks) {
            switch (c.status()) {
                case PASS -> pass++;
                case WARN -> warn++;
                case SKIP -> skip++;
            }
        }
        return new Result(at, true, new Summary(pass, warn, skip), List.copyOf(checks));
    }

    /** Fail-open single warn when catalog/evaluate cannot run fully. */
    public static Result failOpen(String message) {
        Check c = new Check(
                "gate_error",
                Status.WARN,
                message != null && !message.isBlank() ? message : "Could not fully check this pack.",
                false);
        return new Result(Instant.now(), true, new Summary(0, 1, 0), List.of(c));
    }

    private static Check checkLogPresent(Path serverDir, SupportComposeOptions opts) {
        List<SupportComposeOptions.LogSelection> sels = opts.logs();
        boolean wantsLogs = (sels != null && !sels.isEmpty()) || opts.includeLatestLogTail();
        if (!wantsLogs) {
            return new Check("log_present", Status.SKIP, "Logs turned off for this pack.", false);
        }
        Path logsDir = serverDir != null ? serverDir.resolve("logs") : null;
        List<String> names = new ArrayList<>();
        if (sels != null) {
            for (SupportComposeOptions.LogSelection sel : sels) {
                if (sel != null && sel.file() != null && !sel.file().isBlank()
                        && sel.mode() != SupportComposeOptions.LogMode.OFF) {
                    names.add(sel.file().trim());
                }
            }
        }
        if (names.isEmpty() && opts.includeLatestLogTail()) {
            names.add("latest.log");
        }
        boolean any = false;
        for (String name : names) {
            Path p = SupportSafePaths.resolveBasename(logsDir, name);
            if (p != null && Files.isRegularFile(p)) {
                any = true;
                break;
            }
        }
        if (any) {
            return new Check("log_present", Status.PASS, "Log file present for this pack.", false);
        }
        return new Check(
                "log_present",
                Status.WARN,
                "No log file on disk for this pack — Discord helpers usually need latest.log.",
                false);
    }

    private static Check checkModList(JsonObject ops) {
        JsonArray mods = OpsModsTreeSource.resolveModsArray(ops);
        if (mods != null && mods.size() > 0) {
            return new Check("mod_list", Status.PASS, "Mod list found in ops snapshot.", false);
        }
        return new Check(
                "mod_list",
                Status.WARN,
                "No mod list in the ops snapshot yet — wait for Scanning, then rebuild.",
                false);
    }

    private static Check checkJavaLoader(JsonObject ops) {
        String javaVer = System.getProperty("java.version", "");
        if (javaVer == null || javaVer.isBlank()) {
            return new Check("java_loader", Status.WARN, "Java version missing on this process.", false);
        }
        String loader = "";
        if (ops != null && ops.has("server") && ops.get("server").isJsonObject()) {
            JsonObject server = ops.getAsJsonObject("server");
            if (server.has("loader") && server.get("loader").isJsonPrimitive()) {
                loader = server.get("loader").getAsString();
            }
        }
        if (loader == null || loader.isBlank() || "unknown".equalsIgnoreCase(loader)) {
            return new Check(
                    "java_loader",
                    Status.WARN,
                    "Loader version missing from ops snapshot.",
                    false);
        }
        return new Check("java_loader", Status.PASS, "Java and loader recorded for this pack.", false);
    }

    private static boolean crashRelevant(SupportComposeOptions opts) {
        SupportComposeOptions.Preset p = opts.preset();
        if (p == SupportComposeOptions.Preset.SERVER_TRIAGE || p == SupportComposeOptions.Preset.FULL_EVIDENCE) {
            return true;
        }
        String cat = opts.category() != null ? opts.category().toLowerCase(Locale.ROOT) : "";
        return cat.contains("crash") || cat.contains("lag") || cat.contains("server");
    }

    private static Check checkCrashIfRelevant(SupportComposeOptions opts, JsonObject catalog) {
        if (!crashRelevant(opts)) {
            return new Check(
                    "crash_if_relevant",
                    Status.SKIP,
                    "Crash reports are optional for this pack type.",
                    false);
        }
        List<String> selected = opts.crashFiles();
        if (selected != null && !selected.isEmpty()) {
            return new Check("crash_if_relevant", Status.PASS, "Crash report selected.", false);
        }
        int catalogCrashes = 0;
        if (catalog.has("crashes") && catalog.get("crashes").isJsonArray()) {
            catalogCrashes = catalog.getAsJsonArray("crashes").size();
        }
        if (catalogCrashes > 0) {
            return new Check(
                    "crash_if_relevant",
                    Status.WARN,
                    "This pack type usually needs a crash report — pick one if the incident crashed.",
                    false);
        }
        return new Check(
                "crash_if_relevant",
                Status.SKIP,
                "No crash reports on disk to attach.",
                false);
    }

    private static Check checkIncidentWindow(SupportComposeOptions opts, JsonObject catalog) {
        List<String> selected = opts.crashFiles();
        if (selected == null || selected.isEmpty()) {
            return new Check(
                    "incident_window",
                    Status.SKIP,
                    "No crash selected — skip log coverage check.",
                    false);
        }
        Long crashMtime = maxCrashMtime(catalog, selected);
        Long logMtime = maxLogMtime(catalog, opts);
        if (crashMtime == null || logMtime == null) {
            return new Check(
                    "incident_window",
                    Status.SKIP,
                    "Could not verify log coverage for this crash.",
                    false);
        }
        long delta = Math.abs(crashMtime - logMtime);
        boolean ok = delta <= INCIDENT_WINDOW_GRACE_SECONDS
                || logMtime >= crashMtime - INCIDENT_WINDOW_GRACE_SECONDS;
        if (ok) {
            return new Check(
                    "incident_window",
                    Status.PASS,
                    "Selected log looks close enough to the crash time.",
                    false);
        }
        return new Check(
                "incident_window",
                Status.WARN,
                "Selected log may not cover the crash time — check you picked the right log.",
                false);
    }

    private static Long maxCrashMtime(JsonObject catalog, List<String> selected) {
        if (!catalog.has("crashes") || !catalog.get("crashes").isJsonArray()) {
            return null;
        }
        Long max = null;
        for (JsonElement el : catalog.getAsJsonArray("crashes")) {
            if (!el.isJsonObject()) {
                continue;
            }
            JsonObject row = el.getAsJsonObject();
            String file = row.has("file") && row.get("file").isJsonPrimitive()
                    ? row.get("file").getAsString()
                    : (row.has("name") && row.get("name").isJsonPrimitive()
                    ? row.get("name").getAsString() : "");
            if (file.isBlank() || !matchesSelected(selected, file)) {
                continue;
            }
            if (!row.has("mtime") || !row.get("mtime").isJsonPrimitive()) {
                continue;
            }
            long mt = row.get("mtime").getAsLong();
            if (max == null || mt > max) {
                max = mt;
            }
        }
        return max;
    }

    private static Long maxLogMtime(JsonObject catalog, SupportComposeOptions opts) {
        if (!catalog.has("logs") || !catalog.get("logs").isJsonArray()) {
            return null;
        }
        List<String> wanted = new ArrayList<>();
        for (SupportComposeOptions.LogSelection sel : opts.logs()) {
            if (sel != null && sel.file() != null && !sel.file().isBlank()
                    && sel.mode() != SupportComposeOptions.LogMode.OFF) {
                wanted.add(sel.file().trim());
            }
        }
        if (wanted.isEmpty() && opts.includeLatestLogTail()) {
            wanted.add("latest.log");
        }
        Long max = null;
        for (JsonElement el : catalog.getAsJsonArray("logs")) {
            if (!el.isJsonObject()) {
                continue;
            }
            JsonObject row = el.getAsJsonObject();
            String name = row.has("name") && row.get("name").isJsonPrimitive()
                    ? row.get("name").getAsString() : "";
            if (name.isBlank() || !matchesSelected(wanted, name)) {
                continue;
            }
            if (!row.has("mtime") || !row.get("mtime").isJsonPrimitive()) {
                continue;
            }
            long mt = row.get("mtime").getAsLong();
            if (max == null || mt > max) {
                max = mt;
            }
        }
        return max;
    }

    private static boolean matchesSelected(List<String> selected, String file) {
        String bare = file.replace('\\', '/');
        int slash = bare.lastIndexOf('/');
        if (slash >= 0) {
            bare = bare.substring(slash + 1);
        }
        for (String s : selected) {
            if (s == null || s.isBlank()) {
                continue;
            }
            String sb = s.replace('\\', '/');
            int ss = sb.lastIndexOf('/');
            if (ss >= 0) {
                sb = sb.substring(ss + 1);
            }
            if (sb.equalsIgnoreCase(bare) || s.equalsIgnoreCase(file)) {
                return true;
            }
        }
        return false;
    }
}
