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
 * Deep scan of gzipped logs for Chunky pregen progress.
 */
public final class ChunkyPregenScanner {

    private ChunkyPregenScanner() {
    }

    public static void scanChunkyPregenLogs(String serverDir, JsonObject staging, double cutoff, ReportConfig config) {
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

        ChunkyLogSupport.ChunkyState state = new ChunkyLogSupport.ChunkyState();
        Path latest = base.resolve("latest.log");
        if (Files.isRegularFile(latest)) {
            scanFile(latest, cutoff, state);
        }
        for (Path logPath : gzFiles) {
            try {
                GzipLineReader.forEachLine(logPath, (lineNo, line) ->
                        parseLine(line, lineNo, logPath.getFileName().toString(), cutoff, state));
            } catch (IOException ignored) {
                // skip
            }
        }

        if (state.last == null) {
            return;
        }

        ZonedDateTime now = ZonedDateTime.now();
        ZonedDateTime serverStarted = null;
        JsonObject mc = staging.getAsJsonObject("minecraft");
        if (mc.has("server_started") && !mc.get("server_started").isJsonNull()) {
            serverStarted = CollectSupport.parseTime(mc.get("server_started").getAsString());
        }

        JsonObject chunky = ChunkyLogSupport.buildChunkyPregen(
                state.first, state.last, state.rateVals, now, serverStarted, state);
        staging.getAsJsonObject("optional").add("chunky_pregen", chunky);
    }

    private static void scanFile(Path logPath, double cutoff, ChunkyLogSupport.ChunkyState state) {
        try {
            GzipLineReader.forEachLine(logPath, (lineNo, line) ->
                    parseLine(line, lineNo, logPath.getFileName().toString(), cutoff, state));
        } catch (IOException ignored) {
            // skip
        }
    }

    private static void parseLine(String line, int lineNo, String fileName, double cutoff, ChunkyLogSupport.ChunkyState state) {
        String stripped = line.stripTrailing();
        ZonedDateTime ts = CollectSupport.parseLogTs(stripped);
        if (ts != null && CollectSupport.epochSeconds(ts) < cutoff) {
            return;
        }
        if (LogPatterns.CHUNK_GEN_FAILURE.matcher(stripped).find()) {
            state.chunkGenFailures++;
        }
        if (LogPatterns.CHUNKY_PAUSED.matcher(stripped).find() && ts != null) {
            ChunkyLogSupport.markPaused(state, ts);
            return;
        }
        Matcher cm = LogPatterns.CHUNKY_TASK.matcher(stripped);
        if (!cm.find() || ts == null) {
            return;
        }
        if (!stripped.contains("Server thread")) {
            return;
        }
        JsonObject entry = ChunkyLogSupport.buildEntryFromMatcher(cm, ts, fileName, lineNo);
        long processed = entry.get("chunks").getAsLong();
        if (state.lastProcessed >= 0 && processed == state.lastProcessed) {
            // stall tracking handled in FactsBuilder via hours_since_last
        } else if (state.lastProcessed >= 0) {
            state.lastProcessedChangeEpoch = (long) CollectSupport.epochSeconds(ts);
        }
        state.lastProcessed = processed;
        ChunkyLogSupport.applyEntry(state, entry, ts);
    }
}
