package dev.mcstatus.watchtower.core;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.analyze.ReportPipeline;
import dev.mcstatus.watchtower.core.brief.TimelineRanker;
import dev.mcstatus.watchtower.core.collect.CollectSupport;
import dev.mcstatus.watchtower.core.collect.CrashReportScanner;
import dev.mcstatus.watchtower.core.collect.LogPatterns;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.regex.Matcher;

import static org.junit.jupiter.api.Assertions.*;

class ValidatePocTest {

    private record PipelineResult(JsonObject facts, String brief) {}

    private static PipelineResult runPipeline(JsonObject staging) {
        JsonObject facts = ReportPipeline.buildFacts(staging);
        String brief = ReportPipeline.writeBrief(facts);
        return new PipelineResult(facts, brief);
    }

    @Test
    void panelIncident() {
        JsonObject staging = baseStaging();
        staging.getAsJsonObject("flags").addProperty("java_running", false);
        staging.getAsJsonObject("flags").addProperty("panel_running", false);
        staging.addProperty("health_log_gap_minutes", 380);
        JsonObject dh = new JsonObject();
        JsonObject first = new JsonObject();
        first.addProperty("chunks", 650.0);
        first.addProperty("total", 3126);
        first.addProperty("cps", 31);
        first.addProperty("time", "2026-06-16T00:00:00+01:00");
        JsonObject last = new JsonObject();
        last.addProperty("chunks", 680.7);
        last.addProperty("total", 3126);
        last.addProperty("cps", 31);
        last.addProperty("time", "2026-06-16T02:08:54+01:00");
        dh.add("first", first);
        dh.add("last", last);
        dh.addProperty("cps_avg", 31.0);
        staging.getAsJsonObject("optional").add("dh_pregen", dh);

        String brief = runPipeline(staging).brief();
        assertTrue(brief.contains("CRITICAL"));
        assertTrue(brief.contains("NOT RUNNING"));
        assertTrue(brief.contains("TL;DR"));
        assertTrue(brief.contains("DH pregen"));
        assertTrue(brief.contains("680.7"));
        assertTrue(brief.contains("NOTABLE TIMELINE"));
    }

    @Test
    void recoveredServer() {
        JsonObject staging = baseStaging();
        staging.getAsJsonObject("flags").addProperty("java_running", true);
        JsonObject mc = staging.getAsJsonObject("minecraft");
        mc.addProperty("clean_shutdown_seen", true);
        mc.addProperty("last_log_time", ZonedDateTime.now().format(java.time.format.DateTimeFormatter.ISO_OFFSET_DATE_TIME));
        mc.addProperty("server_started", "2026-06-16T08:55:00+01:00");
        JsonArray crashes = new JsonArray();
        JsonObject crash = new JsonObject();
        crash.addProperty("file", "crash-old.txt");
        crash.addProperty("time", "2026-06-15T21:00:00+01:00");
        crash.addProperty("quote", "---- Minecraft Crash Report ----");
        crashes.add(crash);
        mc.add("new_crash_reports", crashes);

        JsonObject dh = new JsonObject();
        dh.addProperty("pregen_paused", true);
        dh.addProperty("pregen_active", false);
        dh.addProperty("hours_since_last", 0.5);
        JsonObject last = new JsonObject();
        last.addProperty("chunks", 681);
        last.addProperty("total", 3126);
        last.addProperty("cps", 29);
        last.addProperty("time", "2026-06-16T08:55:00+01:00");
        dh.add("last", last);
        staging.getAsJsonObject("optional").add("dh_pregen", dh);

        PipelineResult r = runPipeline(staging);
        assertEquals("ok", r.facts().getAsJsonObject("health").get("current_status").getAsString());
        assertTrue(r.brief().contains("Now: OK"));
        assertTrue(r.brief().contains("HISTORICAL"));
        assertFalse(r.brief().contains("3 GB"));
        assertFalse(r.brief().contains("JAVA_HEAP_HIGH"));
    }

    @Test
    void memLowAlert() {
        JsonObject staging = baseStaging();
        staging.getAsJsonObject("system").addProperty("mem_available_gb", 1.5);
        staging.getAsJsonObject("system").addProperty("java_rss_gb", 23);
        staging.getAsJsonObject("system").addProperty("java_xmx_gb", 20);
        PipelineResult r = runPipeline(staging);
        boolean memLow = false;
        for (var el : r.facts().getAsJsonArray("issues")) {
            if ("MEM_LOW".equals(el.getAsJsonObject().get("id").getAsString())) {
                memLow = true;
            }
        }
        assertTrue(memLow);
        assertTrue(r.brief().contains("off-heap"));
    }

    @Test
    void playerJoinRegex() {
        String line = "[15Jun2026 22:38:26.278] [Server thread/INFO] "
                + "[net.minecraft.server.MinecraftServer/]: TESTPLAYER joined the game";
        Matcher m = LogPatterns.PLAYER_JOIN.matcher(line);
        assertTrue(m.find());
        assertEquals("TESTPLAYER", m.group(1));
    }

    @Test
    void timelineChronological() {
        JsonArray events = new JsonArray();
        events.add(event("2026-06-16T10:47:44+01:00", "session_close", "ssh"));
        events.add(event("2026-06-16T10:30:58+01:00", "panel_command", "pregen"));
        events.add(event("2026-06-16T08:56:28+01:00", "server_start", "start"));
        events.add(event("2026-06-16T08:28:35+01:00", "reboot", "reboot now"));
        events.add(event("2026-06-16T08:28:35+01:00", "reboot", "rebooting"));
        events.add(event("2026-06-15T22:19:23+01:00", "crash_report", "crash-b"));
        events.add(event("2026-06-15T21:36:38+01:00", "crash_report", "crash-a"));

        List<JsonObject> ranked = TimelineRanker.rankedTimeline(events);
        double prev = Double.MAX_VALUE;
        for (JsonObject e : ranked) {
            double t = dev.mcstatus.watchtower.core.util.TimeParse.timeSortKey(
                    e.get("time").getAsString());
            assertTrue(t <= prev);
            prev = t;
        }
        assertEquals("session_close", ranked.get(0).get("type").getAsString());
        long crashCount = ranked.stream().filter(e -> "crash_report".equals(e.get("type").getAsString())).count();
        assertEquals(2, crashCount);
        long rebootCount = ranked.stream().filter(e -> "reboot".equals(e.get("type").getAsString())).count();
        assertEquals(1, rebootCount);
    }

    @Test
    void pregenPctParse() {
        String line = "[16Jun2026 10:49:33.770] [DH-World Gen Thread[1]/INFO] "
                + "[DistantHorizons/]: Generated radius: 687.55 / 3126 chunks (33 cps, 4.838%), ETA: 311h 53m 32s";
        Matcher m = LogPatterns.PREGEN.matcher(line);
        assertTrue(m.find());
        assertEquals(687.55, Double.parseDouble(m.group(1)), 0.01);
        assertEquals("4.838", m.group(4));
        assertTrue(m.group(5).contains("311h 53m 32s"));
    }

    @Test
    void pregenMeaningful() {
        JsonObject low = new JsonObject();
        low.addProperty("chunks", 2);
        low.addProperty("cps", 0);
        assertFalse(CollectSupport.pregenMeaningful(low));
        JsonObject high = new JsonObject();
        high.addProperty("chunks", 50);
        high.addProperty("cps", 0);
        assertTrue(CollectSupport.pregenMeaningful(high));
    }

    @Test
    void parseJvmHeap() {
        String text = "# comment\n-Xms20G -Xmx20G\n";
        var heap = CollectSupport.parseJvmHeapGb(text);
        assertEquals(20.0, heap[0], 0.01);
        assertEquals(20.0, heap[1], 0.01);
    }

    @Test
    void crashSummary() {
        String sample = """
                ---- Minecraft Crash Report ----
                // Surprise! Haha. Well, this is awkward.

                Time: 6/15/26 9:36 PM
                Description: Exception in server tick loop

                java.lang.NullPointerException: Cannot invoke ...
                """;
        String summary = CrashReportScanner.parseCrashSummary(sample);
        assertNotNull(summary);
        assertTrue(summary.contains("NullPointerException") || summary.contains("server tick"));
    }

    static JsonObject baseStagingPublic() {
        return baseStaging();
    }

    private static JsonObject baseStaging() {
        JsonObject staging = new JsonObject();
        JsonObject meta = new JsonObject();
        meta.addProperty("lookback_hours", 24);
        meta.addProperty("incremental", false);
        meta.addProperty("panel", "crafty");
        meta.addProperty("loader", "neoforge");
        staging.add("meta", meta);
        JsonObject flags = new JsonObject();
        flags.addProperty("java_running", true);
        flags.addProperty("panel_running", true);
        staging.add("flags", flags);
        JsonObject thresholds = new JsonObject();
        thresholds.addProperty("disk_warn_pct", 85);
        thresholds.addProperty("mem_warn_avail_gb", 2);
        thresholds.addProperty("log_stale_minutes", 15);
        thresholds.addProperty("cant_keep_up_warn", 5);
        staging.add("thresholds", thresholds);
        JsonObject system = new JsonObject();
        system.addProperty("uptime_seconds", 5000);
        system.addProperty("mem_available_gb", 10);
        system.addProperty("disk_use_pct", 5);
        staging.add("system", system);
        staging.add("events", new JsonArray());
        JsonObject mc = new JsonObject();
        mc.addProperty("log_had_activity_in_window", true);
        mc.addProperty("last_log_time", ZonedDateTime.now().format(java.time.format.DateTimeFormatter.ISO_OFFSET_DATE_TIME));
        mc.addProperty("cant_keep_up_count", 0);
        mc.add("new_crash_reports", new JsonArray());
        mc.addProperty("oom_in_logs", false);
        mc.add("tick_lag_evidence", new JsonArray());
        mc.add("oom_evidence", new JsonArray());
        staging.add("minecraft", mc);
        staging.addProperty("health_log_gap_minutes", 1);
        staging.add("kernel_oom_evidence", new JsonArray());
        staging.add("optional", new JsonObject());
        return staging;
    }

    private static JsonObject event(String time, String type, String detail) {
        JsonObject e = new JsonObject();
        e.addProperty("time", time);
        e.addProperty("type", type);
        e.addProperty("detail", detail);
        return e;
    }
}
