package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonObject;

import java.time.Instant;

/**
 * Lightweight listing row for a {@code .sparkprofile} file on disk.
 */
public record SparkProfileEntry(
        String sourcePath,
        String sourceFile,
        String sourceKind,
        Instant capturedAt,
        Instant mtime,
        long sizeBytes,
        boolean fresh) {

    public JsonObject toJson() {
        JsonObject out = new JsonObject();
        out.addProperty("source_path", sourcePath);
        out.addProperty("source_file", sourceFile);
        out.addProperty("source_kind", sourceKind);
        out.addProperty("captured_at", SparkProfileFacts.formatCapturedAt(capturedAt));
        out.addProperty("mtime", SparkProfileFacts.formatCapturedAt(mtime));
        out.addProperty("size_bytes", sizeBytes);
        out.addProperty("fresh", fresh);
        return out;
    }
}
