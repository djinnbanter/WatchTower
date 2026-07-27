package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonObject;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;

import static org.junit.jupiter.api.Assertions.*;

class SparkProfileFactsTest {

    private static final DateTimeFormatter ISO = DateTimeFormatter.ISO_OFFSET_DATE_TIME;

    @Test
    void isFreshInstant_rejectsFuture() {
        Instant future = Instant.now().plusSeconds(3600);
        assertFalse(SparkProfileFacts.isFreshInstant(future, 24));
    }

    @Test
    void isFreshInstant_acceptsRecent() {
        Instant recent = Instant.now().minusSeconds(60);
        assertTrue(SparkProfileFacts.isFreshInstant(recent, 24));
    }

    @Test
    void isFresh_rejectsFutureEvenWhenFreshFlagTrue() {
        JsonObject profile = new JsonObject();
        profile.addProperty("fresh", true);
        profile.addProperty("captured_at", Instant.now().plusSeconds(7200)
                .atOffset(ZoneOffset.UTC).format(ISO));
        assertFalse(SparkProfileFacts.isFresh(profile, 24));
    }
}
