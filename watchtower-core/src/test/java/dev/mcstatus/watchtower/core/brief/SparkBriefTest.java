package dev.mcstatus.watchtower.core.brief;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class SparkBriefTest {

    @Test
    void freshProfileIncludedInBriefSection() {
        JsonObject facts = new JsonObject();
        JsonObject optional = new JsonObject();
        JsonObject profile = sampleProfile(true);
        optional.add("spark_profile", profile);
        facts.add("optional", optional);

        List<String> lines = BriefFormatters.formatSparkSection(facts, 24);
        assertNotNull(lines);
        assertTrue(lines.stream().anyMatch(l -> l.contains("SPARK PROFILER")));
    }

    @Test
    void staleProfileOmittedFromBriefSection() {
        JsonObject facts = new JsonObject();
        JsonObject optional = new JsonObject();
        JsonObject profile = sampleProfile(false);
        optional.add("spark_profile", profile);
        facts.add("optional", optional);

        assertNull(BriefFormatters.formatSparkSection(facts, 24));
    }

    @Test
    void allocationOneLinerUsesAllocationWording() {
        JsonObject profile = sampleProfile(true);
        profile.addProperty("mode", "allocation");
        JsonArray hints = new JsonArray();
        JsonObject hint = new JsonObject();
        hint.addProperty("mod_id", "create");
        hint.addProperty("pct", 18.0);
        hints.add(hint);
        profile.add("mod_hints", hints);
        JsonObject ctx = new JsonObject();
        ctx.addProperty("tps_1m", 19.0);
        ctx.addProperty("mspt_p95_1m", 45.0);
        profile.add("context", ctx);

        String line = BriefFormatters.formatSparkOneLiner(profile);
        assertNotNull(line);
        assertTrue(line.contains("Allocations:"));
        assertFalse(line.contains("Server thread"));
    }

    private static JsonObject sampleProfile(boolean fresh) {
        JsonObject profile = new JsonObject();
        Instant captured = fresh ? Instant.now() : Instant.now().minusSeconds(48 * 3600);
        profile.addProperty("captured_at", ZonedDateTime.ofInstant(captured, ZoneId.systemDefault())
                .format(DateTimeFormatter.ISO_OFFSET_DATE_TIME));
        profile.addProperty("fresh", fresh);
        JsonObject verdict = new JsonObject();
        verdict.addProperty("headline", "test mod dominated");
        verdict.addProperty("summary", "TPS 10.0 · MSPT p95 121ms");
        profile.add("verdict", verdict);
        return profile;
    }
}
