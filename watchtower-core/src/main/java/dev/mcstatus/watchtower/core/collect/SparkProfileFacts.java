package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonObject;

import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;

/**
 * Field names and freshness helpers for {@code optional.spark_profile}.
 */
public final class SparkProfileFacts {

    public static final String KEY = "spark_profile";

    private static final DateTimeFormatter ISO = DateTimeFormatter.ISO_OFFSET_DATE_TIME;

    private SparkProfileFacts() {
    }

    public static boolean isFresh(JsonObject profile, int freshHours) {
        if (profile == null || freshHours <= 0) {
            return false;
        }
        Instant captured = parseCapturedAt(profile);
        // Clock skew / future timestamps must never count as fresh.
        if (captured != null && captured.isAfter(Instant.now())) {
            return false;
        }
        if (profile.has("fresh")) {
            return profile.get("fresh").getAsBoolean();
        }
        if (captured == null) {
            return false;
        }
        return isFreshInstant(captured, freshHours);
    }

    /**
     * Whether {@code captured} is within {@code freshHours} of now and not in the future.
     */
    public static boolean isFreshInstant(Instant captured, int freshHours) {
        if (captured == null || freshHours <= 0) {
            return false;
        }
        Instant now = Instant.now();
        if (captured.isAfter(now)) {
            return false;
        }
        return Duration.between(captured, now).toHours() < freshHours;
    }

    public static Instant parseCapturedAt(JsonObject profile) {
        if (profile == null || !profile.has("captured_at")) {
            return null;
        }
        try {
            return ZonedDateTime.parse(profile.get("captured_at").getAsString()).toInstant();
        } catch (Exception e) {
            return null;
        }
    }

    public static String formatCapturedAt(Instant instant) {
        return ZonedDateTime.ofInstant(instant, ZoneId.systemDefault()).format(ISO);
    }

    public static boolean isAllocation(JsonObject profile) {
        return profile != null && profile.has("mode")
                && "allocation".equalsIgnoreCase(profile.get("mode").getAsString());
    }
}
