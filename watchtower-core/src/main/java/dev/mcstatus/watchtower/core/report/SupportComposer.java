package dev.mcstatus.watchtower.core.report;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import dev.mcstatus.watchtower.core.WatchtowerFiles;
import dev.mcstatus.watchtower.core.analyze.ReportPipeline;
import dev.mcstatus.watchtower.core.collect.HostMetricsCollector;
import dev.mcstatus.watchtower.core.collect.JvmFlagsClassifier;
import dev.mcstatus.watchtower.core.collect.SparkPaths;
import dev.mcstatus.watchtower.core.ops.OpsCacheReader;
import dev.mcstatus.watchtower.core.ops.OpsCacheSchema;
import dev.mcstatus.watchtower.core.report.SupportEvidenceCollector.BudgetState;
import dev.mcstatus.watchtower.core.report.SupportEvidenceCollector.CollectedFile;
import dev.mcstatus.watchtower.core.report.SupportEvidenceCollector.CollectedText;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

/**
 * Composes a support zip from continuous stores plus builder options / evidence collectors.
 */
public final class SupportComposer {

    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();

    private SupportComposer() {
    }

    public record ComposeRequest(
            Path outDir,
            Path serverDir,
            Path opsCachePath,
            Path rollupsPath,
            String hostname,
            String loader,
            String panel,
            boolean javaRunning,
            int logStaleMinutes,
            SupportComposeOptions options,
            SupportEnvironmentBuilder.Context environment,
            Path sparkUploadDir,
            String modVersion,
            String minecraftVersion,
            Boolean panelRunning
    ) {
        public ComposeRequest(
                Path outDir,
                Path serverDir,
                Path opsCachePath,
                Path rollupsPath,
                String hostname,
                String loader,
                String panel,
                boolean javaRunning,
                int logStaleMinutes
        ) {
            this(outDir, serverDir, opsCachePath, rollupsPath, hostname, loader, panel, javaRunning,
                    logStaleMinutes, SupportComposeOptions.quickDefaults(), null, null, null, null, null);
        }
    }

    public record ComposeResult(
            Path zipPath,
            Path factsPath,
            Path briefPath,
            long sizeBytes,
            boolean synthesizedFacts
    ) {
    }

    public static ComposeResult compose(ComposeRequest req) throws IOException {
        if (req == null || req.outDir() == null) {
            throw new IOException("compose request missing outDir");
        }
        Files.createDirectories(req.outDir());
        SupportComposeOptions options = req.options() != null ? req.options() : SupportComposeOptions.quickDefaults();

        boolean hasOps = req.opsCachePath() != null && Files.isRegularFile(req.opsCachePath());
        // Redact once here so facts, brief, and the zipped ops-cache are all built from the same safe text.
        String opsRedactedJson = hasOps
                ? SupportRedactor.redactJsonText(Files.readString(req.opsCachePath(), StandardCharsets.UTF_8))
                : null;
        JsonObject ops = opsRedactedJson != null ? parseOpsOrEmpty(opsRedactedJson) : OpsCacheReader.empty();
        boolean hasRollups = req.rollupsPath() != null && Files.isRegularFile(req.rollupsPath());
        if (!hasOps && !hasRollups) {
            throw new IOException("No ops-cache or performance rollups to compose");
        }

        String timestamp = ZonedDateTime.now(ZoneId.systemDefault())
                .format(DateTimeFormatter.ofPattern("yyyy-MM-dd_HH-mm-ss_SSS"));

        Path factsPath = null;
        Path briefPath = null;
        if (hasOps) {
            SupportFactsMapper.Context ctx = new SupportFactsMapper.Context(
                    req.serverDir() != null
                            ? req.serverDir().toAbsolutePath().normalize().toString()
                            : "",
                    req.hostname(),
                    req.loader(),
                    req.panel(),
                    req.javaRunning(),
                    req.logStaleMinutes(),
                    req.modVersion(),
                    req.minecraftVersion(),
                    req.panelRunning());
            JsonObject facts = SupportFactsMapper.fromOpsCache(ops, ctx, collectHostSystem(req.serverDir()));
            factsPath = req.outDir().resolve("watchtower-facts-support-" + timestamp + ".json");
            briefPath = req.outDir().resolve("watchtower-brief-support-" + timestamp + ".txt");
            Files.writeString(factsPath, GSON.toJson(facts), StandardCharsets.UTF_8);
            Files.writeString(briefPath, ReportPipeline.writeBrief(facts), StandardCharsets.UTF_8);
        }

        BudgetState budget = SupportEvidenceCollector.newBudget(options);
        JsonArray evidenceFiles = new JsonArray();
        List<SupportBundlePackager.ExtraEntry> extras = buildExtras(req, options, budget, evidenceFiles, ops);

        SupportEnvironmentBuilder.Context envCtx = req.environment() != null
                ? req.environment()
                : new SupportEnvironmentBuilder.Context(
                req.modVersion(),
                req.minecraftVersion(),
                req.loader(),
                null,
                req.hostname(),
                req.panel(),
                req.javaRunning(),
                System.getProperty("os.name", ""),
                System.getProperty("os.arch", ""));
        JsonObject environment = SupportEnvironmentBuilder.build(envCtx);

        Path rollupsForZip = null;
        if (options.includeRollups() && hasRollups) {
            long rollupsBytes = Files.size(req.rollupsPath());
            String rollupsName = "performance/" + req.rollupsPath().getFileName();
            if (!budget.canFit(rollupsBytes)) {
                budget.omit(rollupsName, "exceeds max_zip_evidence_bytes");
                recordEvidence(evidenceFiles, rollupsName, 0, "exceeds max_zip_evidence_bytes");
            } else {
                rollupsForZip = req.rollupsPath();
                recordEvidence(evidenceFiles, rollupsName, rollupsBytes, null);
                budget = budget.withUsed(budget.usedBytes() + rollupsBytes);
            }
        }

        JsonObject qualityGateJson;
        try {
            Path sparkDir = req.sparkUploadDir();
            JsonObject catalog = SupportBundleCatalog.build(new SupportBundleCatalog.Request(
                    req.serverDir(),
                    req.opsCachePath(),
                    req.rollupsPath(),
                    null,
                    null,
                    sparkDir));
            SupportQualityGate.Result gate = SupportQualityGate.evaluate(
                    req.serverDir(), req.opsCachePath(), catalog, options);
            qualityGateJson = gate.toManifestJson(options.qualityGateOverride());
        } catch (Exception e) {
            qualityGateJson = SupportQualityGate.failOpen("Could not fully check this pack.")
                    .toManifestJson(options.qualityGateOverride());
        }

        SupportBundlePackager.BundleResult bundle = SupportBundlePackager.packageSupportBundle(
                new SupportBundlePackager.PackageRequest(
                        req.outDir(),
                        factsPath,
                        briefPath,
                        hasOps ? req.opsCachePath() : null,
                        rollupsForZip,
                        extras,
                        true,
                        options,
                        environment,
                        evidenceFiles,
                        SupportEvidenceCollector.omissionsArray(budget),
                        timestamp,
                        opsRedactedJson,
                        qualityGateJson));

        return new ComposeResult(
                bundle.zipPath(),
                factsPath,
                briefPath,
                bundle.sizeBytes(),
                factsPath != null
        );
    }

    private static List<SupportBundlePackager.ExtraEntry> buildExtras(
            ComposeRequest req,
            SupportComposeOptions options,
            BudgetState budget,
            JsonArray evidenceFiles,
            JsonObject ops
    ) throws IOException {
        List<SupportBundlePackager.ExtraEntry> extras = new ArrayList<>();
        if (req.serverDir() == null) {
            return extras;
        }
        Path serverDir = req.serverDir();

        // Logs
        List<SupportComposeOptions.LogSelection> logSels = options.logs();
        if ((logSels == null || logSels.isEmpty()) && options.includeLatestLogTail()) {
            logSels = List.of(new SupportComposeOptions.LogSelection(
                    "latest.log", SupportComposeOptions.LogMode.TAIL, options.logTailLines()));
        }
        if (logSels != null) {
            for (SupportComposeOptions.LogSelection sel : logSels) {
                CollectedText ct = SupportEvidenceCollector.collectLog(
                        serverDir, sel, options.maxLogBytesTotal(), budget);
                recordEvidence(evidenceFiles, ct.zipName(), ct.bytes(), ct.skipReason());
                if (ct.skipReason() == null && ct.content() != null) {
                    extras.add(SupportBundlePackager.ExtraEntry.text(ct.zipName(), ct.content()));
                    budget = budget.withUsed(budget.usedBytes() + ct.bytes());
                }
            }
        }

        if (options.includeBootExcerpt()) {
            CollectedText boot = SupportEvidenceCollector.collectBootExcerpt(serverDir, budget);
            recordEvidence(evidenceFiles, boot.zipName(), boot.bytes(), boot.skipReason());
            if (boot.skipReason() == null && boot.content() != null) {
                extras.add(SupportBundlePackager.ExtraEntry.text(boot.zipName(), boot.content()));
                budget = budget.withUsed(budget.usedBytes() + boot.bytes());
            }
        }

        if (options.includeCrashes()) {
            for (CollectedFile cf : SupportEvidenceCollector.collectCrashes(serverDir, options, budget)) {
                if (cf.skipReason() != null && cf.skipReason().startsWith("truncated:")) {
                    String text = cf.skipReason().substring("truncated:".length());
                    String name = cf.zipName();
                    recordEvidence(evidenceFiles, name, cf.bytes(), "truncated");
                    extras.add(SupportBundlePackager.ExtraEntry.text(name, text));
                    budget = budget.withUsed(budget.usedBytes() + cf.bytes());
                } else if (cf.skipReason() != null) {
                    recordEvidence(evidenceFiles, cf.zipName(), 0, cf.skipReason());
                } else if (cf.path() != null) {
                    // Redact crash text into zip as text (safer than raw binary copy of secrets)
                    String raw = Files.readString(cf.path(), StandardCharsets.UTF_8);
                    String redacted = SupportRedactor.redactText(raw);
                    long bytes = redacted.getBytes(StandardCharsets.UTF_8).length;
                    recordEvidence(evidenceFiles, cf.zipName(), bytes, null);
                    extras.add(SupportBundlePackager.ExtraEntry.text(cf.zipName(), redacted));
                    budget = budget.withUsed(budget.usedBytes() + bytes);
                }
            }
        }

        if (options.includeSpark()) {
            Path sparkDir = req.sparkUploadDir();
            if (sparkDir == null) {
                sparkDir = SparkPaths.uploadDir(serverDir, null);
            }
            for (CollectedFile cf : SupportEvidenceCollector.collectSpark(serverDir, sparkDir, options, budget)) {
                if (cf.skipReason() != null && cf.skipReason().startsWith("listing:")) {
                    String listing = cf.skipReason().substring("listing:".length());
                    extras.add(SupportBundlePackager.ExtraEntry.text("spark-profiles.txt", listing));
                    recordEvidence(evidenceFiles, "spark-profiles.txt", utf8Len(listing), null);
                } else if (cf.skipReason() != null) {
                    recordEvidence(evidenceFiles, cf.zipName(), 0, cf.skipReason());
                } else if (cf.path() != null) {
                    recordEvidence(evidenceFiles, cf.zipName(), cf.bytes(), null);
                    extras.add(SupportBundlePackager.ExtraEntry.file(cf.zipName(), cf.path()));
                    budget = budget.withUsed(budget.usedBytes() + cf.bytes());
                }
            }
        }

        // Watchtower internals
        Path wtDir = serverDir.resolve("watchtower");
        if (options.includeConf()) {
            Path conf = wtDir.resolve(WatchtowerFiles.CONF_FILENAME);
            if (Files.isRegularFile(conf)) {
                String text = SupportRedactor.redactConfOrToml(Files.readString(conf, StandardCharsets.UTF_8));
                extras.add(SupportBundlePackager.ExtraEntry.text("watchtower/conf-redacted.conf", text));
                recordEvidence(evidenceFiles, "watchtower/conf-redacted.conf", utf8Len(text), null);
            }
        }
        if (options.includeServerToml()) {
            Path toml = serverDir.resolve("config").resolve("watchtower-server.toml");
            if (Files.isRegularFile(toml)) {
                String text = SupportRedactor.redactConfOrToml(Files.readString(toml, StandardCharsets.UTF_8));
                extras.add(SupportBundlePackager.ExtraEntry.text("watchtower/server-toml-redacted.toml", text));
                recordEvidence(evidenceFiles, "watchtower/server-toml-redacted.toml", utf8Len(text), null);
            }
        }
        if (options.includeState()) {
            Path state = wtDir.resolve(WatchtowerFiles.STATE_FILENAME);
            if (Files.isRegularFile(state)) {
                String text = SupportRedactor.redactJsonText(sanitizeStateJson(Files.readString(state, StandardCharsets.UTF_8)));
                extras.add(SupportBundlePackager.ExtraEntry.text("watchtower/state-safe.json", text));
                recordEvidence(evidenceFiles, "watchtower/state-safe.json", utf8Len(text), null);
            }
        }
        if (options.includeModsList()) {
            String modsList = buildModsList(ops);
            if (!modsList.isBlank()) {
                extras.add(SupportBundlePackager.ExtraEntry.text("mods/mods-list.txt", modsList));
                recordEvidence(evidenceFiles, "mods/mods-list.txt", utf8Len(modsList), null);
            }
        }
        if (options.includeJvmFlags()) {
            try {
                List<String> inputArgs = java.lang.management.ManagementFactory.getRuntimeMXBean().getInputArguments();
                JsonObject flags = JvmFlagsClassifier.classify(inputArgs);
                String text = GSON.toJson(flags);
                extras.add(SupportBundlePackager.ExtraEntry.text("watchtower/jvm-flags.json", text));
                recordEvidence(evidenceFiles, "watchtower/jvm-flags.json", utf8Len(text), null);
            } catch (Exception ignored) {
            }
        }
        if (options.includeServerProperties()) {
            Path props = serverDir.resolve("server.properties");
            if (Files.isRegularFile(props)) {
                String text = SupportRedactor.redactConfOrToml(Files.readString(props, StandardCharsets.UTF_8));
                extras.add(SupportBundlePackager.ExtraEntry.text("watchtower/server-properties-redacted.properties", text));
                recordEvidence(evidenceFiles, "watchtower/server-properties-redacted.properties", utf8Len(text), null);
            }
        }
        if (options.includeSnapshot()) {
            Path snap = wtDir.resolve("snapshot.json");
            if (Files.isRegularFile(snap)) {
                long size = Files.size(snap);
                String zipName = "performance/snapshot.json";
                if (!budget.canFit(size)) {
                    budget.omit(zipName, "exceeds max_zip_evidence_bytes");
                    recordEvidence(evidenceFiles, zipName, 0, "exceeds max_zip_evidence_bytes");
                } else {
                    extras.add(SupportBundlePackager.ExtraEntry.file(zipName, snap));
                    recordEvidence(evidenceFiles, zipName, size, null);
                    budget = budget.withUsed(budget.usedBytes() + size);
                }
            }
        }
        if (options.includeLiveHistory()) {
            Path live = wtDir.resolve("live-history.json");
            if (Files.isRegularFile(live)) {
                String windowed = windowLiveHistory(live, options.liveHistoryMinutes());
                long size = utf8Len(windowed);
                String zipName = "performance/live-history-window.json";
                if (!budget.canFit(size)) {
                    budget.omit(zipName, "exceeds max_zip_evidence_bytes");
                    recordEvidence(evidenceFiles, zipName, 0, "exceeds max_zip_evidence_bytes");
                } else {
                    extras.add(SupportBundlePackager.ExtraEntry.text(zipName, windowed));
                    recordEvidence(evidenceFiles, zipName, size, null);
                    budget = budget.withUsed(budget.usedBytes() + size);
                }
            }
        }

        return extras;
    }

    private static void recordEvidence(JsonArray evidenceFiles, String name, long bytes, String skipReason) {
        JsonObject row = new JsonObject();
        row.addProperty("file", name);
        row.addProperty("bytes", bytes);
        if (skipReason != null) {
            row.addProperty("skipped", skipReason);
        } else {
            row.addProperty("included", true);
        }
        evidenceFiles.add(row);
    }

    private static long utf8Len(String s) {
        return s == null ? 0L : s.getBytes(StandardCharsets.UTF_8).length;
    }

    private static JsonObject parseOpsOrEmpty(String json) {
        try {
            JsonObject root = JsonParser.parseString(json).getAsJsonObject();
            if (!root.has(OpsCacheSchema.SCHEMA_VERSION_KEY)) {
                root.addProperty(OpsCacheSchema.SCHEMA_VERSION_KEY, OpsCacheSchema.SCHEMA_VERSION);
            }
            return root;
        } catch (Exception e) {
            return OpsCacheReader.empty();
        }
    }

    /** Best-effort host metrics for the brief. Returns null when unavailable; never fails compose. */
    private static JsonObject collectHostSystem(Path serverDir) {
        try {
            String dir = serverDir != null ? serverDir.toAbsolutePath().normalize().toString() : ".";
            return HostMetricsCollector.collectSystemBasics(dir);
        } catch (Exception e) {
            return null;
        }
    }

    private static String sanitizeStateJson(String raw) {
        try {
            JsonObject o = JsonParser.parseString(raw).getAsJsonObject();
            o.remove("password");
            o.remove("totp");
            o.remove("recovery");
            o.remove("auth");
            return GSON.toJson(o);
        } catch (Exception e) {
            return SupportRedactor.redactJsonText(raw);
        }
    }

    private static String buildModsList(JsonObject ops) {
        if (ops == null || !ops.has(OpsCacheSchema.RUNNING_MODS)) {
            return "";
        }
        JsonObject rm = ops.getAsJsonObject(OpsCacheSchema.RUNNING_MODS);
        if (!rm.has(OpsCacheSchema.RUNNING_MODS_MODS) || !rm.get(OpsCacheSchema.RUNNING_MODS_MODS).isJsonArray()) {
            return "";
        }
        StringBuilder sb = new StringBuilder();
        sb.append("# id\tversion\tdisplay\n");
        for (var el : rm.getAsJsonArray(OpsCacheSchema.RUNNING_MODS_MODS)) {
            if (!el.isJsonObject()) {
                continue;
            }
            JsonObject m = el.getAsJsonObject();
            String id = m.has("id") ? m.get("id").getAsString() : "?";
            String ver = m.has("version") ? m.get("version").getAsString() : "?";
            String name = m.has("display_name") ? m.get("display_name").getAsString()
                    : (m.has("name") ? m.get("name").getAsString() : "");
            sb.append(id).append('\t').append(ver).append('\t').append(name).append('\n');
        }
        return sb.toString();
    }

    private static String windowLiveHistory(Path live, int minutes) throws IOException {
        String raw = Files.readString(live, StandardCharsets.UTF_8);
        if (minutes <= 0) {
            return SupportRedactor.redactJsonText(raw);
        }
        try {
            JsonObject root = JsonParser.parseString(raw).getAsJsonObject();
            long cutoff = Instant.now().getEpochSecond() - (long) minutes * 60L;
            if (root.has("samples") && root.get("samples").isJsonArray()) {
                JsonObject out = new JsonObject();
                out.addProperty("window_minutes", minutes);
                out.addProperty("cutoff_epoch", cutoff);
                out.add("samples", keepAfterCutoff(root.getAsJsonArray("samples"), cutoff));
                return SupportRedactor.redactJsonText(GSON.toJson(out));
            }
            if (root.has("series") && root.get("series").isJsonObject()) {
                JsonObject series = root.getAsJsonObject("series");
                JsonObject trimmed = new JsonObject();
                for (String key : series.keySet()) {
                    if (series.get(key).isJsonArray()) {
                        trimmed.add(key, keepAfterCutoff(series.getAsJsonArray(key), cutoff));
                    } else {
                        trimmed.add(key, series.get(key).deepCopy());
                    }
                }
                JsonObject out = new JsonObject();
                out.addProperty("window_minutes", minutes);
                out.addProperty("cutoff_epoch", cutoff);
                for (String key : root.keySet()) {
                    if (!"series".equals(key)) {
                        out.add(key, root.get(key).deepCopy());
                    }
                }
                out.add("series", trimmed);
                return SupportRedactor.redactJsonText(GSON.toJson(out));
            }
            return SupportRedactor.redactJsonText(raw);
        } catch (Exception e) {
            return SupportRedactor.redactJsonText(raw);
        }
    }

    /** Points with an unreadable timestamp are kept: this trims for size, it must not silently drop data. */
    private static JsonArray keepAfterCutoff(JsonArray points, long cutoff) {
        JsonArray kept = new JsonArray();
        for (var el : points) {
            if (!el.isJsonObject()) {
                continue;
            }
            JsonObject point = el.getAsJsonObject();
            Long epoch = pointEpochSeconds(point);
            if (epoch == null || epoch >= cutoff) {
                kept.add(point);
            }
        }
        return kept;
    }

    private static Long pointEpochSeconds(JsonObject point) {
        for (String key : new String[]{"t", "ts", "epoch"}) {
            if (!point.has(key) || point.get(key).isJsonNull() || !point.get(key).isJsonPrimitive()) {
                continue;
            }
            var prim = point.getAsJsonPrimitive(key);
            try {
                if (prim.isNumber()) {
                    long v = prim.getAsLong();
                    return v > 1_000_000_000_000L ? v / 1000L : v;
                }
                String s = prim.getAsString();
                try {
                    return Instant.parse(s).getEpochSecond();
                } catch (Exception e) {
                    return OffsetDateTime.parse(s).toEpochSecond();
                }
            } catch (Exception ignored) {
                return null;
            }
        }
        return null;
    }
}
