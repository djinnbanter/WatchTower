package dev.mcstatus.watchtower.core.collect;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import dev.mcstatus.watchtower.core.report.ReportConfig;
import dev.mcstatus.watchtower.core.util.TimeParse;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

/**
 * Reads and writes external backup heartbeat markers for off-disk backup providers.
 */
public final class ExternalBackupDetector {

    public static final String DEFAULT_MARKER_REL = "watchtower/backup-heartbeat.json";

    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    private static final DateTimeFormatter ISO = DateTimeFormatter.ISO_OFFSET_DATE_TIME;

    private ExternalBackupDetector() {
    }

    public static boolean isConfigured(ReportConfig config) {
        if (config == null) {
            return false;
        }
        return config.isExternalBackupConfigured();
    }

    public static Path resolveMarkerPath(String serverDir, ReportConfig config) {
        String rel = config != null ? config.backupExternalMarker() : "";
        if (rel == null || rel.isBlank()) {
            return null;
        }
        Path p = Path.of(rel);
        if (p.isAbsolute()) {
            return p.normalize();
        }
        if (serverDir == null || serverDir.isBlank()) {
            return p.normalize();
        }
        return Path.of(serverDir, rel).normalize();
    }

    public static JsonObject readForReport(String serverDir, ReportConfig config) {
        return read(serverDir, config, "file");
    }

    public static JsonObject read(String serverDir, ReportConfig config, String via) {
        if (!isConfigured(config)) {
            return notConfiguredBlock();
        }
        Path markerPath = resolveMarkerPath(serverDir, config);
        if (markerPath == null) {
            if (config.backupWebhookToken() != null && !config.backupWebhookToken().isBlank()) {
                return missingBlock(null, via, config.backupWarnDays());
            }
            return notConfiguredBlock();
        }
        return readMarker(markerPath, config.backupWarnDays(), via);
    }

    public static JsonObject readMarker(Path markerPath, int warnDays, String via) {
        ZonedDateTime now = ZonedDateTime.now(ZoneId.systemDefault());
        JsonObject block = new JsonObject();
        block.addProperty("configured", true);
        block.addProperty("via", via != null ? via : "file");
        if (markerPath != null) {
            block.addProperty("marker_path", markerPath.toString());
        }
        block.addProperty("received_at", now.format(ISO));

        if (markerPath == null || !Files.isRegularFile(markerPath)) {
            applyStatus(block, "missing", warnDays, null, now);
            return block;
        }

        try {
            String raw = Files.readString(markerPath, StandardCharsets.UTF_8);
            JsonObject payload = JsonParser.parseString(raw).getAsJsonObject();
            return normalizePayload(payload, markerPath, warnDays, via, now);
        } catch (Exception e) {
            JsonObject err = new JsonObject();
            err.addProperty("configured", true);
            err.addProperty("via", via != null ? via : "file");
            err.addProperty("marker_path", markerPath.toString());
            err.addProperty("received_at", now.format(ISO));
            err.addProperty("status", "missing");
            err.addProperty("detail", "Could not read heartbeat file: " + safeMessage(e));
            err.addProperty("stale", true);
            return err;
        }
    }

    public static JsonObject normalizePayload(
            JsonObject payload,
            Path markerPath,
            int warnDays,
            String via,
            ZonedDateTime receivedAt
    ) {
        JsonObject block = new JsonObject();
        block.addProperty("configured", true);
        block.addProperty("via", via != null ? via : "file");
        if (markerPath != null) {
            block.addProperty("marker_path", markerPath.toString());
        }
        block.addProperty("received_at", receivedAt.format(ISO));

        String lastAt = str(payload, "last_at");
        if (lastAt != null) {
            block.addProperty("last_at", lastAt);
        }
        String source = str(payload, "source");
        if (source != null) {
            block.addProperty("source", source);
        }
        String detail = str(payload, "detail");
        if (detail != null) {
            block.addProperty("detail", detail);
        }
        String remoteUri = str(payload, "remote_uri");
        if (remoteUri != null) {
            block.addProperty("remote_uri", remoteUri);
        }
        Double sizeGb = jsonDouble(payload, "size_gb");
        if (sizeGb != null) {
            block.addProperty("size_gb", sizeGb);
        }

        String markerStatus = str(payload, "status");
        if (markerStatus == null || markerStatus.isBlank()) {
            markerStatus = lastAt != null ? "success" : "missing";
        }
        markerStatus = markerStatus.toLowerCase(Locale.ROOT);

        if ("running".equals(markerStatus)) {
            block.addProperty("status", "running");
            block.addProperty("stale", false);
            return block;
        }
        if ("failed".equals(markerStatus)) {
            block.addProperty("status", "failed");
            block.addProperty("stale", true);
            return block;
        }
        if (lastAt == null) {
            applyStatus(block, "missing", warnDays, null, receivedAt);
            return block;
        }

        Instant instant = TimeParse.parseTime(lastAt);
        if (instant == null) {
            block.addProperty("status", "missing");
            block.addProperty("detail", detail != null ? detail : "Invalid last_at in heartbeat");
            block.addProperty("stale", true);
            return block;
        }

        applyStatus(block, "success", warnDays, instant, receivedAt);
        if ("failed".equals(markerStatus)) {
            block.addProperty("status", "failed");
            block.addProperty("stale", true);
        }
        return block;
    }

    public static void writeMarker(Path markerPath, JsonObject payload) throws IOException {
        if (markerPath == null) {
            throw new IOException("marker path required");
        }
        Path parent = markerPath.getParent();
        if (parent != null) {
            Files.createDirectories(parent);
        }
        Path tmp = markerPath.resolveSibling(markerPath.getFileName().toString() + ".tmp");
        Files.writeString(tmp, GSON.toJson(payload), StandardCharsets.UTF_8);
        Files.move(tmp, markerPath, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
    }

    public static JsonObject buildHeartbeatPayload(JsonObject body, ZonedDateTime now) {
        JsonObject payload = new JsonObject();
        String lastAt = str(body, "last_at");
        if (lastAt == null || lastAt.isBlank()) {
            payload.addProperty("last_at", now.format(ISO));
        } else {
            payload.addProperty("last_at", lastAt);
        }
        copyIfPresent(body, payload, "source");
        copyIfPresent(body, payload, "status");
        copyIfPresent(body, payload, "detail");
        copyIfPresent(body, payload, "remote_uri");
        if (body.has("size_gb") && !body.get("size_gb").isJsonNull()) {
            payload.add("size_gb", body.get("size_gb"));
        }
        return payload;
    }

    private static void applyStatus(
            JsonObject block,
            String baseStatus,
            int warnDays,
            Instant lastAt,
            ZonedDateTime receivedAt
    ) {
        if (lastAt == null) {
            block.addProperty("status", baseStatus);
            block.addProperty("stale", !"success".equals(baseStatus) && !"running".equals(baseStatus));
            return;
        }
        double ageDays = Duration.between(lastAt, receivedAt.toInstant()).toMillis() / 86_400_000.0;
        double ageHours = Duration.between(lastAt, receivedAt.toInstant()).toMillis() / 3_600_000.0;
        block.addProperty("age_days", Math.round(ageDays * 10.0) / 10.0);
        block.addProperty("age_hours", Math.round(ageHours * 10.0) / 10.0);
        boolean stale = ageDays > warnDays;
        block.addProperty("stale", stale);
        if ("success".equals(baseStatus) && stale) {
            block.addProperty("status", "stale");
        } else {
            block.addProperty("status", baseStatus);
        }
    }

    private static JsonObject notConfiguredBlock() {
        JsonObject block = new JsonObject();
        block.addProperty("configured", false);
        block.addProperty("status", "unconfigured");
        return block;
    }

    private static JsonObject missingBlock(Path markerPath, String via, int warnDays) {
        ZonedDateTime now = ZonedDateTime.now(ZoneId.systemDefault());
        JsonObject block = new JsonObject();
        block.addProperty("configured", true);
        block.addProperty("via", via != null ? via : "file");
        if (markerPath != null) {
            block.addProperty("marker_path", markerPath.toString());
        }
        block.addProperty("received_at", now.format(ISO));
        applyStatus(block, "missing", warnDays, null, now);
        return block;
    }

    private static void copyIfPresent(JsonObject from, JsonObject to, String key) {
        if (from.has(key) && !from.get(key).isJsonNull()) {
            to.add(key, from.get(key));
        }
    }

    private static String str(JsonObject o, String key) {
        if (o == null || !o.has(key) || o.get(key).isJsonNull()) {
            return null;
        }
        return o.get(key).getAsString();
    }

    private static Double jsonDouble(JsonObject o, String key) {
        if (o == null || !o.has(key) || o.get(key).isJsonNull()) {
            return null;
        }
        return o.get(key).getAsDouble();
    }

    private static String safeMessage(Exception e) {
        return e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName();
    }
}
