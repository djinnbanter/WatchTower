package dev.mcstatus.watchtower.core.analyze;

import com.google.gson.JsonObject;

/**
 * Informational RSS vs heap headroom hint for native/off-heap memory pressure.
 */
public final class RssHeapEvaluator {

    public static final double DEFAULT_RATIO_WARN = 1.25;

    private RssHeapEvaluator() {
    }

    public static JsonObject evaluate(Double rssGb, Double heapMaxGb, double ratioWarn) {
        JsonObject out = new JsonObject();
        out.addProperty("show", false);
        if (rssGb == null || heapMaxGb == null || heapMaxGb <= 0 || ratioWarn <= 0) {
            return out;
        }
        if (rssGb <= heapMaxGb * ratioWarn) {
            return out;
        }
        out.addProperty("show", true);
        out.addProperty("rss_gb", round2(rssGb));
        out.addProperty("heap_max_gb", round2(heapMaxGb));
        out.addProperty("ratio", round2(rssGb / heapMaxGb));
        out.addProperty("message",
                "Native memory (RSS) is elevated vs Java heap max — possible off-heap/native leak; "
                        + "check mods using JNI or large direct buffers.");
        return out;
    }

    private static double round2(double v) {
        return Math.round(v * 100.0) / 100.0;
    }
}
