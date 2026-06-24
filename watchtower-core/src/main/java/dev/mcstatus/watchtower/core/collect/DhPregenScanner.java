package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.report.ReportConfig;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.regex.Matcher;

/**
 * Deep scan of gzipped logs for DH pregen progress (ported from {@code scan_dh_pregen_logs}).
 */
public final class DhPregenScanner {

    private DhPregenScanner() {
    }

    public static void scanDhPregenLogs(String serverDir, JsonObject staging, double cutoff, ReportConfig config) {
        Path base = Path.of(serverDir, "logs");
        if (!Files.isDirectory(base)) {
            return;
        }
        int gzCount = Math.max(12, config.logGzipCount());
        List<Path> gzFiles = new ArrayList<>();
        try (var stream = Files.list(base)) {
            stream.filter(p -> p.getFileName().toString().endsWith(".log.gz")).forEach(gzFiles::add);
        } catch (IOException e) {
            return;
        }
        gzFiles.sort(Comparator.comparingLong(p -> {
            try {
                return -Files.getLastModifiedTime(p).toMillis();
            } catch (IOException e) {
                return 0;
            }
        }));
        if (gzFiles.size() > gzCount) {
            gzFiles = gzFiles.subList(0, gzCount);
        }

        JsonObject optional = staging.getAsJsonObject("optional");
        JsonObject existing = optional.has("dh_pregen") ? optional.getAsJsonObject("dh_pregen") : null;
        JsonObject[] pregenLastRef = {existing != null && existing.has("last") ? existing.getAsJsonObject("last") : null};
        JsonObject[] pregenFirstRef = {existing != null && existing.has("first") ? existing.getAsJsonObject("first") : null};
        List<Integer> cpsVals = new ArrayList<>();

        for (Path logPath : gzFiles) {
            try {
                GzipLineReader.forEachLine(logPath, (lineNo, line) -> {
                    String stripped = line.stripTrailing();
                    ZonedDateTime ts = CollectSupport.parseLogTs(stripped);
                    if (ts != null && CollectSupport.epochSeconds(ts) < cutoff) {
                        return;
                    }
                    Matcher pm = LogPatterns.PREGEN.matcher(stripped);
                    if (!pm.find() || ts == null) {
                        return;
                    }
                    JsonObject entry = buildEntry(pm, ts, logPath.getFileName().toString(), lineNo);
                    if (CollectSupport.pregenMeaningful(entry)) {
                        if (pregenFirstRef[0] == null
                                || ts.isBefore(CollectSupport.parseTime(pregenFirstRef[0].get("time").getAsString()))) {
                            pregenFirstRef[0] = entry.deepCopy();
                        }
                    }
                    if (pregenLastRef[0] == null
                            || ts.isAfter(CollectSupport.parseTime(pregenLastRef[0].get("time").getAsString()))) {
                        pregenLastRef[0] = entry.deepCopy();
                    }
                    int cps = entry.get("cps").getAsInt();
                    if (cps > 0) {
                        cpsVals.add(cps);
                    }
                });
            } catch (IOException ignored) {
                // skip
            }
        }

        if (pregenLastRef[0] == null) {
            return;
        }

        ZonedDateTime now = ZonedDateTime.now();
        ZonedDateTime serverStarted = null;
        JsonObject mc = staging.getAsJsonObject("minecraft");
        if (mc.has("server_started") && !mc.get("server_started").isJsonNull()) {
            serverStarted = CollectSupport.parseTime(mc.get("server_started").getAsString());
        }

        JsonObject dh = LogScanner.buildDhPregen(
                pregenFirstRef[0] != null ? pregenFirstRef[0] : pregenLastRef[0],
                pregenLastRef[0],
                cpsVals,
                now,
                serverStarted);
        staging.getAsJsonObject("optional").add("dh_pregen", dh);
    }

    private static JsonObject buildEntry(Matcher pm, ZonedDateTime ts, String fileName, int lineNo) {
        String pctRaw = pm.group(4);
        String eta = pm.group(5) != null ? pm.group(5).strip() : "";
        String quote = "Generated radius: " + pm.group(1) + " / " + pm.group(2) + " chunks ("
                + pm.group(3) + " cps"
                + (pctRaw != null ? ", " + pctRaw + "%)" : ")")
                + (!eta.isEmpty() ? ", ETA: " + eta : "");
        JsonObject entry = new JsonObject();
        entry.addProperty("chunks", Double.parseDouble(pm.group(1)));
        entry.addProperty("total", Integer.parseInt(pm.group(2)));
        entry.addProperty("cps", Integer.parseInt(pm.group(3)));
        if (pctRaw != null) {
            entry.addProperty("pct", Double.parseDouble(pctRaw));
        } else {
            entry.add("pct", null);
        }
        if (!eta.isEmpty()) {
            entry.addProperty("eta", eta);
        } else {
            entry.add("eta", null);
        }
        entry.addProperty("time", CollectSupport.iso(ts));
        entry.addProperty("file", "logs/" + fileName);
        entry.addProperty("line", lineNo);
        entry.addProperty("quote", quote);
        return entry;
    }
}
