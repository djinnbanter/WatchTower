package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Stream;

/**
 * Scan crash-reports directory (ported from {@code scan_crash_reports}).
 */
public final class CrashReportScanner {

    private CrashReportScanner() {
    }

    public static void scanCrashReports(String serverDir, JsonObject staging, double cutoff) {
        Path cr = Path.of(serverDir, "crash-reports");
        if (!Files.isDirectory(cr)) {
            return;
        }
        JsonObject mc = staging.getAsJsonObject("minecraft");
        JsonArray reports = mc.has("new_crash_reports")
                ? mc.getAsJsonArray("new_crash_reports")
                : new JsonArray();
        String newestSummary = "";

        List<Path> files;
        try (Stream<Path> stream = Files.list(cr)) {
            files = stream.filter(p -> p.getFileName().toString().endsWith(".txt"))
                    .sorted(Comparator.comparingLong(CrashReportScanner::mtime).reversed())
                    .toList();
        } catch (IOException e) {
            return;
        }

        for (Path p : files) {
            double mtime = mtime(p);
            if (mtime < cutoff) {
                continue;
            }
            ZonedDateTime when = Instant.ofEpochSecond((long) mtime).atZone(ZoneId.systemDefault());
            String quote = "";
            String summary = "";
            String modFile = "";
            String exception = "";
            String detail = p.getFileName().toString();
            String label = "";
            CrashReportParser.ParsedCrash parsed = null;
            try {
                String body = Files.readString(p, StandardCharsets.UTF_8);
                String[] lines = body.split("\\R");
                quote = lines.length > 0 ? lines[0] : "";
                if (quote.length() > 200) {
                    quote = quote.substring(0, 200);
                }
                CrashDetails details = CrashDetails.parse(body);
                parsed = CrashReportParser.parse(body, List.of());
                summary = details.summary();
                modFile = details.modFile();
                exception = details.exception();
                label = details.displayLabel();
                if (!label.isBlank()) {
                    detail = label;
                }
            } catch (IOException ignored) {
                // skip
            }
            if (newestSummary.isEmpty()) {
                if (!label.isBlank()) {
                    newestSummary = label;
                } else if (!summary.isEmpty()) {
                    newestSummary = summary;
                }
            }
            JsonObject report = new JsonObject();
            report.addProperty("file", p.getFileName().toString());
            report.addProperty("time", CollectSupport.iso(when));
            report.addProperty("quote", quote);
            report.addProperty("summary", summary);
            if (!modFile.isBlank()) {
                report.addProperty("mod_file", modFile);
            }
            if (!exception.isBlank()) {
                report.addProperty("exception", exception);
            }
            if (parsed != null) {
                parsed.applyTo(report);
            }
            reports.add(report);

            JsonObject ev = new JsonObject();
            ev.addProperty("time", CollectSupport.iso(when));
            ev.addProperty("type", "crash_report");
            ev.addProperty("source", "filesystem");
            ev.addProperty("detail", detail);
            ev.addProperty("importance", 10);
            JsonArray evArr = new JsonArray();
            evArr.add(CollectSupport.evidence("crash-reports/" + p.getFileName(), null, quote, CollectSupport.iso(when)));
            ev.add("evidence", evArr);
            CollectSupport.appendEvent(staging, ev);
        }
        mc.add("new_crash_reports", reports);
        if (!newestSummary.isEmpty()) {
            mc.addProperty("crash_summary", newestSummary);
        }
    }

    public static String parseCrashSummary(String text) {
        String[] lines = text.split("\\R");
        for (String line : lines) {
            String trimmed = line.strip();
            if (trimmed.startsWith("Description:")) {
                String desc = trimmed.substring("Description:".length()).strip();
                return desc.length() > 200 ? desc.substring(0, 200) : desc;
            }
            if (trimmed.contains("Caused by:")) {
                return trimmed.length() > 200 ? trimmed.substring(0, 200) : trimmed;
            }
            if (trimmed.contains("Mod File:") || trimmed.contains("Failure message:")) {
                return trimmed.length() > 200 ? trimmed.substring(0, 200) : trimmed;
            }
        }
        int limit = Math.min(30, lines.length);
        for (int i = 0; i < limit; i++) {
            String s = lines[i].strip();
            if (!s.isEmpty() && !s.startsWith("----") && !s.contains("Time:")) {
                return s.length() > 200 ? s.substring(0, 200) : s;
            }
        }
        return "";
    }

    private static long mtime(Path p) {
        try {
            return Files.getLastModifiedTime(p).toMillis() / 1000L;
        } catch (IOException e) {
            return 0;
        }
    }
}
