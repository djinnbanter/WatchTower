package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonObject;

import java.io.IOException;
import java.io.RandomAccessFile;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.regex.Matcher;

/**
 * Tails {@code logs/latest.log} for DH and Chunky pregen progress lines.
 */
public final class LivePregenTailer {

    private static final int BOOTSTRAP_BYTES = 512 * 1024;

    private final PregenLogSupport.PregenState dhState = new PregenLogSupport.PregenState();
    private final ChunkyLogSupport.ChunkyState chunkyState = new ChunkyLogSupport.ChunkyState();
    private Path logPath;
    private long filePos;
    private long lastSize;
    private ZonedDateTime serverStarted;

    public void reset(Path serverDir, ZonedDateTime serverStartedAt) {
        this.logPath = serverDir.resolve("logs").resolve("latest.log");
        this.filePos = 0;
        this.lastSize = 0;
        this.serverStarted = serverStartedAt;
        dhState.pregenFirst = null;
        dhState.pregenLast = null;
        dhState.cpsVals.clear();
        chunkyState.first = null;
        chunkyState.last = null;
        chunkyState.rateVals.clear();
        chunkyState.paused = false;
        chunkyState.lastProcessed = -1;
        chunkyState.chunkGenFailures = 0;
        bootstrapTail();
    }

    public void tail() {
        if (logPath == null || !Files.isRegularFile(logPath)) {
            return;
        }
        try {
            long size = Files.size(logPath);
            if (size < filePos) {
                filePos = 0;
            }
            if (size == filePos) {
                lastSize = size;
                return;
            }
            try (RandomAccessFile raf = new RandomAccessFile(logPath.toFile(), "r")) {
                raf.seek(filePos);
                String chunk = readUtf8(raf, size - filePos);
                filePos = size;
                lastSize = size;
                parseChunk(chunk, (int) Math.max(1, filePos - chunk.length()));
            }
        } catch (IOException ignored) {
            // log may rotate mid-read
        }
    }

    public JsonObject getDhPregen() {
        return PregenLogSupport.buildDhPregen(
                dhState.pregenFirst,
                dhState.pregenLast,
                dhState.cpsVals,
                ZonedDateTime.now(ZoneId.systemDefault()),
                serverStarted);
    }

    public JsonObject getChunkyPregen() {
        return ChunkyLogSupport.buildChunkyPregen(
                chunkyState.first,
                chunkyState.last,
                chunkyState.rateVals,
                ZonedDateTime.now(ZoneId.systemDefault()),
                serverStarted,
                chunkyState);
    }

    private void bootstrapTail() {
        if (logPath == null || !Files.isRegularFile(logPath)) {
            return;
        }
        try {
            long size = Files.size(logPath);
            long start = Math.max(0, size - BOOTSTRAP_BYTES);
            try (RandomAccessFile raf = new RandomAccessFile(logPath.toFile(), "r")) {
                raf.seek(start);
                if (start > 0) {
                    raf.readLine();
                }
                String chunk = readUtf8(raf, size - raf.getFilePointer());
                parseChunk(chunk, (int) start);
                filePos = size;
                lastSize = size;
            }
        } catch (IOException ignored) {
            filePos = 0;
        }
    }

    private static String readUtf8(RandomAccessFile raf, long maxBytes) throws IOException {
        byte[] buf = new byte[(int) Math.min(maxBytes, 1024 * 1024)];
        int read = raf.read(buf);
        if (read <= 0) {
            return "";
        }
        return new String(buf, 0, read, StandardCharsets.UTF_8);
    }

    private void parseChunk(String chunk, int lineOffsetBase) {
        if (chunk == null || chunk.isEmpty()) {
            return;
        }
        String[] lines = chunk.split("\\R");
        int lineNo = lineOffsetBase;
        for (String line : lines) {
            lineNo++;
            String stripped = line.stripTrailing();
            ZonedDateTime ts = CollectSupport.parseLogTs(stripped);
            if (ts == null) {
                continue;
            }
            if (LogPatterns.CHUNK_GEN_FAILURE.matcher(stripped).find()) {
                chunkyState.chunkGenFailures++;
            }
            if (LogPatterns.CHUNKY_PAUSED.matcher(stripped).find()) {
                ChunkyLogSupport.markPaused(chunkyState, ts);
                continue;
            }
            Matcher cm = LogPatterns.CHUNKY_TASK.matcher(stripped);
            if (cm.find() && stripped.contains("Server thread")) {
                JsonObject entry = ChunkyLogSupport.buildEntryFromMatcher(
                        cm, ts, logPath.getFileName().toString(), lineNo);
                long processed = entry.get("chunks").getAsLong();
                if (chunkyState.lastProcessed >= 0 && processed != chunkyState.lastProcessed) {
                    chunkyState.lastProcessedChangeEpoch = (long) CollectSupport.epochSeconds(ts);
                }
                chunkyState.lastProcessed = processed;
                ChunkyLogSupport.applyEntry(chunkyState, entry, ts);
                continue;
            }
            Matcher pm = LogPatterns.PREGEN.matcher(stripped);
            if (!pm.find()) {
                continue;
            }
            JsonObject entry = PregenLogSupport.buildEntryFromMatcher(
                    pm, ts, logPath.getFileName().toString(), lineNo);
            PregenLogSupport.applyEntry(dhState, entry, ts);
        }
    }
}
