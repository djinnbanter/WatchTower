package dev.mcstatus.watchtower.core.ops;

import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.report.ReportConfig;
import dev.mcstatus.watchtower.core.report.StateManager;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

/**
 * Async chunked backfill of Activity ledger events when the log cursor lags
 * {@code latest.log} (downtime / large unread gap). Never uses StagingBuilder.
 */
public final class ActivityGapBackfill {

    public static final long DEFAULT_GAP_THRESHOLD_BYTES = 5L * 1024 * 1024;
    public static final long DEFAULT_CHUNK_BYTES = 2L * 1024 * 1024;
    public static final int MAX_CHUNKS_PER_WAKE = 4;

    private static final DateTimeFormatter ISO = DateTimeFormatter.ISO_OFFSET_DATE_TIME;

    public record GapStatus(boolean needsBackfill, long gapBytes, long startOffset, long fileSize) {
    }

    public record WakeResult(int chunksRun, int eventsMerged, boolean complete) {
    }

    private ActivityGapBackfill() {
    }

    public static GapStatus detectGap(Path logPath, JsonObject priorOffset, long thresholdBytes) throws IOException {
        if (!Files.isRegularFile(logPath)) {
            return new GapStatus(false, 0, 0, 0);
        }
        long fileSize = Files.size(logPath);
        long startOffset = OpsLogTailScanner.resolveStartOffset(logPath, priorOffset, fileSize);
        long gap = Math.max(0, fileSize - startOffset);
        return new GapStatus(gap > thresholdBytes, gap, startOffset, fileSize);
    }

    public static boolean shouldEnqueue(String serverDir, Path statePath, ReportConfig config) throws IOException {
        if (config == null || !config.activityGapBackfillEnabled()) {
            return false;
        }
        Path logPath = Path.of(serverDir, "logs", "latest.log");
        JsonObject offset = StateManager.getOpsLogOffset(statePath);
        GapStatus gap = detectGap(logPath, offset, config.activityGapThresholdBytes());
        return gap.needsBackfill();
    }

    /** One async wake — up to {@link #MAX_CHUNKS_PER_WAKE} chunks. */
    public static WakeResult runWake(
            String serverDir,
            Path statePath,
            Path opsCachePath,
            ReportConfig config
    ) throws IOException {
        if (config == null || !config.activityGapBackfillEnabled()) {
            return new WakeResult(0, 0, true);
        }
        Path logPath = Path.of(serverDir, "logs", "latest.log");
        JsonObject offset = StateManager.getOpsLogOffset(statePath);
        GapStatus gap = detectGap(logPath, offset, 0);
        if (gap.gapBytes() <= 0) {
            StateManager.clearActivityBackfillState(statePath);
            return new WakeResult(0, 0, true);
        }

        markBackfillStarted(statePath, logPath, gap);

        long chunkBytes = config.activityGapChunkBytes();
        int tickLag = config.tickLagThrottleMs();
        int chunks = 0;
        int merged = 0;
        boolean complete = false;

        while (chunks < MAX_CHUNKS_PER_WAKE) {
            long fileSize = Files.size(logPath);
            offset = StateManager.getOpsLogOffset(statePath);
            long start = OpsLogTailScanner.resolveStartOffset(logPath, offset, fileSize);
            if (start >= fileSize) {
                complete = true;
                break;
            }
            OpsLogTailScanner.BackfillChunkResult chunk = OpsLogTailScanner.scanBackfillChunk(
                    serverDir, statePath, start, chunkBytes, tickLag);
            chunks++;
            if (!chunk.activityEvents().isEmpty()) {
                OpsCacheWriter.applyActivityBackfillChunk(
                        opsCachePath, statePath, chunk.activityEvents(), chunk.newActivityCount());
                merged += chunk.newActivityCount();
            }
            complete = chunk.complete();
            if (complete) {
                break;
            }
        }

        if (complete) {
            StateManager.clearActivityBackfillState(statePath);
        } else {
            JsonObject progress = StateManager.getActivityBackfillState(statePath);
            if (progress != null) {
                progress.addProperty("events_merged", merged);
                progress.addProperty("last_wake_at", ZonedDateTime.now(ZoneId.systemDefault()).format(ISO));
                StateManager.setActivityBackfillState(statePath, progress);
            }
        }
        return new WakeResult(chunks, merged, complete);
    }

    private static void markBackfillStarted(Path statePath, Path logPath, GapStatus gap) throws IOException {
        JsonObject existing = StateManager.getActivityBackfillState(statePath);
        if (existing != null && existing.has("started_at")) {
            existing.addProperty("gap_bytes", gap.gapBytes());
            existing.addProperty("target_size", gap.fileSize());
            StateManager.setActivityBackfillState(statePath, existing);
            return;
        }
        JsonObject state = new JsonObject();
        state.addProperty("file", logPath.toString());
        state.addProperty("byte_offset", gap.startOffset());
        state.addProperty("target_size", gap.fileSize());
        state.addProperty("gap_bytes", gap.gapBytes());
        state.addProperty("started_at", Instant.now().toString());
        StateManager.setActivityBackfillState(statePath, state);
    }
}
