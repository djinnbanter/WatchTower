package dev.mcstatus.watchtower;

import dev.mcstatus.watchtower.core.collect.ReportArtifactFinder;
import dev.mcstatus.watchtower.core.report.ForensicsZipUtil;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.zip.ZipOutputStream;

/**
 * Bounded forensics zip for {@code /watchtower diagnostics}.
 */
public final class DiagnosticsPackager {

    private static final int LOG_TAIL_LINES = 500;
    private static final int CRASH_HEAD_LINES = 100;

    private DiagnosticsPackager() {
    }

    public record PackResult(Path zipPath, long sizeBytes) {
    }

    public static PackResult packageDiagnostics(Path reportDir, Path serverDir, Path factsPath, Path briefPath)
            throws IOException {
        Files.createDirectories(reportDir);
        String timestamp = ZonedDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd_HH-mm-ss"));
        Path zipPath = reportDir.resolve("watchtower-diagnostics-" + timestamp + ".zip");

        JsonObject facts = null;
        if (factsPath != null && Files.isRegularFile(factsPath)) {
            facts = JsonParser.parseString(Files.readString(factsPath, StandardCharsets.UTF_8)).getAsJsonObject();
        }

        try (ZipOutputStream zos = new ZipOutputStream(Files.newOutputStream(zipPath))) {
            if (factsPath != null && Files.isRegularFile(factsPath)) {
                ForensicsZipUtil.addFileEntry(zos, "watchtower-facts-latest.json", factsPath);
            }
            if (briefPath != null && Files.isRegularFile(briefPath)) {
                ForensicsZipUtil.addFileEntry(zos, "watchtower-brief-latest.txt", briefPath);
            }
            if (facts != null) {
                ForensicsZipUtil.addTextEntry(zos, "source-paths.txt", formatSourcePaths(facts));
                ForensicsZipUtil.addTextEntry(zos, "crash-summaries.txt", formatCrashSummaries(facts));
            }
            Path latestLog = serverDir.resolve("logs").resolve("latest.log");
            if (Files.isRegularFile(latestLog)) {
                ForensicsZipUtil.addTextEntry(zos, "logs-tail.txt", tailLines(latestLog, LOG_TAIL_LINES));
            }
            if (facts != null) {
                addCrashHeads(zos, facts, serverDir);
            }
        }

        return new PackResult(zipPath, Files.size(zipPath));
    }

    public static Path findLatestFacts(Path reportDir) throws IOException {
        return ReportArtifactFinder.findLatestFacts(reportDir);
    }

    public static Path findLatestBrief(Path reportDir) throws IOException {
        return ReportArtifactFinder.findLatestBrief(reportDir);
    }

    private static String formatSourcePaths(JsonObject facts) {
        JsonObject meta = facts.has("meta") ? facts.getAsJsonObject("meta") : null;
        if (meta == null || !meta.has("source_paths")) {
            return "(no source_paths in facts)";
        }
        JsonObject sp = meta.getAsJsonObject("source_paths");
        StringBuilder sb = new StringBuilder();
        for (String key : sp.keySet()) {
            sb.append(key).append(": ").append(sp.get(key).getAsString()).append('\n');
        }
        return sb.toString();
    }

    private static String formatCrashSummaries(JsonObject facts) {
        JsonObject optional = facts.has("optional") ? facts.getAsJsonObject("optional") : null;
        if (optional == null || !optional.has("crash_summaries")) {
            return "(no crash summaries)";
        }
        JsonArray arr = optional.getAsJsonArray("crash_summaries");
        StringBuilder sb = new StringBuilder();
        for (JsonElement el : arr) {
            if (!el.isJsonObject()) {
                continue;
            }
            JsonObject c = el.getAsJsonObject();
            sb.append(c.has("time") ? c.get("time").getAsString() : "?");
            sb.append("  ");
            sb.append(c.has("file") ? c.get("file").getAsString() : "?");
            if (c.has("summary")) {
                sb.append("\n  ").append(c.get("summary").getAsString());
            }
            if (c.has("exception") && !c.get("exception").getAsString().isBlank()) {
                sb.append("\n  ").append(c.get("exception").getAsString());
            }
            if (c.has("mod_file") && !c.get("mod_file").getAsString().isBlank()) {
                sb.append("\n  mod: ").append(c.get("mod_file").getAsString());
            }
            sb.append('\n').append('\n');
        }
        return sb.toString();
    }

    private static void addCrashHeads(ZipOutputStream zos, JsonObject facts, Path serverDir) throws IOException {
        JsonObject optional = facts.has("optional") ? facts.getAsJsonObject("optional") : null;
        if (optional == null || !optional.has("crash_summaries")) {
            return;
        }
        Path crashDir = serverDir.resolve("crash-reports");
        for (JsonElement el : optional.getAsJsonArray("crash_summaries")) {
            if (!el.isJsonObject()) {
                continue;
            }
            JsonObject c = el.getAsJsonObject();
            if (!c.has("file")) {
                continue;
            }
            Path crashFile = crashDir.resolve(c.get("file").getAsString());
            if (!Files.isRegularFile(crashFile)) {
                continue;
            }
            String entryName = "crash-reports/" + c.get("file").getAsString();
            ForensicsZipUtil.addTextEntry(zos, entryName, headLines(crashFile, CRASH_HEAD_LINES));
        }
    }

    private static String tailLines(Path file, int maxLines) throws IOException {
        List<String> all = Files.readAllLines(file, StandardCharsets.UTF_8);
        int start = Math.max(0, all.size() - maxLines);
        return String.join("\n", all.subList(start, all.size())) + "\n";
    }

    private static String headLines(Path file, int maxLines) throws IOException {
        List<String> all = Files.readAllLines(file, StandardCharsets.UTF_8);
        int end = Math.min(maxLines, all.size());
        return String.join("\n", all.subList(0, end)) + "\n";
    }

    public static String formatSize(long bytes) {
        return ForensicsZipUtil.formatSize(bytes);
    }
}
