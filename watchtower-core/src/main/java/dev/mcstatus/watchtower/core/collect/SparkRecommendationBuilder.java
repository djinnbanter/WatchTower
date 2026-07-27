package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.analyze.ServerPropertiesAdvisor;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Rule-based recommendations and key findings for Spark profiler reports.
 *
 * <p>User-facing copy targets casual Minecraft server owners: lead with what was seen,
 * what to check next, and what the profile cannot prove. Avoid profiler jargon
 * (exclusive own share, selected root, involvement) in titles and primary details.
 * Never claim a single root cause or promise a percent improvement.
 */
public final class SparkRecommendationBuilder {

    private SparkRecommendationBuilder() {
    }

    public static void enrich(JsonObject profile) {
        if (profile == null) {
            return;
        }
        boolean allocation = SparkProfileFacts.isAllocation(profile);
        List<JsonObject> findings = new ArrayList<>();
        List<JsonObject> recommendations = new ArrayList<>();

        JsonObject ctx = profile.has("context") ? profile.getAsJsonObject("context") : new JsonObject();
        Double tps = number(ctx, "tps_1m");
        Double mspt = number(ctx, "mspt_p95_1m");
        Integer players = integer(ctx, "players");
        Integer entities = integer(ctx, "world_entities");

        findings.add(richFinding(
                "spark.capture.mode",
                "capture_mode",
                "info",
                "observed",
                allocation ? "Memory allocation profile" : "CPU time profile",
                allocation
                        ? "Percentages show where memory was allocated during the capture — not how long each tick took."
                        : "Percentages show how often Spark saw each piece of code on the main Server thread during the capture — not every millisecond of the whole machine.",
                List.of(evidence("mode", allocation ? "allocation" : "execution", null, "sampler_metadata")),
                List.of("A profile only covers the time window that was recorded.")));

        if (!allocation && (tps != null || mspt != null)) {
            Double msptMean = number(ctx, "mspt_mean_1m");
            Double msptMax1m = number(ctx, "mspt_max_1m");
            Double msptMax5m = number(ctx, "mspt_max_5m");
            String severity = (tps != null && tps < 12) || (mspt != null && mspt > 100)
                    || (msptMax5m != null && msptMax5m >= 1000)
                    ? "critical"
                    : ((tps != null && tps < 17) || (mspt != null && mspt > 60)
                    || (msptMax5m != null && msptMax5m >= 250) ? "warn" : "info");
            List<JsonObject> evidence = new ArrayList<>();
            if (tps != null) {
                evidence.add(evidence("tps_1m", tps, "ticks_per_second", "platform_statistics"));
            }
            if (msptMean != null) {
                evidence.add(evidence("mspt_mean_1m", msptMean, "milliseconds", "platform_statistics"));
            }
            if (mspt != null) {
                evidence.add(evidence("mspt_p95_1m", mspt, "milliseconds", "platform_statistics"));
            }
            if (msptMax1m != null) {
                evidence.add(evidence("mspt_max_1m", msptMax1m, "milliseconds", "platform_statistics"));
            }
            if (msptMax5m != null) {
                evidence.add(evidence("mspt_max_5m", msptMax5m, "milliseconds", "platform_statistics"));
            }
            String tickTitle = "info".equals(severity)
                    ? "Tick speed looked healthy during the capture"
                    : "critical".equals(severity)
                    ? "Your server was running slow"
                    : "Your server was lagging";
            findings.add(richFinding(
                    "spark.tick.health",
                    "tick_health",
                    severity,
                    "observed",
                    tickTitle,
                    plainTickSummary(tps, msptMean, mspt, msptMax1m, msptMax5m),
                    evidence,
                    List.of("These numbers describe the capture window. They do not name a single cause.")));
            // No blanket “change a setting” recommendation here — config advice is evidence-driven below.
        }

        addHighInvolvementFinding(profile, findings);

        // Entity composition / hotspots replace the old world_entities > 5000 gate.
        addEntityEvidence(profile, findings, recommendations);
        addCreatePresenceFinding(profile, findings);
        addDatapackContext(profile, findings);
        addSmartModRecommendation(profile, findings, recommendations);

        if (players != null && players >= 0 && (tps != null || mspt != null)) {
            findings.add(richFinding(
                    "spark.context.players",
                    "player_context",
                    "info",
                    "contextual",
                    "Players online during the capture",
                    players + " players were online when these stats were collected.",
                    List.of(evidence("players", players, "players", "platform_statistics")),
                    List.of("Player count alone does not say where they were or what they were doing.")));
        }

        addCaptureQuality(profile, findings);
        addTimelineEvidence(profile, findings);
        addIdleCapacity(profile, findings);
        addUnresolvedAttribution(profile, findings);
        addSystemEvidence(profile, findings, recommendations, tps, mspt);
        addConfigContext(profile, findings, recommendations);
        addSmartConfigRecommendation(profile, findings, recommendations, tps, mspt);

        recommendations.add(prioritizedRecommendation(
                "spark.capture.repeat",
                "info",
                "workflow",
                "observed",
                10,
                allocation ? "Also take a normal CPU-time profile" : "Profile again under the same kind of play",
                allocation
                        ? "A normal CPU-time profile shows tick lag that a memory-allocation profile cannot."
                        : "After one focused change, run another capture under the same kind of load to see if the same signals remain.",
                "Useful as a follow-up after a concrete change — not the first move when the profile already points somewhere.",
                List.of(evidence("mode", allocation ? "allocation" : "execution", null, "sampler_metadata")),
                List.of("Compare captures only when player activity and server setup are similar."),
                List.of(
                        "/spark profiler start",
                        "Wait 30–60 seconds while the lag is happening",
                        "/spark profiler stop --save-to-file"),
                null,
                null));

        List<JsonObject> ranked = finalizeRecommendations(recommendations);
        JsonArray findingsArr = new JsonArray();
        findings.forEach(findingsArr::add);
        JsonArray recsArr = new JsonArray();
        ranked.forEach(recsArr::add);
        profile.add("key_findings", findingsArr);
        profile.add("recommendations", recsArr);
        profile.add("evidence_summary", evidenceSummary(profile, findings, ranked));
        ServerPropertiesAdvisor.attachToProfile(profile);
    }

    private static void addCaptureQuality(JsonObject profile, List<JsonObject> findings) {
        JsonObject window = object(profile, "window");
        Double duration = number(window, "duration_sec");
        if (duration != null && duration < 30) {
            findings.add(richFinding(
                    "spark.quality.short_capture",
                    "capture_quality",
                    "warn",
                    "observed",
                    "This profile was very short",
                    String.format(Locale.US, "The profiler only ran for %.1f seconds.", duration),
                    List.of(evidence("duration_sec", duration, "seconds", "window")),
                    List.of("Short captures can miss the real lag pattern or over-focus on one brief spike.")));
        }
        if (profile.has("fresh") && !profile.get("fresh").getAsBoolean()) {
            findings.add(richFinding(
                    "spark.quality.stale_capture",
                    "capture_quality",
                    "info",
                    "observed",
                    "This profile is old",
                    "Treat it as history. Capture again before trusting a fix.",
                    List.of(evidence("fresh", false, null, "profile")),
                    List.of("Mods, settings, players, and hardware may have changed since then.")));
        }
        JsonObject settings = object(object(profile, "capture"), "profiler_settings");
        Double threshold = number(settings, "tick_length_threshold");
        Integer includedTicks = integer(settings, "included_ticks");
        if (threshold != null && threshold > 0) {
            List<JsonObject> evidence = new ArrayList<>();
            evidence.add(evidence("tick_length_threshold", threshold, "milliseconds", "capture.profiler_settings"));
            if (includedTicks != null) {
                evidence.add(evidence("included_ticks", includedTicks, "ticks", "capture.profiler_settings"));
            }
            findings.add(richFinding(
                    "spark.quality.tick_filtered",
                    "capture_quality",
                    "info",
                    "observed",
                    "This capture only includes slow ticks",
                    "The percentages are for those slow ticks — not normal smooth play.",
                    evidence,
                    List.of("Useful for explaining spikes, but not a normal-load baseline.")));
        }
    }

    private static void addTimelineEvidence(JsonObject profile, List<JsonObject> findings) {
        if (!profile.has("timeline") || !profile.get("timeline").isJsonArray()) {
            return;
        }
        JsonArray timeline = profile.getAsJsonArray("timeline");
        if (timeline.isEmpty()) {
            return;
        }
        JsonObject context = object(profile, "context");
        double targetTps = number(context, "target_tps") != null ? number(context, "target_tps") : 20d;
        double targetMspt = number(context, "target_mspt") != null ? number(context, "target_mspt") : 50d;
        int breached = 0;
        int worstIndex = -1;
        double worstMspt = -1;
        double minEntities = Double.POSITIVE_INFINITY;
        double maxEntities = Double.NEGATIVE_INFINITY;
        int maxEntitiesIndex = -1;
        double minChunks = Double.POSITIVE_INFINITY;
        double maxChunks = Double.NEGATIVE_INFINITY;
        int maxChunksIndex = -1;
        for (int i = 0; i < timeline.size(); i++) {
            JsonObject row = timeline.get(i).getAsJsonObject();
            Double tps = number(row, "tps");
            Double mspt = number(row, "mspt_max");
            if ((tps != null && tps < targetTps - 0.5) || (mspt != null && mspt > targetMspt)) {
                breached++;
            }
            if (mspt != null && mspt > worstMspt) {
                worstMspt = mspt;
                worstIndex = i;
            }
            Double entities = number(row, "entities");
            if (entities != null) {
                minEntities = Math.min(minEntities, entities);
                if (entities > maxEntities) {
                    maxEntities = entities;
                    maxEntitiesIndex = i;
                }
            }
            Double chunks = number(row, "chunks");
            if (chunks != null) {
                minChunks = Math.min(minChunks, chunks);
                if (chunks > maxChunks) {
                    maxChunks = chunks;
                    maxChunksIndex = i;
                }
            }
        }
        if (breached > 0) {
            boolean sustained = timeline.size() > 1 && breached > 1 && breached * 2 > timeline.size();
            findings.add(richFinding(
                    sustained ? "spark.timeline.sustained_lag" : "spark.timeline.isolated_lag",
                    "timeline",
                    sustained ? "warn" : "info",
                    "observed",
                    sustained ? "Lag lasted through most of the capture" : "Lag only showed up in part of the capture",
                    breached + " of " + timeline.size() + " one-minute slices missed the target tick speed.",
                    List.of(
                            evidence("breached_windows", breached, "windows", "timeline"),
                            evidence("total_windows", timeline.size(), "windows", "timeline")),
                    List.of("One-minute slices can hide shorter spikes inside that minute.")));
        }
        if (timeline.size() >= 2 && worstIndex >= 0) {
            if (maxEntitiesIndex == worstIndex && maxEntities - minEntities >= Math.max(100, minEntities * 0.10)) {
                findings.add(alignedWorkloadFinding("entities", worstIndex, maxEntities, worstMspt));
            }
            if (maxChunksIndex == worstIndex && maxChunks - minChunks >= Math.max(100, minChunks * 0.10)) {
                findings.add(alignedWorkloadFinding("chunks", worstIndex, maxChunks, worstMspt));
            }
        }
    }

    private static JsonObject alignedWorkloadFinding(
            String metric, int windowIndex, double value, double mspt) {
        String label = "entities".equals(metric) ? "Loaded entities" : "Loaded chunks";
        return richFinding(
                "spark.timeline." + metric + "_aligned",
                "workload_alignment",
                "info",
                "correlated",
                label + " peaked in the slowest minute",
                String.format(Locale.US, "Minute %d had %.0f %s and a worst tick of %.1f ms.",
                        windowIndex + 1, value, metric, mspt),
                List.of(
                        evidence(metric, value, metric, "timeline[" + windowIndex + "]"),
                        evidence("mspt_max", mspt, "milliseconds", "timeline[" + windowIndex + "]")),
                List.of("Happening at the same time is a clue — not proof this made the server lag."));
    }

    private static void addIdleCapacity(JsonObject profile, List<JsonObject> findings) {
        if (!profile.has("source_rollups") || !profile.get("source_rollups").isJsonArray()) {
            return;
        }
        double idleOwn = 0;
        for (JsonElement element : profile.getAsJsonArray("source_rollups")) {
            if (!element.isJsonObject()) {
                continue;
            }
            JsonObject row = element.getAsJsonObject();
            String id = str(row, "mod_id");
            if ("jvm".equals(id)) {
                idleOwn += ownPct(row);
            }
        }
        if (idleOwn >= 20) {
            findings.add(richFinding(
                    "spark.capacity.idle_share",
                    "idle_capacity",
                    "info",
                    "observed",
                    "A sizable share of samples looked like JVM waits",
                    String.format(Locale.US,
                            "About %.1f%% of measured time was JVM/runtime work, including waits and sleeps.",
                            idleOwn),
                    List.of(evidence("own_pct", idleOwn, "percent", "source_rollups.jvm")),
                    List.of("This is not pure idle time — some JVM work is still real work.")));
        }
    }

    private static void addEntityEvidence(
            JsonObject profile,
            List<JsonObject> findings,
            List<JsonObject> recommendations) {
        JsonObject context = object(profile, "context");
        JsonObject composition = object(context, "entity_composition");
        Double xpItemsShare = number(composition, "xp_items_share_pct");
        Double glueShare = number(composition, "glue_share_pct");
        Double automationShare = number(composition, "automation_share_pct");
        Double markerShare = number(composition, "marker_share_pct");
        Double dominantShare = number(composition, "dominant_custom_share_pct");
        Integer xp = integer(composition, "xp_orbs");
        Integer items = integer(composition, "items");
        Integer glue = integer(composition, "glue_family");
        Integer markers = integer(composition, "markers");
        Integer dominantCount = integer(composition, "dominant_custom_count");
        Integer total = integer(composition, "total_entities");
        String dominantId = str(composition, "dominant_custom_id");
        boolean xpItemsHot = xpItemsShare != null && xpItemsShare >= 40;
        boolean glueHot = glueShare != null && glueShare >= 15;
        boolean automationHot = automationShare != null && automationShare >= 50;
        boolean markerHot = markerShare != null && markerShare >= 20;
        boolean customHot = dominantShare != null && dominantShare >= 8 && dominantCount != null && dominantCount >= 80;
        boolean compositionHot = xpItemsHot || glueHot || automationHot || markerHot || customHot;
        if (compositionHot) {
            List<JsonObject> evidence = new ArrayList<>();
            if (total != null) {
                evidence.add(evidence("total_entities", total, "entities", "context.entity_composition"));
            }
            if (xp != null) {
                evidence.add(evidence("xp_orbs", xp, "entities", "context.entity_composition"));
            }
            if (items != null) {
                evidence.add(evidence("items", items, "entities", "context.entity_composition"));
            }
            if (glue != null) {
                evidence.add(evidence("glue_family", glue, "entities", "context.entity_composition"));
            }
            if (markers != null && markers > 0) {
                evidence.add(evidence("markers", markers, "entities", "context.entity_composition"));
            }
            if (dominantId != null && dominantCount != null) {
                evidence.add(evidence("dominant_custom_id", dominantId, null, "context.entity_composition"));
                evidence.add(evidence("dominant_custom_count", dominantCount, "entities", "context.entity_composition"));
            }
            if (xpItemsShare != null) {
                evidence.add(evidence("xp_items_share_pct", xpItemsShare, "percent", "context.entity_composition"));
            }
            if (glueShare != null) {
                evidence.add(evidence("glue_share_pct", glueShare, "percent", "context.entity_composition"));
            }
            if (automationShare != null) {
                evidence.add(evidence("automation_share_pct", automationShare, "percent", "context.entity_composition"));
            }
            if (markerShare != null && markerShare > 0) {
                evidence.add(evidence("marker_share_pct", markerShare, "percent", "context.entity_composition"));
            }
            if (dominantShare != null) {
                evidence.add(evidence("dominant_custom_share_pct", dominantShare, "percent", "context.entity_composition"));
            }
            String compositionTitle;
            String compositionDetail;
            if (customHot && !xpItemsHot && !automationHot && !glueHot) {
                compositionTitle = "One custom entity type dominates the loaded crowd";
                compositionDetail = String.format(Locale.US,
                        "Of %d loaded entities, %s is about %.0f%% (%d). Markers ~%.0f%%, XP+items ~%.0f%%, glue ~%.0f%%.",
                        total != null ? total : 0,
                        shortEntityId(dominantId),
                        dominantShare != null ? dominantShare : 0,
                        dominantCount != null ? dominantCount : 0,
                        markerShare != null ? markerShare : 0,
                        xpItemsShare != null ? xpItemsShare : 0,
                        glueShare != null ? glueShare : 0);
            } else if (markerHot && !xpItemsHot && !automationHot) {
                compositionTitle = "Many marker entities are loaded";
                compositionDetail = String.format(Locale.US,
                        "Of %d loaded entities: about %.0f%% are minecraft:marker (%d). Custom crowd leader: %s.",
                        total != null ? total : 0,
                        markerShare != null ? markerShare : 0,
                        markers != null ? markers : 0,
                        dominantId != null ? shortEntityId(dominantId) : "none");
            } else if (xpItemsHot || automationHot) {
                compositionTitle = "Lots of XP, dropped items, or glue entities";
                compositionDetail = String.format(Locale.US,
                        "Of %d loaded entities: about %.0f%% XP+items, %.0f%% glue-style entities (e.g. Create glue), %.0f%% XP+items+glue combined%s.",
                        total != null ? total : 0,
                        xpItemsShare != null ? xpItemsShare : 0,
                        glueShare != null ? glueShare : 0,
                        automationShare != null ? automationShare : 0,
                        dominantId != null
                                ? String.format(Locale.US, "; top custom is %s (~%.0f%%)",
                                shortEntityId(dominantId), dominantShare != null ? dominantShare : 0)
                                : "");
            } else {
                compositionTitle = "More Create glue-style entities than usual";
                compositionDetail = String.format(Locale.US,
                        "Of %d loaded entities: about %.0f%% XP+items, %.0f%% glue-style entities (e.g. Create glue), %.0f%% XP+items+glue combined.",
                        total != null ? total : 0,
                        xpItemsShare != null ? xpItemsShare : 0,
                        glueShare != null ? glueShare : 0,
                        automationShare != null ? automationShare : 0);
            }
            findings.add(richFinding(
                    "spark.entity.composition",
                    "entity_composition",
                    xpItemsHot || automationHot || customHot ? "warn" : "info",
                    "observed",
                    compositionTitle,
                    compositionDetail,
                    evidence,
                    List.of(
                            "These are counts of what is loaded — not proof they made the server lag.",
                            "Worth checking in-world first — common lag suspects, not a proven tick cost.")));
        }

        JsonObject concentration = object(context, "entity_concentration");
        JsonObject topShare = object(concentration, "top_n_share_pct");
        Double top20 = number(topShare, "20");
        Integer chunksWithEntities = integer(concentration, "chunks_with_entities");
        boolean quietHealthy = isHealthyQuietEmpty(profile);
        if (top20 != null && top20 >= 40) {
            String concTitle = quietHealthy
                    ? "Entities are packed into a few chunks (tick speed still looked fine)"
                    : "Most entities are packed into a few chunks";
            String concDetail = quietHealthy
                    ? String.format(Locale.US,
                    "The top 20 busy chunks hold %.0f%% of loaded entities (across %d chunks that have any). Tick speed looked healthy with nobody online — useful map context, not an urgent lag alarm.",
                    top20, chunksWithEntities != null ? chunksWithEntities : 0)
                    : String.format(Locale.US,
                    "The top 20 busy chunks hold %.0f%% of loaded entities (across %d chunks that have any).",
                    top20, chunksWithEntities != null ? chunksWithEntities : 0);
            findings.add(richFinding(
                    "spark.entity.concentration",
                    "entity_concentration",
                    "info",
                    "observed",
                    concTitle,
                    concDetail,
                    List.of(
                            evidence("top_20_share_pct", top20, "percent", "context.entity_concentration"),
                            evidence("chunks_with_entities",
                                    chunksWithEntities != null ? chunksWithEntities : 0,
                                    "chunks",
                                    "context.entity_concentration")),
                    List.of("This helps you know where to look — it does not prove those chunks made the server lag.")));
        }

        if (!context.has("entity_hotspots") || !context.get("entity_hotspots").isJsonArray()) {
            return;
        }
        JsonArray hotspots = context.getAsJsonArray("entity_hotspots");
        if (hotspots.isEmpty()) {
            return;
        }
        JsonObject top = hotspots.get(0).getAsJsonObject();
        Integer topCount = integer(top, "top_count");
        Integer topTotal = integer(top, "total_entities");
        String topType = str(top, "top_type");
        boolean hotspotHot = (topCount != null && topCount >= 100) || (topTotal != null && topTotal >= 100);
        if (hotspotHot) {
            List<JsonObject> evidence = new ArrayList<>();
            evidence.add(evidence("dimension", strOr(top, "dimension", "unknown"), null, "context.entity_hotspots[0]"));
            evidence.add(evidence("chunk_x", integer(top, "chunk_x") != null ? integer(top, "chunk_x") : 0,
                    "chunk", "context.entity_hotspots[0]"));
            evidence.add(evidence("chunk_z", integer(top, "chunk_z") != null ? integer(top, "chunk_z") : 0,
                    "chunk", "context.entity_hotspots[0]"));
            if (top.has("block_x_min")) {
                evidence.add(evidence("block_x_min", integer(top, "block_x_min"), "block", "context.entity_hotspots[0]"));
                evidence.add(evidence("block_z_min", integer(top, "block_z_min"), "block", "context.entity_hotspots[0]"));
            }
            if (topTotal != null) {
                evidence.add(evidence("total_entities", topTotal, "entities", "context.entity_hotspots[0]"));
            }
            if (topType != null) {
                evidence.add(evidence("top_type", topType, null, "context.entity_hotspots[0]"));
            }
            boolean markerTop = "minecraft:marker".equals(topType);
            String hotspotTitle;
            String hotspotDetail;
            if (quietHealthy && markerTop) {
                hotspotTitle = "Marker-heavy chunk (server still looked healthy)";
                hotspotDetail = String.format(Locale.US,
                        "%s chunk %d,%d has %d entities (mostly markers). Useful later if lag appears — not a primary next step while TPS looks fine with nobody online.",
                        strOr(top, "dimension", "world"),
                        integer(top, "chunk_x") != null ? integer(top, "chunk_x") : 0,
                        integer(top, "chunk_z") != null ? integer(top, "chunk_z") : 0,
                        topTotal != null ? topTotal : 0);
            } else if (markerTop) {
                hotspotTitle = "Crowded chunk of marker entities";
                hotspotDetail = String.format(Locale.US,
                        "%s chunk %d,%d has %d entities (mostly minecraft:marker).",
                        strOr(top, "dimension", "world"),
                        integer(top, "chunk_x") != null ? integer(top, "chunk_x") : 0,
                        integer(top, "chunk_z") != null ? integer(top, "chunk_z") : 0,
                        topTotal != null ? topTotal : 0);
            } else {
                hotspotTitle = "Crowded chunk found";
                hotspotDetail = String.format(Locale.US,
                        "%s chunk %d,%d has %d entities (mostly %s).",
                        strOr(top, "dimension", "world"),
                        integer(top, "chunk_x") != null ? integer(top, "chunk_x") : 0,
                        integer(top, "chunk_z") != null ? integer(top, "chunk_z") : 0,
                        topTotal != null ? topTotal : 0,
                        topType != null ? topType : "unknown");
            }
            findings.add(richFinding(
                    "spark.entity.hotspots",
                    "entity_hotspots",
                    quietHealthy ? "info" : "warn",
                    "observed",
                    hotspotTitle,
                    hotspotDetail,
                    evidence,
                    List.of("A crowded chunk is a clue to check in-world — not proof it made the server lag.")));

            if (!quietHealthy) {
                Integer chunkX = integer(top, "chunk_x");
                Integer chunkZ = integer(top, "chunk_z");
                String dimension = strOr(top, "dimension", "world");
                String typeLabel = entityFriendly(topType != null ? topType : "entities");
                String title = chunkX != null && chunkZ != null
                        ? String.format(Locale.US, "Inspect %s chunk %d, %d first",
                        worldShort(dimension), chunkX, chunkZ)
                        : "Go check the busiest chunks";
                List<String> steps = new ArrayList<>();
                if (top.has("block_x_min") && top.has("block_z_min")) {
                    steps.add(String.format(Locale.US,
                            "Go near blocks ~%d, ~%d in %s",
                            integer(top, "block_x_min"),
                            integer(top, "block_z_min"),
                            worldShort(dimension)));
                } else if (chunkX != null && chunkZ != null) {
                    steps.add(String.format(Locale.US, "Open %s and stand near chunk %d, %d",
                            worldShort(dimension), chunkX, chunkZ));
                }
                steps.add("Note what is producing the " + typeLabel + " (farm, hopper line, machine, leftover pile)");
                steps.add("Fix or pause that one setup, then profile again with a similar player count");
                recommendations.add(prioritizedRecommendation(
                        "spark.inspect.entity_hotspots",
                        "warn",
                        "entities",
                        "observed",
                        90,
                        title,
                        hotspotDetail + " Visit that spot in-game before changing global limits.",
                        "This capture’s busiest chunk is a concrete place to look — clearer than guessing from mod percentages alone.",
                        evidence,
                        List.of("Clearing entities without fixing what makes them will not prove a lasting fix."),
                        steps,
                        null,
                        "spark.entity.hotspots"));
            }
        }

        Integer viewDistance = null;
        JsonObject selected = object(object(profile, "capture"), "selected_server_properties");
        if (selected.has("view-distance")) {
            viewDistance = integer(selected, "view-distance");
        }
        int distantThreshold = viewDistance != null ? Math.max(viewDistance + 8, 24) : 32;
        int distant = 0;
        int unattended = 0;
        Integer worstDistance = null;
        Set<String> unattendedDimensions = new LinkedHashSet<>();
        for (JsonElement element : hotspots) {
            if (!element.isJsonObject()) {
                continue;
            }
            JsonObject hotspot = element.getAsJsonObject();
            Integer distance = integer(hotspot, "nearest_player_chunk_distance");
            Integer entitiesAt = integer(hotspot, "total_entities");
            Integer sameDimPlayers = integer(hotspot, "same_dimension_players");
            if (entitiesAt == null || entitiesAt < 64) {
                continue;
            }
            boolean noPlayersInDimension = sameDimPlayers != null
                    ? sameDimPlayers == 0
                    : distance == null;
            if (noPlayersInDimension) {
                unattended++;
                String dimension = str(hotspot, "dimension");
                if (dimension != null) {
                    unattendedDimensions.add(dimension);
                }
            } else if (distance != null && distance >= distantThreshold) {
                distant++;
                if (worstDistance == null || distance > worstDistance) {
                    worstDistance = distance;
                }
            }
        }
        if (distant > 0 && worstDistance != null) {
            findings.add(richFinding(
                    "spark.entity.distant_hotspots",
                    "entity_distance",
                    "info",
                    "correlated",
                    "Busy chunks were far from online players",
                    distant + " busy chunks were at least " + distantThreshold
                            + " chunks away from the nearest player in that world (farthest "
                            + worstDistance + ").",
                    List.of(
                            evidence("distant_hotspot_count", distant, "hotspots", "context.entity_hotspots"),
                            evidence("farthest_player_chunk_distance", worstDistance, "chunks", "context.entity_hotspots"),
                            evidence("distance_threshold_chunks", distantThreshold, "chunks", "context")),
                    List.of(
                            "This can mean chunk loaders or leftover loaded areas — the profile cannot prove which.",
                            "The profile has no chunk-ticket list, so force-loading is not proven.")));
        }
        if (unattended > 0 && !quietHealthy) {
            findings.add(richFinding(
                    "spark.entity.unattended_hotspots",
                    "entity_distance",
                    "warn",
                    "correlated",
                    "Busy chunks with nobody in that world",
                    unattended + " busy chunks were in worlds with no located players"
                            + (unattendedDimensions.isEmpty()
                            ? "."
                            : " (" + String.join(", ", unattendedDimensions) + ")."),
                    List.of(
                            evidence("unattended_hotspot_count", unattended, "hotspots", "context.entity_hotspots"),
                            evidence("unattended_dimensions",
                                    String.join(", ", unattendedDimensions),
                                    null,
                                    "context.entity_hotspots")),
                    List.of(
                            "No one online there can mean chunk loaders or leftover loaded farms — not proven from this profile alone.",
                            "The profile has no chunk-ticket list, so force-loading is not proven.")));
        }
    }

    private static void addCreatePresenceFinding(JsonObject profile, List<JsonObject> findings) {
        if (hasFindingId(findings, "spark.source.create.own_share")) {
            return;
        }
        JsonObject create = findRollup(profile, "create");
        if (create == null) {
            return;
        }
        double pct = ownPct(create);
        if (pct <= 0 || pct >= 8) {
            return;
        }
        findings.add(richFinding(
                "spark.source.create.present",
                "source_presence",
                "info",
                "observed",
                "Create showed up in the sample stacks",
                String.format(Locale.US,
                        "Create accounted for about %.1f%% of measured Server-thread time — visible in stacks, below the usual “large share” bar.",
                        pct),
                List.of(evidence("own_pct", pct, "percent", "source_rollups")),
                List.of("Presence is not proof Create caused lag; check World composition and call stacks if machines look busy.")));
    }

    private static void addDatapackContext(JsonObject profile, List<JsonObject> findings) {
        JsonArray datapacks = null;
        JsonObject context = object(profile, "context");
        if (context.has("datapacks") && context.get("datapacks").isJsonArray()) {
            datapacks = context.getAsJsonArray("datapacks");
        } else {
            JsonObject capture = object(profile, "capture");
            if (capture.has("datapacks") && capture.get("datapacks").isJsonArray()) {
                datapacks = capture.getAsJsonArray("datapacks");
            }
        }
        if (datapacks == null || datapacks.isEmpty()) {
            return;
        }
        int total = 0;
        int worldOrUnknown = 0;
        for (JsonElement element : datapacks) {
            if (!element.isJsonObject()) {
                continue;
            }
            JsonObject row = element.getAsJsonObject();
            String id = str(row, "id");
            if ("_truncated".equals(id)) {
                continue;
            }
            total++;
            String source = strOr(row, "source", "unknown");
            if ("world".equalsIgnoreCase(source) || "unknown".equalsIgnoreCase(source)) {
                worldOrUnknown++;
            }
        }
        if (total < 8 || worldOrUnknown < 5) {
            return;
        }
        findings.add(richFinding(
                "spark.context.datapacks",
                "datapack_context",
                "info",
                "contextual",
                "Many datapacks were loaded",
                total + " datapacks appear in this capture (" + worldOrUnknown
                        + " marked world/unknown source). Worldgen and custom packs can change what loads — not a proven tick cost by themselves.",
                List.of(
                        evidence("datapack_count", total, "datapacks", "context.datapacks"),
                        evidence("world_or_unknown_datapacks", worldOrUnknown, "datapacks", "context.datapacks")),
                List.of("Datapack names are metadata from Spark — disable or compare packs only with a before/after profile.")));
    }

    private static boolean isHealthyQuietEmpty(JsonObject profile) {
        JsonObject verdict = object(profile, "verdict");
        String grade = str(verdict, "grade");
        if (!"healthy".equals(grade)) {
            return false;
        }
        JsonObject context = object(profile, "context");
        Integer players = integer(context, "players");
        if (players == null || players > 0) {
            return false;
        }
        Double mspt = number(context, "mspt_p95_1m");
        Double msptMean = number(context, "mspt_mean_1m");
        double typical = msptMean != null ? msptMean : (mspt != null ? mspt : 999);
        double p95 = mspt != null ? mspt : typical;
        return typical <= 10 && p95 <= 20;
    }

    private static boolean hasFindingId(List<JsonObject> findings, String id) {
        for (JsonObject finding : findings) {
            if (id.equals(str(finding, "id"))) {
                return true;
            }
        }
        return false;
    }

    private static JsonObject findRollup(JsonObject profile, String modId) {
        JsonArray rollups = null;
        if (profile.has("source_rollups") && profile.get("source_rollups").isJsonArray()) {
            rollups = profile.getAsJsonArray("source_rollups");
        } else if (profile.has("mod_rollups") && profile.get("mod_rollups").isJsonArray()) {
            rollups = profile.getAsJsonArray("mod_rollups");
        }
        if (rollups == null) {
            return null;
        }
        for (JsonElement element : rollups) {
            if (!element.isJsonObject()) {
                continue;
            }
            JsonObject row = element.getAsJsonObject();
            if (modId.equals(str(row, "mod_id"))) {
                return row;
            }
        }
        return null;
    }

    private static String shortEntityId(String id) {
        if (id == null) {
            return "unknown";
        }
        int colon = id.indexOf(':');
        return colon >= 0 && colon + 1 < id.length() ? id.substring(colon + 1) : id;
    }

    private static void addUnresolvedAttribution(JsonObject profile, List<JsonObject> findings) {
        if (!profile.has("source_rollups") || !profile.get("source_rollups").isJsonArray()) {
            return;
        }
        double unresolved = 0;
        for (JsonElement element : profile.getAsJsonArray("source_rollups")) {
            if (!element.isJsonObject()) {
                continue;
            }
            JsonObject row = element.getAsJsonObject();
            String id = str(row, "mod_id");
            if ("unknown".equals(id) || "native".equals(id)) {
                unresolved += ownPct(row);
            }
        }
        if (unresolved >= 20) {
            findings.add(richFinding(
                    "spark.attribution.unresolved",
                    "attribution",
                    "info",
                    "observed",
                    "A big chunk of time couldn’t be tied to a clear mod",
                    String.format(Locale.US,
                            "About %.1f%% of measured time was labeled unknown or native (JVM/native code or missing mod mapping).",
                            unresolved),
                    List.of(evidence("own_pct", unresolved, "percent", "source_rollups.unknown_native")),
                    List.of(
                            "Unknown/native can mean JVM code, physics natives, or missing class→mod mapping.",
                            "Don’t invent a mod name from a package prefix.")));
        }
    }

    private static void addSystemEvidence(
            JsonObject profile,
            List<JsonObject> findings,
            List<JsonObject> recommendations,
            Double tps,
            Double mspt) {
        JsonObject system = object(profile, "system");
        JsonObject cpu = object(system, "cpu");
        Double process = number(cpu, "process_1m");
        Double host = number(cpu, "system_1m");
        if (process != null && host != null && (process >= 80 || host >= 90)) {
            String confidence = host - process >= 25 ? "contextual" : "observed";
            findings.add(richFinding(
                    "spark.system.cpu_pressure",
                    "cpu_pressure",
                    "warn",
                    confidence,
                    host - process >= 25
                            ? "The host machine used more CPU than the Minecraft process"
                            : "CPU use was high during the capture",
                    String.format(Locale.US, "Minecraft process CPU %.0f%%; whole-machine CPU %.0f%%.", process, host),
                    List.of(
                            evidence("process_1m", process, "percent", "system.cpu"),
                            evidence("system_1m", host, "percent", "system.cpu")),
                    List.of("This does not say which other program or core was busy.")));
        }
        boolean tickCritical = (tps != null && tps < 12) || (mspt != null && mspt > 100);
        if (tickCritical && process != null && process < 55) {
            findings.add(richFinding(
                    "spark.system.tick_vs_cpu",
                    "tick_vs_cpu",
                    "info",
                    "correlated",
                    "Lag with only moderate CPU use",
                    String.format(Locale.US,
                            "Process CPU was about %.0f%% while ticks looked bad. Minecraft’s tick mostly runs on one thread, so low total CPU does not mean that thread had spare room.",
                            process),
                    List.of(
                            evidence("process_1m", process, "percent", "system.cpu"),
                            evidence("tps_1m", tps != null ? tps : 0, "ticks_per_second", "context"),
                            evidence("mspt_p95_1m", mspt != null ? mspt : 0, "milliseconds", "context")),
                    List.of(
                            "Moderate total CPU does not mean the tick thread was free.",
                            "This pattern does not name which mod or farm is responsible.")));
        }
        JsonObject memory = object(system, "memory");
        Double swapUsed = number(memory, "swap_used_gb");
        Double swapTotal = number(memory, "swap_total_gb");
        if (swapUsed != null && swapUsed >= 8) {
            double share = swapTotal != null && swapTotal > 0 ? (swapUsed / swapTotal) * 100.0 : 0;
            findings.add(richFinding(
                    "spark.system.swap_pressure",
                    "swap_pressure",
                    share >= 25 || swapUsed >= 20 ? "warn" : "info",
                    "contextual",
                    "The host machine was using a lot of swap",
                    String.format(Locale.US,
                            "Swap used %.2f GiB%s. If the host is actively swapping to disk, the whole machine can hitch for hundreds of ms.",
                            swapUsed,
                            swapTotal != null ? String.format(Locale.US, " of %.2f GiB", swapTotal) : ""),
                    List.of(
                            evidence("swap_used_gb", swapUsed, "gib", "system.memory"),
                            evidence("swap_total_gb", swapTotal != null ? swapTotal : 0, "gib", "system.memory")),
                    List.of(
                            "Other programs on the host can own that swap too.",
                            "One snapshot cannot prove swap was thrashing during the worst tick.")));
            recommendations.add(prioritizedRecommendation(
                    "spark.host.check_swap",
                    "info",
                    "host",
                    "contextual",
                    55,
                    "Check free RAM and whether the machine is swapping",
                    String.format(Locale.US,
                            "Host swap was about %.1f GiB during this capture. Confirm free memory and active swap before raising Minecraft’s max heap.",
                            swapUsed),
                    "Swap pressure can hitch the whole machine even when Spark points at mods or entities.",
                    List.of(evidence("swap_used_gb", swapUsed, "gib", "system.memory")),
                    List.of("Don’t assume Minecraft alone filled the host’s swap."),
                    List.of(
                            "Check free RAM and whether swap is actively moving (host tools)",
                            "Find other memory-heavy programs before raising Xmx",
                            "Leave room for the OS and other services"),
                    null,
                    "spark.system.swap_pressure"));
        }
        JsonObject gc = object(system, "gc");
        Double collections = number(gc, "total_collections");
        if (collections != null && collections > 0) {
            findings.add(richFinding(
                    "spark.system.gc_context",
                    "gc_context",
                    "info",
                    "observed",
                    "Garbage collection was active",
                    String.format(Locale.US, "About %.0f GC collections were reported in the capture metadata.", collections),
                    List.of(evidence("total_collections", collections, "collections", "system.gc")),
                    List.of("Collection count is not pause length — check average pause time if lag feels hitchy.")));
        }
    }

    private static void addConfigContext(
            JsonObject profile,
            List<JsonObject> findings,
            List<JsonObject> recommendations) {
        JsonObject capture = object(profile, "capture");
        JsonObject selected = object(capture, "selected_server_properties");
        JsonObject configs = object(capture, "server_configurations");
        String properties = str(configs, "server.properties");
        Integer view = selected.has("view-distance")
                ? integer(selected, "view-distance")
                : jsonInteger(properties, "view-distance");
        Integer simulation = selected.has("simulation-distance")
                ? integer(selected, "simulation-distance")
                : jsonInteger(properties, "simulation-distance");
        Integer idle = selected.has("player-idle-timeout")
                ? integer(selected, "player-idle-timeout")
                : jsonInteger(properties, "player-idle-timeout");
        Integer broadcast = selected.has("entity-broadcast-range-percentage")
                ? integer(selected, "entity-broadcast-range-percentage")
                : jsonInteger(properties, "entity-broadcast-range-percentage");
        Integer chained = selected.has("max-chained-neighbor-updates")
                ? integer(selected, "max-chained-neighbor-updates")
                : jsonInteger(properties, "max-chained-neighbor-updates");

        if ((view != null && view >= 16) || (simulation != null && simulation >= 12)) {
            List<JsonObject> evidence = new ArrayList<>();
            if (view != null) {
                evidence.add(evidence("view-distance", view, "chunks", "capture.selected_server_properties"));
            }
            if (simulation != null) {
                evidence.add(evidence("simulation-distance", simulation, "chunks", "capture.selected_server_properties"));
            }
            findings.add(richFinding(
                    "spark.context.distance_settings",
                    "config_context",
                    "info",
                    "contextual",
                    "View or simulation distance is set high",
                    "These settings can add load. Try lowering one of them for a test — not a proven cause by itself.",
                    evidence,
                    List.of("Distance alone does not prove chunk loading was the lag.")));
        }
        if (idle != null && idle == 0) {
            findings.add(richFinding(
                    "spark.context.idle_timeout",
                    "config_context",
                    "info",
                    "contextual",
                    "AFK players are never kicked for idle",
                    "player-idle-timeout=0 lets AFK players keep areas loaded forever.",
                    List.of(evidence("player-idle-timeout", idle, "minutes", "capture.selected_server_properties")),
                    List.of("That’s an ops choice — farm fail-safes matter more than the timeout alone.")));
        }
        if (broadcast != null && broadcast >= 100 && view != null && view >= 16) {
            findings.add(richFinding(
                    "spark.context.entity_broadcast",
                    "config_context",
                    "info",
                    "contextual",
                    "Full entity tracking range with high view distance",
                    "entity-broadcast-range-percentage=100 with view-distance=" + view
                            + " can make dense entity areas cost more to track for players.",
                    List.of(
                            evidence("entity-broadcast-range-percentage", broadcast, "percent",
                                    "capture.selected_server_properties"),
                            evidence("view-distance", view, "chunks", "capture.selected_server_properties")),
                    List.of("Tracking cost is a secondary clue — not primary proof of tick lag.")));
        }
        if (chained != null && chained >= 500_000) {
            findings.add(richFinding(
                    "spark.context.chained_neighbor_updates",
                    "config_context",
                    "info",
                    "contextual",
                    "Neighbor-update chain limit is very high",
                    "max-chained-neighbor-updates=" + chained
                            + " can let cascading redstone or machines hitch for longer.",
                    List.of(evidence("max-chained-neighbor-updates", chained, "updates",
                            "capture.selected_server_properties")),
                    List.of("This is a spike-risk setting — not proof of the worst tick in this capture.")));
        }
        JsonObject gamerules = object(object(profile, "context"), "gamerules");
        JsonObject spectators = object(gamerules, "spectatorsGenerateChunks");
        if (!spectators.entrySet().isEmpty()) {
            boolean enabled = "true".equalsIgnoreCase(str(spectators, "default"));
            JsonObject worldValues = object(spectators, "world_values");
            for (Map.Entry<String, JsonElement> entry : worldValues.entrySet()) {
                if (entry.getValue().isJsonPrimitive()
                        && "true".equalsIgnoreCase(entry.getValue().getAsString())) {
                    enabled = true;
                    break;
                }
            }
            if (enabled) {
                findings.add(richFinding(
                        "spark.context.spectators_generate_chunks",
                        "config_context",
                        "info",
                        "contextual",
                        "Spectators can generate new chunks",
                        "spectatorsGenerateChunks is on — flying in spectator can generate terrain and add load.",
                        List.of(evidence("spectatorsGenerateChunks", true, null, "context.gamerules")),
                        List.of("This is an occasional spike risk — not enough alone to explain long low TPS.")));
            }
        }
    }

    private static JsonObject evidenceSummary(
            JsonObject profile, List<JsonObject> findings, List<JsonObject> recommendations) {
        JsonObject out = new JsonObject();
        JsonObject verdict = object(profile, "verdict");
        String happened = str(verdict, "headline");
        out.addProperty("what_happened", happened != null ? happened : "Spark profile captured");
        JsonObject whyFinding = preferredFinding(findings);
        out.addProperty("why_watchtower_says_this",
                whyFinding == null
                        ? "The profile loaded, but no clear finding matched."
                        : strOr(whyFinding, "detail", "The profile includes direct measurements."));
        JsonObject nextRec = preferredRecommendation(recommendations);
        out.addProperty("do_this_next",
                nextRec == null
                        ? "Profile again under the kind of play you care about."
                        : strOr(nextRec, "title", "Compare another capture."));
        out.addProperty("what_this_cannot_prove",
                "A profile shows what was busy during the capture. It doesn’t prove the single cause or how much faster the server will get.");
        return out;
    }

    private static JsonObject preferredFinding(List<JsonObject> findings) {
        JsonObject best = null;
        int bestRank = Integer.MIN_VALUE;
        for (JsonObject finding : findings) {
            String id = str(finding, "id");
            if ("spark.capture.mode".equals(id)) {
                continue;
            }
            int rank = severityRank(str(finding, "severity")) * 10 + confidenceRank(str(finding, "confidence"));
            if (rank > bestRank) {
                bestRank = rank;
                best = finding;
            }
        }
        return best != null ? best : (findings.isEmpty() ? null : findings.get(0));
    }

    private static JsonObject preferredRecommendation(List<JsonObject> recommendations) {
        JsonObject best = null;
        int bestRank = Integer.MIN_VALUE;
        for (JsonObject recommendation : recommendations) {
            Integer priority = integer(recommendation, "priority");
            String category = strOr(recommendation, "category", "");
            int categoryBoost = switch (category) {
                case "entities" -> 30;
                case "mod" -> 25;
                case "host" -> 20;
                case "config" -> 15;
                default -> 0;
            };
            int rank = (priority != null ? priority : 0)
                    + severityRank(str(recommendation, "severity")) * 10
                    + confidenceRank(str(recommendation, "confidence"))
                    + categoryBoost;
            if (rank > bestRank) {
                bestRank = rank;
                best = recommendation;
            }
        }
        return best;
    }

    private static int severityRank(String severity) {
        if ("critical".equals(severity) || "danger".equals(severity) || "error".equals(severity)) {
            return 4;
        }
        if ("warn".equals(severity) || "warning".equals(severity)) {
            return 3;
        }
        if ("info".equals(severity)) {
            return 2;
        }
        return 1;
    }

    private static int confidenceRank(String confidence) {
        if ("observed".equals(confidence)) {
            return 3;
        }
        if ("correlated".equals(confidence)) {
            return 2;
        }
        return 1;
    }

    private static JsonObject object(JsonObject parent, String key) {
        return parent != null && parent.has(key) && parent.get(key).isJsonObject()
                ? parent.getAsJsonObject(key) : new JsonObject();
    }

    private static Integer jsonInteger(String json, String key) {
        try {
            JsonObject parsed = com.google.gson.JsonParser.parseString(json).getAsJsonObject();
            return integer(parsed, key);
        } catch (Exception ignored) {
            return null;
        }
    }

    private static String capitalize(String value) {
        return value == null || value.isBlank()
                ? ""
                : Character.toUpperCase(value.charAt(0)) + value.substring(1);
    }

    /**
     * Merges log-based {@code mod_recommendations} into an enriched spark profile (facts-time second pass).
     */
    public static void mergeModRecommendations(JsonObject profile, JsonArray modRecs) {
        if (profile == null || modRecs == null || modRecs.isEmpty()) {
            return;
        }
        if (!profile.has("recommendations")) {
            return;
        }
        Set<String> suspectMods = collectSuspectMods(profile);
        if (suspectMods.isEmpty()) {
            return;
        }

        JsonArray recommendations = profile.getAsJsonArray("recommendations");
        JsonArray findings = profile.has("key_findings")
                ? profile.getAsJsonArray("key_findings")
                : new JsonArray();

        for (String modId : suspectMods) {
            JsonObject modRec = findModRec(modRecs, modId);
            if (modRec == null) {
                continue;
            }
            JsonObject sparkRec = findSparkModRec(recommendations, modId);
            if (sparkRec != null) {
                mergeIntoRecommendation(sparkRec, modRec);
            } else if (isSevereModRec(modRec)) {
                recommendations.add(buildFromModRec(modRec));
            }
            addLogFinding(findings, modRec);
        }

        profile.add("key_findings", findings);
        profile.add("recommendations", recommendations);
    }

    private static Set<String> collectSuspectMods(JsonObject profile) {
        Set<String> mods = new LinkedHashSet<>();
        if (profile.has("mod_hints")) {
            for (JsonElement el : profile.getAsJsonArray("mod_hints")) {
                if (el.isJsonObject() && el.getAsJsonObject().has("mod_id")) {
                    String modId = el.getAsJsonObject().get("mod_id").getAsString();
                    if (!isPlatformSource(modId)) {
                        mods.add(modId);
                    }
                }
            }
        }
        if (profile.has("mod_rollups")) {
            for (JsonElement el : profile.getAsJsonArray("mod_rollups")) {
                if (!el.isJsonObject()) {
                    continue;
                }
                JsonObject row = el.getAsJsonObject();
                String modId = row.has("mod_id") ? row.get("mod_id").getAsString() : null;
                double pct = row.has("pct") ? row.get("pct").getAsDouble() : 0;
                if (modId != null && pct >= 8 && !isPlatformSource(modId)) {
                    mods.add(modId);
                }
            }
        }
        return mods;
    }

    private static JsonObject findModRec(JsonArray modRecs, String modId) {
        for (JsonElement el : modRecs) {
            if (!el.isJsonObject()) {
                continue;
            }
            JsonObject rec = el.getAsJsonObject();
            if (modId.equals(str(rec, "mod_id"))) {
                return rec;
            }
        }
        return null;
    }

    private static JsonObject findSparkModRec(JsonArray recommendations, String modId) {
        for (JsonElement el : recommendations) {
            if (!el.isJsonObject()) {
                continue;
            }
            JsonObject rec = el.getAsJsonObject();
            if ("mod".equals(str(rec, "category")) && modId.equals(str(rec, "mod_id"))) {
                return rec;
            }
        }
        return null;
    }

    private static void mergeIntoRecommendation(JsonObject sparkRec, JsonObject modRec) {
        sparkRec.addProperty("linked_mod_rec", true);
        sparkRec.addProperty("confidence", "correlated");
        String fix = str(modRec, "fix");
        String why = str(modRec, "why");
        String detail = str(sparkRec, "detail");
        StringBuilder detailBuilder = new StringBuilder(detail != null ? detail : "");
        if (why != null && !why.isBlank() && (detail == null || !detail.contains(why))) {
            if (detailBuilder.length() > 0) {
                detailBuilder.append(" ");
            }
            detailBuilder.append(why);
        }
        if (fix != null && !fix.isBlank() && (detail == null || !detail.contains(fix))) {
            if (detailBuilder.length() > 0) {
                detailBuilder.append(" ");
            }
            detailBuilder.append(fix);
        }
        if (detailBuilder.length() > 0) {
            sparkRec.addProperty("detail", detailBuilder.toString().trim());
        }
        JsonArray actions = sparkRec.has("actions") ? sparkRec.getAsJsonArray("actions") : new JsonArray();
        Set<String> seen = new HashSet<>();
        for (JsonElement el : actions) {
            seen.add(el.getAsString());
        }
        if (modRec.has("fix_steps") && modRec.get("fix_steps").isJsonArray()) {
            for (JsonElement step : modRec.getAsJsonArray("fix_steps")) {
                String s = step.getAsString();
                if (seen.add(s)) {
                    actions.add(s);
                }
            }
        }
        sparkRec.add("actions", actions);
        if (!sparkRec.has("reversible_actions")) {
            sparkRec.add("reversible_actions", strings(List.of(
                    "Back up the current mod file and configuration before applying changes",
                    "Restore the backup if the log evidence does not change")));
        }
        JsonArray evidence = sparkRec.has("evidence") ? sparkRec.getAsJsonArray("evidence") : new JsonArray();
        if (!hasEvidence(evidence, "log_hits", "watchtower_log_scan")) {
            JsonObject logEvidence = evidence("log_hits",
                    modRec.has("count") ? modRec.get("count").getAsInt() : 0,
                    "events", "watchtower_log_scan");
            evidence.add(logEvidence);
        }
        sparkRec.add("evidence", evidence);
    }

    private static boolean isSevereModRec(JsonObject modRec) {
        String severity = str(modRec, "severity");
        return "warning".equals(severity) || "critical".equals(severity);
    }

    private static JsonObject buildFromModRec(JsonObject modRec) {
        String modId = str(modRec, "mod_id");
        String title = str(modRec, "fix");
        if (title == null || title.isBlank()) {
            title = "Address " + modId + " log errors";
        }
        List<String> actions = new ArrayList<>();
        if (modRec.has("fix_steps") && modRec.get("fix_steps").isJsonArray()) {
            for (JsonElement step : modRec.getAsJsonArray("fix_steps")) {
                actions.add(step.getAsString());
            }
        }
        String severity = str(modRec, "severity");
        if ("warning".equals(severity)) {
            severity = "warn";
        }
        if (severity == null) {
            severity = "warn";
        }
        JsonObject rec = rec(severity, "mod", title, strOr(modRec, "why", title), actions, modId);
        rec.addProperty("id", "spark.logs." + stablePart(modId) + ".review");
        rec.addProperty("confidence", "correlated");
        JsonArray evidence = new JsonArray();
        evidence.add(evidence("log_hits", modRec.has("count") ? modRec.get("count").getAsInt() : 0,
                "events", "watchtower_log_scan"));
        rec.add("evidence", evidence);
        JsonArray limitations = new JsonArray();
        limitations.add("Log events and profiler ownership are correlated observations; neither proves causality.");
        rec.add("limitations", limitations);
        rec.add("reversible_actions", strings(List.of(
                "Back up the current mod file and configuration before applying changes",
                "Restore the backup if the log evidence does not change")));
        rec.addProperty("linked_mod_rec", true);
        return rec;
    }

    private static void addLogFinding(JsonArray findings, JsonObject modRec) {
        int count = modRec.has("count") ? modRec.get("count").getAsInt() : 0;
        if (count <= 0) {
            return;
        }
        String modId = str(modRec, "mod_id");
        String category = str(modRec, "category");
        if (modId == null) {
            return;
        }
        String title = "Also in logs: " + modId;
        String detail = category != null
                ? category.replace('_', ' ') + " (" + count + " hits in report window)"
                : count + " log hits in report window";
        for (JsonElement el : findings) {
            if (el.isJsonObject() && title.equals(str(el.getAsJsonObject(), "title"))) {
                return;
            }
        }
        findings.add(richFinding(
                "spark.logs." + stablePart(modId) + ".observed",
                "mod_logs",
                "warn",
                "correlated",
                title,
                detail,
                List.of(evidence("log_hits", count, "events", "watchtower_log_scan")),
                List.of("The log events and Spark sample overlap in a report, but this does not establish causality.")));
    }

    private static JsonObject richFinding(
            String id,
            String kind,
            String severity,
            String confidence,
            String title,
            String detail,
            List<JsonObject> evidence,
            List<String> limitations) {
        JsonObject out = finding(kind, severity, title, detail);
        out.addProperty("id", id);
        out.addProperty("confidence", confidence);
        out.add("evidence", jsonObjects(evidence));
        out.add("limitations", strings(limitations));
        return out;
    }

    private static void addSmartModRecommendation(
            JsonObject profile,
            List<JsonObject> findings,
            List<JsonObject> recommendations) {
        JsonObject topMod = firstNonPlatformRollup(profile);
        if (topMod == null) {
            return;
        }
        String modId = str(topMod, "mod_id");
        if (modId == null) {
            return;
        }
        double pct = ownPct(topMod);
        double involvement = topMod.has("involvement_pct") ? topMod.get("involvement_pct").getAsDouble() : 0;
        String topMethod = strOr(topMod, "top_label", "unavailable");
        List<JsonObject> evidence = new ArrayList<>();
        evidence.add(evidence("own_pct", pct, "percent", "source_rollups"));
        evidence.add(evidence("top_method", topMethod, null, "source_rollups"));
        if (involvement > 0) {
            evidence.add(evidence("involvement_pct", involvement, "percent", "source_rollups"));
        }

        if (pct >= 8) {
            findings.add(richFinding(
                    "spark.source." + stablePart(modId) + ".own_share",
                    "source_share",
                    pct >= 15 ? "warn" : "info",
                    "observed",
                    modId + " used a large share of server time",
                    String.format(Locale.US,
                            "About %.1f%% of measured Server-thread time was spent inside %s itself (hot step: %s).",
                            pct, modId, topMethod),
                    evidence,
                    List.of(
                            "This shows where time showed up in the sample — not proof this mod alone made the server lag.",
                            "Sampling can miss short bursts or mis-label some code.")));
        } else if (!"create".equals(modId) || involvement < 25) {
            return;
        }

        JsonObject composition = object(object(profile, "context"), "entity_composition");
        Double automationShare = number(composition, "automation_share_pct");
        Double itemShare = number(composition, "item_share_pct");
        Double glueShare = number(composition, "glue_share_pct");
        boolean worldCrowded = (automationShare != null && automationShare >= 35)
                || (itemShare != null && itemShare >= 30)
                || (glueShare != null && glueShare >= 12);

        String title;
        String detail;
        String why;
        List<String> steps = new ArrayList<>();
        int priority;
        String severity = pct >= 15 ? "warn" : "info";

        if ("create".equals(modId)) {
            String methodHint = createMethodHint(topMethod);
            if (worldCrowded) {
                title = "Check Create farms and item piles before tweaking Create configs";
                detail = String.format(Locale.US,
                        "Create shows up in stacks (~%.1f%% own%s) and the world is heavy on XP/items/glue. Start with the busy chunks and the machines feeding them — a Create config tweak won’t clear a flooded farm.",
                        pct,
                        involvement >= 25 ? String.format(Locale.US, ", ~%.0f%% involvement", involvement) : "");
                why = "Create time plus a crowded automation/item composition usually means an in-world setup, not a random version bump.";
                priority = 70;
                steps.add("Open World view and visit the busiest chunk near Create machines");
                steps.add("Pause or empty one farm/contraption that is dumping " + (
                        itemShare != null && itemShare >= 30 ? "items" : "XP/items/glue"));
                steps.add("Profile again under the same player load before changing Create’s global settings");
            } else if (methodHint != null) {
                title = "Focus on Create’s hot path: " + shortMethod(topMethod);
                detail = String.format(Locale.US,
                        "About %.1f%% of Server-thread time was inside Create. Hottest sampled step: %s. %s",
                        pct, topMethod, methodHint);
                why = "The profile names a Create code path — better than “change a Create setting at random.”";
                priority = 75;
                steps.add("In Mods / call paths, open Create and find “" + shortMethod(topMethod) + "”");
                steps.add(methodHint);
                steps.add("Change only that kind of setup, then capture again");
            } else {
                title = "Inspect one Create setup tied to the hot stack";
                detail = String.format(Locale.US,
                        "Create used about %.1f%% of measured Server-thread time (hot step: %s). Find the in-world machine behind that stack before updating Create or flipping unrelated configs.",
                        pct, topMethod);
                why = "Create is measurable here, but the next step is locating the busy setup — not a blind version change.";
                priority = 65;
                steps.add("Jump to Create in the Mods tab and note the top sampled method");
                steps.add("Find one contraption or ticking machine that matches that behavior");
                steps.add("Disable or simplify that one setup, then profile again");
            }
        } else if ("sable".equals(modId)) {
            title = "Investigate the sable-heavy path before other mods";
            detail = String.format(Locale.US,
                    "sable used about %.1f%% of Server-thread time (hot step: %s). Check sable’s recent changes and the content it was ticking before blaming unrelated packs.",
                    pct, topMethod);
            why = "sable is the top actionable mod by exclusive time in this sample.";
            priority = 80;
            steps.add("Note the sable version and the hot method “" + shortMethod(topMethod) + "”");
            steps.add("Check sable configs / known heavy features tied to that path");
            steps.add("Make one sable-related change, then profile again under the same load");
        } else {
            title = "Test one " + modId + " change aimed at “" + shortMethod(topMethod) + "”";
            detail = String.format(Locale.US,
                    "About %.1f%% of measured Server-thread time was inside %s itself. Hottest step: %s. Change one setting or feature that feeds that path — not a random update.",
                    pct, modId, topMethod);
            why = modId + " is the top actionable mod by exclusive time in this sample.";
            priority = pct >= 15 ? 80 : 60;
            steps.add("Note the current " + modId + " version and config");
            steps.add("Change one setting related to “" + shortMethod(topMethod) + "”, or temporarily disable one heavy " + modId + " feature");
            steps.add("Restore the backup if the next capture is unclear");
        }

        recommendations.add(prioritizedRecommendation(
                "spark.compare.source." + stablePart(modId),
                severity,
                "mod",
                "observed",
                priority,
                title,
                detail,
                why,
                evidence,
                List.of("A smaller percentage after a change does not prove what fixed the lag."),
                steps,
                modId,
                "spark.source." + stablePart(modId) + ".own_share"));
    }

    private static void addSmartConfigRecommendation(
            JsonObject profile,
            List<JsonObject> findings,
            List<JsonObject> recommendations,
            Double tps,
            Double mspt) {
        boolean lagging = (tps != null && tps < 17) || (mspt != null && mspt > 60);
        if (!lagging) {
            return;
        }
        // Prefer world/mod next steps when they already exist at high priority.
        boolean hasStrongWorldOrMod = false;
        for (JsonObject rec : recommendations) {
            Integer priority = integer(rec, "priority");
            String category = str(rec, "category");
            if (priority != null && priority >= 70
                    && ("entities".equals(category) || "mod".equals(category))) {
                hasStrongWorldOrMod = true;
                break;
            }
        }

        JsonObject capture = object(profile, "capture");
        JsonObject selected = object(capture, "selected_server_properties");
        JsonObject configs = object(capture, "server_configurations");
        String properties = str(configs, "server.properties");
        Integer view = selected.has("view-distance")
                ? integer(selected, "view-distance")
                : jsonInteger(properties, "view-distance");
        Integer simulation = selected.has("simulation-distance")
                ? integer(selected, "simulation-distance")
                : jsonInteger(properties, "simulation-distance");
        Integer idle = selected.has("player-idle-timeout")
                ? integer(selected, "player-idle-timeout")
                : jsonInteger(properties, "player-idle-timeout");
        Integer broadcast = selected.has("entity-broadcast-range-percentage")
                ? integer(selected, "entity-broadcast-range-percentage")
                : jsonInteger(properties, "entity-broadcast-range-percentage");
        Integer chained = selected.has("max-chained-neighbor-updates")
                ? integer(selected, "max-chained-neighbor-updates")
                : jsonInteger(properties, "max-chained-neighbor-updates");

        boolean unattended = hasFindingId(findings, "spark.entity.unattended_hotspots");
        Integer entities = integer(object(profile, "context"), "world_entities");

        record ConfigCandidate(int score, String id, String title, String detail, String why,
                               List<JsonObject> evidence, List<String> steps, String relatedFinding) {
        }

        List<ConfigCandidate> candidates = new ArrayList<>();
        if (view != null && view >= 16) {
            int suggested = Math.max(8, view - 2);
            candidates.add(new ConfigCandidate(
                    40 + (view - 16) * 3,
                    "spark.compare.view_distance",
                    "Lower view-distance from " + view + " for a short test",
                    String.format(Locale.US,
                            "This capture used view-distance=%d while ticks looked slow. Try %d temporarily — that cuts how far chunks stay loaded for players without touching simulation yet.",
                            view, suggested),
                    "View distance is high in the captured server.properties, so the advice names that setting instead of a generic tweak.",
                    List.of(evidence("view-distance", view, "chunks", "capture.selected_server_properties")),
                    List.of(
                            "Back up server.properties",
                            "Set view-distance=" + suggested + " and restart/reload as your host requires",
                            "Profile again under the same play, then restore " + view + " if you need the range back"),
                    hasFindingId(findings, "spark.context.distance_settings")
                            ? "spark.context.distance_settings" : null));
        }
        if (simulation != null && simulation >= 12) {
            int suggested = Math.max(6, simulation - 2);
            candidates.add(new ConfigCandidate(
                    35 + (simulation - 12) * 3,
                    "spark.compare.simulation_distance",
                    "Lower simulation-distance from " + simulation + " for a short test",
                    String.format(Locale.US,
                            "simulation-distance=%d was active while ticks looked slow. Try %d for one capture to see if distant ticking areas are part of the load.",
                            simulation, suggested),
                    "Simulation distance is high enough to be worth a reversible A/B test.",
                    List.of(evidence("simulation-distance", simulation, "chunks", "capture.selected_server_properties")),
                    List.of(
                            "Back up server.properties",
                            "Set simulation-distance=" + suggested,
                            "Capture again, then restore " + simulation + " after you compare"),
                    hasFindingId(findings, "spark.context.distance_settings")
                            ? "spark.context.distance_settings" : null));
        }
        if (idle != null && idle == 0 && unattended) {
            candidates.add(new ConfigCandidate(
                    50,
                    "spark.compare.idle_timeout",
                    "Turn on a player-idle-timeout for an AFK test",
                    "player-idle-timeout=0 and busy chunks with nobody in those worlds showed up together. A short idle kick (for example 15–30 minutes) can reveal whether AFK chunk loading is part of the load.",
                    "Idle timeout is off while unattended hotspots are present — more specific than lowering a random distance setting.",
                    List.of(
                            evidence("player-idle-timeout", idle, "minutes", "capture.selected_server_properties"),
                            evidence("unattended_hotspots", true, null, "context.entity_hotspots")),
                    List.of(
                            "Back up server.properties",
                            "Set player-idle-timeout=15 (or 30) for a test window",
                            "Profile during lag again, then restore 0 if you want AFK allowed"),
                    "spark.entity.unattended_hotspots"));
        }
        if (broadcast != null && broadcast >= 100 && view != null && view >= 14
                && entities != null && entities >= 2000) {
            candidates.add(new ConfigCandidate(
                    32,
                    "spark.compare.entity_broadcast",
                    "Lower entity-broadcast-range-percentage from 100 for a test",
                    String.format(Locale.US,
                            "Entity tracking is at 100%% with view-distance=%d and %d loaded entities. Lowering broadcast range can ease tracking cost in dense areas — it won’t clear farms by itself.",
                            view, entities),
                    "Full entity tracking plus a crowded world is a concrete config lever.",
                    List.of(
                            evidence("entity-broadcast-range-percentage", broadcast, "percent",
                                    "capture.selected_server_properties"),
                            evidence("world_entities", entities, "entities", "context")),
                    List.of(
                            "Back up server.properties",
                            "Try entity-broadcast-range-percentage=75 for one session",
                            "Profile again, then restore 100 if player visibility feels wrong"),
                    hasFindingId(findings, "spark.context.entity_broadcast")
                            ? "spark.context.entity_broadcast" : null));
        }
        if (chained != null && chained >= 500_000 && findRollup(profile, "create") != null) {
            candidates.add(new ConfigCandidate(
                    28,
                    "spark.compare.chained_neighbor_updates",
                    "Lower max-chained-neighbor-updates from " + chained + " for a spike test",
                    "Create is present and max-chained-neighbor-updates is very high. That can let cascading redstone/machine updates hitch longer — useful as a spike test after world hotspots are checked.",
                    "High neighbor-update chains pair poorly with automation-heavy packs.",
                    List.of(evidence("max-chained-neighbor-updates", chained, "updates",
                            "capture.selected_server_properties")),
                    List.of(
                            "Back up server.properties",
                            "Try max-chained-neighbor-updates=100000 for a short test",
                            "Profile during a known redstone/Create hitch, then restore if needed"),
                    hasFindingId(findings, "spark.context.chained_neighbor_updates")
                            ? "spark.context.chained_neighbor_updates" : null));
        }

        if (candidates.isEmpty()) {
            return;
        }
        candidates.sort((a, b) -> Integer.compare(b.score, a.score));
        ConfigCandidate best = candidates.get(0);
        // When world/mod already give a strong next step, only keep config if it is clearly specific.
        int priority = hasStrongWorldOrMod ? Math.min(45, best.score) : Math.min(60, best.score + 10);
        recommendations.add(prioritizedRecommendation(
                best.id,
                "warn",
                "config",
                "contextual",
                priority,
                best.title,
                best.detail,
                best.why,
                best.evidence,
                List.of("If the two captures had different player activity, the comparison can be misleading."),
                best.steps,
                null,
                best.relatedFinding));
    }

    private static List<JsonObject> finalizeRecommendations(List<JsonObject> recommendations) {
        List<JsonObject> copy = new ArrayList<>(recommendations);
        copy.sort((a, b) -> {
            int pa = integer(a, "priority") != null ? integer(a, "priority") : 0;
            int pb = integer(b, "priority") != null ? integer(b, "priority") : 0;
            if (pa != pb) {
                return Integer.compare(pb, pa);
            }
            return Integer.compare(
                    severityRank(str(b, "severity")),
                    severityRank(str(a, "severity")));
        });
        List<JsonObject> out = new ArrayList<>();
        Set<String> categories = new HashSet<>();
        for (JsonObject rec : copy) {
            if (out.size() >= 4) {
                break;
            }
            String category = strOr(rec, "category", "");
            // Keep at most one workflow card, and prefer concrete categories first.
            if ("workflow".equals(category) && out.size() >= 2) {
                continue;
            }
            if (!category.isEmpty() && categories.contains(category) && !"mod".equals(category)) {
                continue;
            }
            categories.add(category);
            out.add(rec);
        }
        if (out.isEmpty() && !copy.isEmpty()) {
            out.add(copy.get(0));
        }
        return out;
    }

    private static String createMethodHint(String topMethod) {
        if (topMethod == null) {
            return null;
        }
        String lower = topMethod.toLowerCase(Locale.ROOT);
        if (lower.contains("collide") || lower.contains("obb")) {
            return "Look for overlapping/moving contraptions or dense collision setups near players.";
        }
        if (lower.contains("smartblock") || lower.contains("ticker") || lower.contains(".tick")) {
            return "Look for always-on ticking Create machines (fans, depots, sequencers) in loaded chunks.";
        }
        if (lower.contains("contraption")) {
            return "Look for large or constantly moving contraptions and simplify one of them.";
        }
        return null;
    }

    private static String shortMethod(String label) {
        if (label == null || label.isBlank()) {
            return "top method";
        }
        int dot = label.lastIndexOf('.');
        return dot >= 0 && dot + 1 < label.length() ? label.substring(dot + 1) : label;
    }

    private static String worldShort(String dimension) {
        if (dimension == null || dimension.isBlank()) {
            return "world";
        }
        int slash = dimension.lastIndexOf('/');
        String leaf = slash >= 0 ? dimension.substring(slash + 1) : dimension;
        return switch (leaf) {
            case "overworld" -> "Overworld";
            case "the_nether", "nether" -> "Nether";
            case "the_end", "end" -> "End";
            default -> leaf.replace('_', ' ');
        };
    }

    private static String entityFriendly(String id) {
        if (id == null) {
            return "entities";
        }
        return switch (id) {
            case "minecraft:item" -> "dropped items";
            case "minecraft:experience_orb" -> "XP orbs";
            case "minecraft:marker" -> "markers";
            case "create:super_glue" -> "Create glue";
            case "simulated:honey_glue" -> "honey glue";
            default -> shortEntityId(id).replace('_', ' ');
        };
    }

    private static JsonObject prioritizedRecommendation(
            String id,
            String severity,
            String category,
            String confidence,
            int priority,
            String title,
            String detail,
            String why,
            List<JsonObject> evidence,
            List<String> limitations,
            List<String> reversibleActions,
            String modId,
            String relatedFindingId) {
        JsonObject out = richRecommendation(
                id, severity, category, confidence, title, detail, evidence, limitations, reversibleActions, modId);
        out.addProperty("priority", priority);
        if (why != null && !why.isBlank()) {
            out.addProperty("why", why);
        }
        if (relatedFindingId != null && !relatedFindingId.isBlank()) {
            out.addProperty("related_finding_id", relatedFindingId);
        }
        return out;
    }

    private static JsonObject richRecommendation(
            String id,
            String severity,
            String category,
            String confidence,
            String title,
            String detail,
            List<JsonObject> evidence,
            List<String> limitations,
            List<String> reversibleActions,
            String modId) {
        JsonObject out = rec(severity, category, title, detail, reversibleActions, modId);
        out.addProperty("id", id);
        out.addProperty("confidence", confidence);
        out.add("evidence", jsonObjects(evidence));
        out.add("limitations", strings(limitations));
        out.add("reversible_actions", strings(reversibleActions));
        return out;
    }

    private static JsonObject evidence(String metric, Object value, String unit, String source) {
        JsonObject out = new JsonObject();
        out.addProperty("metric", metric);
        if (value instanceof Number number) {
            out.addProperty("value", number);
        } else if (value instanceof Boolean bool) {
            out.addProperty("value", bool);
        } else if (value != null) {
            out.addProperty("value", value.toString());
        }
        if (unit != null) {
            out.addProperty("unit", unit);
        }
        out.addProperty("source", source);
        out.addProperty("path", source + "." + metric);
        return out;
    }

    private static JsonArray jsonObjects(List<JsonObject> values) {
        JsonArray out = new JsonArray();
        values.forEach(out::add);
        return out;
    }

    private static boolean hasEvidence(JsonArray evidence, String metric, String source) {
        for (JsonElement element : evidence) {
            if (!element.isJsonObject()) {
                continue;
            }
            JsonObject row = element.getAsJsonObject();
            if (metric.equals(str(row, "metric")) && source.equals(str(row, "source"))) {
                return true;
            }
        }
        return false;
    }

    private static JsonArray strings(List<String> values) {
        JsonArray out = new JsonArray();
        values.forEach(out::add);
        return out;
    }

    private static String plainTickSummary(
            Double tps,
            Double msptMean,
            Double msptP95,
            Double msptMax1m,
            Double msptMax5m) {
        List<String> parts = new ArrayList<>();
        if (tps != null) {
            String speed = tps < 12 ? " (about half speed)" : tps < 17 ? " (noticeably slow)" : "";
            parts.add(String.format(Locale.US, "About %.1f TPS%s", tps, speed));
        }
        if (msptMean != null) {
            parts.add(String.format(Locale.US, "typical tick ~%.0f ms", msptMean));
        }
        if (msptP95 != null) {
            parts.add(String.format(Locale.US, "slow ticks (p95) ~%.0f ms", msptP95));
        }
        if (msptMax1m != null) {
            parts.add(String.format(Locale.US, "worst tick ~%.0f ms (1 min)", msptMax1m));
        }
        if (msptMax5m != null) {
            if (msptMax5m >= 1000) {
                parts.add(String.format(Locale.US, "worst recent hitch ~%.1f s (5 min)", msptMax5m / 1000.0));
            } else {
                parts.add(String.format(Locale.US, "worst recent tick ~%.0f ms (5 min)", msptMax5m));
            }
        }
        if (parts.isEmpty()) {
            return "Tick speed numbers were present in the capture.";
        }
        return String.join("; ", parts) + ".";
    }

    private static Double number(JsonObject object, String key) {
        return object.has(key) && !object.get(key).isJsonNull() ? object.get(key).getAsDouble() : null;
    }

    private static Integer integer(JsonObject object, String key) {
        return object.has(key) && !object.get(key).isJsonNull() ? object.get(key).getAsInt() : null;
    }

    private static double ownPct(JsonObject rollup) {
        Double own = number(rollup, "own_pct");
        if (own != null) {
            return own;
        }
        Double legacy = number(rollup, "pct");
        return legacy != null ? legacy : 0;
    }

    private static String stablePart(String value) {
        if (value == null || value.isBlank()) {
            return "unknown";
        }
        return value.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9._-]+", "_");
    }

    private static void addHighInvolvementFinding(JsonObject profile, List<JsonObject> findings) {
        JsonArray rollups = profile.has("source_rollups") && profile.get("source_rollups").isJsonArray()
                ? profile.getAsJsonArray("source_rollups")
                : profile.has("mod_rollups") && profile.get("mod_rollups").isJsonArray()
                ? profile.getAsJsonArray("mod_rollups")
                : null;
        if (rollups == null) {
            return;
        }
        JsonObject best = null;
        double bestInvolvement = 0;
        for (JsonElement element : rollups) {
            if (!element.isJsonObject()) {
                continue;
            }
            JsonObject row = element.getAsJsonObject();
            String modId = str(row, "mod_id");
            if (modId == null || isPlatformSource(modId)) {
                continue;
            }
            double own = ownPct(row);
            Double involvement = number(row, "involvement_pct");
            if (involvement == null) {
                involvement = number(row, "pct");
            }
            if (involvement == null || involvement < 40 || own >= 8) {
                continue;
            }
            if (involvement > bestInvolvement) {
                bestInvolvement = involvement;
                best = row;
            }
        }
        if (best == null) {
            return;
        }
        String modId = str(best, "mod_id");
        findings.add(richFinding(
                "spark.source." + stablePart(modId) + ".involvement",
                "source_involvement",
                "info",
                "correlated",
                modId + " shows up often in the stack, but rarely as the heavy step",
                String.format(Locale.US,
                        "Spark saw %s on about %.0f%% of samples, but only about %.1f%% as the code doing the work at that moment.",
                        modId, bestInvolvement, ownPct(best)),
                List.of(
                        evidence("involvement_pct", bestInvolvement, "percent", "source_rollups"),
                        evidence("own_pct", ownPct(best), "percent", "source_rollups")),
                List.of(
                        "It may be on the path without being the heavy part.",
                        "Don’t treat this as proof this mod alone made the server lag.")));
    }

    private static JsonObject firstNonPlatformRollup(JsonObject profile) {
        JsonArray rollups = null;
        if (profile.has("source_rollups") && profile.get("source_rollups").isJsonArray()) {
            rollups = profile.getAsJsonArray("source_rollups");
        } else if (profile.has("mod_rollups") && profile.get("mod_rollups").isJsonArray()) {
            rollups = profile.getAsJsonArray("mod_rollups");
        }
        if (rollups == null || rollups.isEmpty()) {
            return null;
        }
        for (JsonElement element : rollups) {
            if (!element.isJsonObject()) {
                continue;
            }
            JsonObject row = element.getAsJsonObject();
            String modId = str(row, "mod_id");
            if (modId != null && !isPlatformSource(modId)) {
                return row;
            }
        }
        return null;
    }

    private static boolean isPlatformSource(String modId) {
        return SparkParser.isPlatformOrInfrastructureMod(modId);
    }

    private static JsonObject finding(String kind, String severity, String title, String detail) {
        JsonObject o = new JsonObject();
        o.addProperty("kind", kind);
        o.addProperty("severity", severity);
        o.addProperty("title", title);
        o.addProperty("detail", detail);
        return o;
    }

    private static JsonObject rec(String severity, String category, String title, String detail,
                                  List<String> actions, String modId) {
        JsonObject o = new JsonObject();
        o.addProperty("severity", severity);
        o.addProperty("category", category);
        o.addProperty("title", title);
        o.addProperty("detail", detail);
        JsonArray arr = new JsonArray();
        actions.forEach(arr::add);
        o.add("actions", arr);
        if (modId != null) {
            o.addProperty("mod_id", modId);
        }
        return o;
    }

    private static String str(JsonObject o, String key) {
        return o.has(key) && !o.get(key).isJsonNull() ? o.get(key).getAsString() : null;
    }

    private static String strOr(JsonObject o, String key, String def) {
        String s = str(o, key);
        return s != null ? s : def;
    }
}
