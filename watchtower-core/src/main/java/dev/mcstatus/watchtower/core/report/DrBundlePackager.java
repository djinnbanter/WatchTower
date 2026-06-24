package dev.mcstatus.watchtower.core.report;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.stream.Stream;
import java.util.zip.ZipOutputStream;

/**
 * Packages DR facts, brief, and window-matched log files into a single upload zip.
 */
public final class DrBundlePackager {

    public static final int BUNDLE_VERSION = 1;
    private static final long SIZE_WARN_BYTES = 25L * 1024L * 1024L;
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();

    private DrBundlePackager() {
    }

    public record BundleResult(
            Path zipPath,
            long sizeBytes,
            List<String> warnings,
            DrLogFileSelector.DrLogSelection selection,
            DrLogCorrelation.CorrelationResult correlation
    ) {
    }

    public static BundleResult packageBundle(
            Path outDir,
            Path serverDir,
            Path factsPath,
            Path briefPath,
            JsonObject facts,
            DrLogFileSelector.DrLogSelection selection,
            DrLogCorrelation.CorrelationResult correlation
    ) throws IOException {
        return packageBundle(outDir, null, serverDir, factsPath, briefPath, facts, selection, correlation);
    }

    public static BundleResult packageBundle(
            Path outDir,
            Path zipPathOverride,
            Path serverDir,
            Path factsPath,
            Path briefPath,
            JsonObject facts,
            DrLogFileSelector.DrLogSelection selection,
            DrLogCorrelation.CorrelationResult correlation
    ) throws IOException {
        Files.createDirectories(outDir);
        Path zipPath = resolveZipPath(outDir, zipPathOverride);
        if (zipPathOverride != null && zipPathOverride.getParent() != null) {
            Files.createDirectories(zipPathOverride.getParent());
        }

        String factsName = factsPath.getFileName().toString();
        String briefName = briefPath != null && Files.isRegularFile(briefPath)
                ? briefPath.getFileName().toString()
                : null;

        JsonObject manifest = buildManifest(selection, correlation, factsName, briefName);

        List<String> warnings = new ArrayList<>();
        long projectedSize = estimateSize(factsPath, briefPath, selection);
        if (projectedSize > SIZE_WARN_BYTES) {
            warnings.add("Bundle size is large (" + ForensicsZipUtil.formatSize(projectedSize)
                    + ") — upload may be slow, but all window-matched files are included.");
        }

        try (ZipOutputStream zos = new ZipOutputStream(Files.newOutputStream(zipPath))) {
            ForensicsZipUtil.addTextEntry(zos, "manifest.json", GSON.toJson(manifest));
            ForensicsZipUtil.addFileEntry(zos, factsName, factsPath);
            if (briefPath != null && Files.isRegularFile(briefPath)) {
                ForensicsZipUtil.addFileEntry(zos, briefName, briefPath);
            }
            for (DrLogFileSelector.SelectedLogFile f : allFiles(selection)) {
                ForensicsZipUtil.addFileEntry(zos, f.zipEntryPath(), f.sourcePath());
            }
            addIncidentsEntries(zos, serverDir);
            ForensicsZipUtil.addTextEntry(zos, "README.txt", readmeText());
        }

        long size = Files.size(zipPath);
        if (size > SIZE_WARN_BYTES && warnings.isEmpty()) {
            warnings.add("Bundle size is " + ForensicsZipUtil.formatSize(size) + ".");
        }

        return new BundleResult(zipPath, size, warnings, selection, correlation);
    }

    public static Path resolveZipPath(Path outDir, Path zipPathOverride) {
        if (zipPathOverride != null) {
            return zipPathOverride.toAbsolutePath().normalize();
        }
        String timestamp = ZonedDateTime.now(ZoneId.systemDefault())
                .format(DateTimeFormatter.ofPattern("yyyy-MM-dd_HH-mm-ss"));
        return outDir.resolve("watchtower-dr-bundle-" + timestamp + ".zip").toAbsolutePath().normalize();
    }

    public static void enrichFacts(
            JsonObject facts,
            DrLogFileSelector.DrLogSelection selection,
            DrLogCorrelation.CorrelationResult correlation,
            DrModListDiffAnalyzer.ModDiffResult modDiff,
            Path bundlePath,
            List<String> warnings
    ) {
        if (facts == null) {
            return;
        }
        JsonObject meta = facts.has("meta") && facts.get("meta").isJsonObject()
                ? facts.getAsJsonObject("meta")
                : new JsonObject();
        JsonObject drBundle = new JsonObject();
        drBundle.addProperty("bundle_version", BUNDLE_VERSION);
        drBundle.addProperty("selection_policy", selection.selectionPolicy());
        drBundle.addProperty("fallback_minutes", selection.fallbackMinutes());
        drBundle.addProperty("window_start", selection.windowStart().toString());
        drBundle.addProperty("anchor_status", selection.anchorStatus().name());
        if (selection.anchor().found()) {
            JsonObject anchorJson = new JsonObject();
            anchorJson.addProperty("found", true);
            anchorJson.addProperty("time", selection.anchor().anchorTime().toString());
            anchorJson.addProperty("file", selection.anchor().zipEntryPath());
            anchorJson.addProperty("line", selection.anchor().line());
            if (selection.anchor().quote() != null) {
                anchorJson.addProperty("quote", selection.anchor().quote());
            }
            drBundle.add("anchor", anchorJson);
        } else {
            JsonObject anchorJson = new JsonObject();
            anchorJson.addProperty("found", false);
            drBundle.add("anchor", anchorJson);
        }
        if (bundlePath != null) {
            drBundle.addProperty("bundle_file", bundlePath.getFileName().toString());
        }
        JsonObject counts = new JsonObject();
        counts.addProperty("regular", selection.regular().size());
        counts.addProperty("debug", selection.debug().size());
        counts.addProperty("crash", selection.crash().size());
        drBundle.add("file_counts", counts);
        meta.add("dr_bundle", drBundle);
        facts.add("meta", meta);

        JsonObject optional = facts.has("optional") && facts.get("optional").isJsonObject()
                ? facts.getAsJsonObject("optional")
                : new JsonObject();
        optional.add("dr_log_files", logFilesJson(selection));
        optional.add("dr_log_correlation", DrLogCorrelation.toJsonArray(correlation));
        facts.add("optional", optional);

        JsonArray cw = meta.has("collection_warnings") && meta.get("collection_warnings").isJsonArray()
                ? meta.getAsJsonArray("collection_warnings")
                : new JsonArray();
        for (String w : warnings) {
            cw.add(w);
        }
        if (selection.crash().isEmpty()) {
            boolean anyLogsOnly = correlation.attempts().stream()
                    .anyMatch(a -> a.status() == DrLogCorrelation.CorrelationStatus.logs_only && a.failureSignals());
            if (anyLogsOnly) {
                cw.add("Some restart attempts have log failures but no crash report in the bundle window.");
            }
        }
        meta.add("collection_warnings", cw);

        DrModListDiffAnalyzer.applyToFacts(facts, modDiff, selection.anchor());
        enrichModLoadEvidence(facts, selection);
        DrCrashLoopAnalyzer.applyToFacts(facts, correlation, selection);
    }

    private static void enrichModLoadEvidence(JsonObject facts, DrLogFileSelector.DrLogSelection selection) {
        if (!facts.has("issues") || !facts.get("issues").isJsonArray()) {
            return;
        }
        JsonObject failureEv = null;
        List<DrLogFileSelector.SelectedLogFile> regular = selection.regular();
        if (!regular.isEmpty()) {
            DrLogFileSelector.SelectedLogFile last = regular.get(regular.size() - 1);
            failureEv = DrCrashLoopAnalyzer.findFirstFailureLine(last.sourcePath(), last.zipEntryPath());
        }
        if (failureEv == null) {
            return;
        }
        for (var el : facts.getAsJsonArray("issues")) {
            if (!el.isJsonObject()) {
                continue;
            }
            JsonObject issue = el.getAsJsonObject();
            String id = issue.has("id") ? issue.get("id").getAsString() : "";
            if ("MOD_LOAD_FAILED".equals(id) && !issue.has("evidence")) {
                JsonArray ev = new JsonArray();
                ev.add(failureEv);
                issue.add("evidence", ev);
            }
        }
    }

    public static void rewriteFacts(Path factsPath, JsonObject facts) throws IOException {
        Files.writeString(factsPath, GSON.toJson(facts) + System.lineSeparator(), StandardCharsets.UTF_8);
    }

    public static String formatCorrelationSummary(
            DrLogFileSelector.DrLogSelection selection,
            DrLogCorrelation.CorrelationResult correlation
    ) {
        StringBuilder sb = new StringBuilder();
        sb.append(String.format(Locale.US,
                "Bundle (since last start, %dm cap): %d regular, %d debug, %d crash files%n",
                selection.fallbackMinutes(),
                selection.regular().size(),
                selection.debug().size(),
                selection.crash().size()));
        for (DrLogCorrelation.AttemptCorrelation a : correlation.attempts()) {
            String timeShort = a.startedAt().length() >= 16 ? a.startedAt().substring(11, 16) : a.startedAt();
            sb.append("  Attempt #").append(a.attempt()).append(' ').append(timeShort).append("  ");
            if (!a.regularLogs().isEmpty()) {
                sb.append("logs ");
            }
            if (!a.debugLogs().isEmpty()) {
                sb.append("+ debug ");
            }
            if (!a.crashReports().isEmpty()) {
                sb.append("+ crash ");
            }
            sb.append(switch (a.status()) {
                case complete -> "✓";
                case logs_only -> "⚠ no crash report";
                case crash_only -> "⚠ crash only";
                case mismatch -> "⚠ timestamp mismatch";
            });
            sb.append(System.lineSeparator());
        }
        return sb.toString();
    }

    private static JsonArray logFilesJson(DrLogFileSelector.DrLogSelection selection) {
        JsonArray arr = new JsonArray();
        for (DrLogFileSelector.SelectedLogFile f : allFiles(selection)) {
            JsonObject o = new JsonObject();
            o.addProperty("path", f.zipEntryPath());
            o.addProperty("category", f.category());
            o.addProperty("mtime", Instant.ofEpochSecond(f.mtimeEpochSec()).toString());
            try {
                o.addProperty("size_bytes", Files.size(f.sourcePath()));
            } catch (IOException ignored) {
            }
            arr.add(o);
        }
        return arr;
    }

    private static List<DrLogFileSelector.SelectedLogFile> allFiles(DrLogFileSelector.DrLogSelection s) {
        List<DrLogFileSelector.SelectedLogFile> all = new ArrayList<>();
        all.addAll(s.regular());
        all.addAll(s.debug());
        all.addAll(s.crash());
        return all;
    }

    private static JsonObject buildManifest(
            DrLogFileSelector.DrLogSelection selection,
            DrLogCorrelation.CorrelationResult correlation,
            String factsName,
            String briefName
    ) {
        JsonObject m = new JsonObject();
        m.addProperty("bundle_version", BUNDLE_VERSION);
        m.addProperty("report_mode", "dr");
        m.addProperty("fallback_minutes", selection.fallbackMinutes());
        m.addProperty("window_start", selection.windowStart().toString());
        m.addProperty("selection_policy", selection.selectionPolicy());
        m.addProperty("anchor_status", selection.anchorStatus().name());
        if (selection.anchor().found()) {
            JsonObject anchorJson = new JsonObject();
            anchorJson.addProperty("found", true);
            anchorJson.addProperty("time", selection.anchor().anchorTime().toString());
            anchorJson.addProperty("file", selection.anchor().zipEntryPath());
            anchorJson.addProperty("line", selection.anchor().line());
            m.add("anchor", anchorJson);
        }
        m.addProperty("facts", factsName);
        if (briefName != null) {
            m.addProperty("brief", briefName);
        }
        JsonObject counts = new JsonObject();
        counts.addProperty("regular", selection.regular().size());
        counts.addProperty("debug", selection.debug().size());
        counts.addProperty("crash", selection.crash().size());
        m.add("file_counts", counts);
        m.add("sessions", DrLogCorrelation.toJsonArray(correlation));
        return m;
    }

    private static long estimateSize(Path factsPath, Path briefPath, DrLogFileSelector.DrLogSelection selection)
            throws IOException {
        long total = Files.size(factsPath);
        if (briefPath != null && Files.isRegularFile(briefPath)) {
            total += Files.size(briefPath);
        }
        for (DrLogFileSelector.SelectedLogFile f : allFiles(selection)) {
            total += Files.size(f.sourcePath());
        }
        return total;
    }

    private static void addIncidentsEntries(ZipOutputStream zos, Path serverDir) throws IOException {
        if (serverDir == null) {
            return;
        }
        Path incidentsDir = serverDir.resolve("watchtower").resolve("incidents");
        if (!Files.isDirectory(incidentsDir)) {
            return;
        }
        try (Stream<Path> stream = Files.list(incidentsDir)) {
            for (Path incident : stream
                    .filter(p -> Files.isRegularFile(p) && p.getFileName().toString().endsWith(".json"))
                    .sorted((a, b) -> b.getFileName().compareTo(a.getFileName()))
                    .toList()) {
                ForensicsZipUtil.addFileEntry(zos, "incidents/" + incident.getFileName(), incident);
            }
        }
    }

    private static String readmeText() {
        return """
                Watchtower DR bundle
                ====================
                Upload this zip to the Watchtower DR cloud viewer (one file — facts, brief, and logs).

                Generated by: watchtower-cli dr
                Includes watchtower/incidents/*.json when present (auto + manual lag pins).
                """;
    }
}
