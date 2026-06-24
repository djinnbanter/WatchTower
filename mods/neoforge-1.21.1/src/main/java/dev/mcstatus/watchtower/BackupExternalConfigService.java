package dev.mcstatus.watchtower;

import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.collect.ExternalBackupDetector;
import dev.mcstatus.watchtower.core.report.ReportConfig;

import java.io.IOException;
import java.nio.file.Path;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.Locale;
import java.util.Map;

/**
 * Persists external backup tracking settings in watchtower.conf.
 */
public final class BackupExternalConfigService {

    public static final String KEY_MARKER = "BACKUP_EXTERNAL_MARKER";
    public static final String KEY_WEBHOOK_TOKEN = "BACKUP_WEBHOOK_TOKEN";
    public static final String KEY_SUPPRESS_LOCAL_MISSING = "BACKUP_SUPPRESS_LOCAL_MISSING";

    public static final String MODE_OFF = "off";
    public static final String MODE_WEBHOOK = "webhook";
    public static final String MODE_MARKER = "marker";
    public static final String MODE_BOTH = "both";

    private static final SecureRandom RANDOM = new SecureRandom();

    private BackupExternalConfigService() {
    }

    public record ApplyResult(String generatedToken) {
        public boolean hasGeneratedToken() {
            return generatedToken != null && !generatedToken.isBlank();
        }
    }

    public static String deriveTrackingMode(ReportConfig config) {
        if (config == null) {
            return MODE_OFF;
        }
        boolean webhook = config.backupWebhookToken() != null && !config.backupWebhookToken().isBlank();
        boolean marker = config.backupExternalMarker() != null && !config.backupExternalMarker().isBlank();
        if (!webhook && !marker) {
            return MODE_OFF;
        }
        if (webhook && marker) {
            return MODE_BOTH;
        }
        if (webhook) {
            return MODE_WEBHOOK;
        }
        return MODE_MARKER;
    }

    public static String generateWebhookToken() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    public static ApplyResult apply(Path conf, JsonObject json) throws IOException {
        String generated = null;

        if (json.has("trackingMode") && !json.get("trackingMode").isJsonNull()) {
            String mode = json.get("trackingMode").getAsString().trim().toLowerCase(Locale.ROOT);
            switch (mode) {
                case MODE_OFF -> {
                    WatchtowerConfWriter.upsertKey(conf, KEY_MARKER, "");
                    WatchtowerConfWriter.upsertKey(conf, KEY_WEBHOOK_TOKEN, "");
                }
                case MODE_WEBHOOK -> {
                    WatchtowerConfWriter.upsertKey(conf, KEY_MARKER, "");
                    generated = applyWebhookToken(conf, json);
                }
                case MODE_MARKER -> {
                    WatchtowerConfWriter.upsertKey(conf, KEY_WEBHOOK_TOKEN, "");
                    WatchtowerConfWriter.upsertKey(conf, KEY_MARKER, resolveMarkerFromJson(json));
                }
                case MODE_BOTH -> {
                    WatchtowerConfWriter.upsertKey(conf, KEY_MARKER, resolveMarkerFromJson(json));
                    generated = applyWebhookToken(conf, json);
                }
                default -> throw new IllegalArgumentException("Invalid trackingMode: " + mode);
            }
        }

        if (json.has("backupExternalMarker") && !json.get("backupExternalMarker").isJsonNull()
                && (!json.has("trackingMode") || json.get("trackingMode").isJsonNull())) {
            WatchtowerConfWriter.upsertKey(conf, KEY_MARKER, json.get("backupExternalMarker").getAsString().strip());
        }

        if (json.has("backupSuppressLocalMissing") && !json.get("backupSuppressLocalMissing").isJsonNull()) {
            boolean suppress = json.get("backupSuppressLocalMissing").getAsBoolean();
            WatchtowerConfWriter.upsertKey(conf, KEY_SUPPRESS_LOCAL_MISSING, suppress ? "true" : "false");
        }

        if (json.has("generateWebhookToken") && !json.get("generateWebhookToken").isJsonNull()
                && json.get("generateWebhookToken").getAsBoolean()
                && (!json.has("trackingMode") || json.get("trackingMode").isJsonNull())) {
            generated = generateWebhookToken();
            WatchtowerConfWriter.upsertKey(conf, KEY_WEBHOOK_TOKEN, generated);
        }

        if (json.has("clearWebhookToken") && !json.get("clearWebhookToken").isJsonNull()
                && json.get("clearWebhookToken").getAsBoolean()
                && (!json.has("trackingMode") || json.get("trackingMode").isJsonNull())) {
            WatchtowerConfWriter.upsertKey(conf, KEY_WEBHOOK_TOKEN, "");
        }

        return new ApplyResult(generated);
    }

    private static String applyWebhookToken(Path conf, JsonObject json) throws IOException {
        if (json.has("clearWebhookToken") && !json.get("clearWebhookToken").isJsonNull()
                && json.get("clearWebhookToken").getAsBoolean()) {
            WatchtowerConfWriter.upsertKey(conf, KEY_WEBHOOK_TOKEN, "");
            return null;
        }
        if (shouldGenerateToken(json, conf)) {
            String generated = generateWebhookToken();
            WatchtowerConfWriter.upsertKey(conf, KEY_WEBHOOK_TOKEN, generated);
            return generated;
        }
        return null;
    }

    private static boolean shouldGenerateToken(JsonObject json, Path conf) throws IOException {
        if (json.has("generateWebhookToken") && !json.get("generateWebhookToken").isJsonNull()
                && json.get("generateWebhookToken").getAsBoolean()) {
            return true;
        }
        Map<String, String> map = WatchtowerConfWriter.readMap(conf);
        String existing = map.getOrDefault(KEY_WEBHOOK_TOKEN, "");
        return existing == null || existing.isBlank();
    }

    private static String resolveMarkerFromJson(JsonObject json) {
        if (json.has("backupExternalMarker") && !json.get("backupExternalMarker").isJsonNull()) {
            String marker = json.get("backupExternalMarker").getAsString().strip();
            if (!marker.isEmpty()) {
                return marker;
            }
        }
        return ExternalBackupDetector.DEFAULT_MARKER_REL;
    }
}
