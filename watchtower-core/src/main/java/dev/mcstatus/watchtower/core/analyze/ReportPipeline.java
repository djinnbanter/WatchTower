package dev.mcstatus.watchtower.core.analyze;

import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.brief.BriefWriter;

/**
 * Entry point for the analyze/brief pipeline using Gson JSON objects.
 */
public final class ReportPipeline {

    private ReportPipeline() {
    }

    public static JsonObject buildFacts(JsonObject staging) {
        return FactsBuilder.buildFacts(staging);
    }

    public static String writeBrief(JsonObject facts) {
        return BriefWriter.writeBrief(facts);
    }
}
