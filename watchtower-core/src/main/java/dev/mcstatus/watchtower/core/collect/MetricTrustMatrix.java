package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonObject;

/**
 * Maps deployment context to per-metric trust status for dashboard badges and banners.
 */
public final class MetricTrustMatrix {

    private MetricTrustMatrix() {
    }

    public static JsonObject buildMetrics(String deployment, String hosting, boolean cgroupMemory, boolean docker) {
        JsonObject metrics = new JsonObject();
        metrics.add("tps_mspt", trusted());
        metrics.add("heap", trusted());

        if (cgroupMemory) {
            metrics.add("host_cpu_pct", approximate("Cgroup-scoped; quota labeled when known."));
            metrics.add("mem_used_gb", trusted());
            metrics.add("mem_total_gb", trusted());
            metrics.add("mem_available_gb", misleading("Use container limit or Java heap instead."));
        } else if ("container".equals(deployment)) {
            metrics.add("host_cpu_pct", misleading("Host aggregate CPU reflects the whole machine, not your allocation."));
            metrics.add("mem_used_gb", unavailable("cgroup_unreadable"));
            metrics.add("mem_total_gb", unavailable("cgroup_unreadable"));
            metrics.add("mem_available_gb", misleading("Use Java heap headroom instead of host MemAvailable."));
        } else if ("vps".equals(deployment)) {
            metrics.add("host_cpu_pct", approximate("Reflects the whole VM, not just this game server."));
            metrics.add("mem_used_gb", approximate("Reflects the whole VM when cgroup limits are unknown."));
            metrics.add("mem_total_gb", approximate("Reflects the whole VM when cgroup limits are unknown."));
            metrics.add("mem_available_gb", approximate("Host MemAvailable — shared with other services on the VM."));
        } else {
            metrics.add("host_cpu_pct", trusted());
            metrics.add("mem_used_gb", approximate("Derived from /proc/meminfo when cgroup limits are unknown."));
            metrics.add("mem_total_gb", approximate("Derived from /proc/meminfo when cgroup limits are unknown."));
            metrics.add("mem_available_gb", trusted());
        }

        if (docker) {
            metrics.add("thermal", unavailable("docker_container"));
        } else {
            metrics.add("thermal", approximate("Host sensor — may not reflect JVM load."));
        }
        metrics.add("network", approximate(null));
        metrics.add("backups", depends(null));
        metrics.add("disk_use_pct", approximate("Filesystem usage for the server data path."));
        return metrics;
    }

    public static boolean shouldShowContextBanner(JsonObject hostEnvironment, boolean bannerEnabled) {
        if (!bannerEnabled || hostEnvironment == null) {
            return false;
        }
        String deployment = hostEnvironment.has("deployment")
                ? hostEnvironment.get("deployment").getAsString() : "unknown";
        if (!"bare_metal".equals(deployment)) {
            return true;
        }
        JsonObject metrics = hostEnvironment.has("metrics")
                ? hostEnvironment.getAsJsonObject("metrics") : null;
        if (metrics == null) {
            return false;
        }
        for (String key : metrics.keySet()) {
            JsonObject m = metrics.getAsJsonObject(key);
            if (m != null && "misleading".equals(m.get("status").getAsString())) {
                return true;
            }
        }
        return false;
    }

    private static JsonObject trusted() {
        return status("trusted", null, null);
    }

    private static JsonObject approximate(String note) {
        return status("approximate", note, null);
    }

    private static JsonObject misleading(String note) {
        return status("misleading", note, null);
    }

    private static JsonObject unavailable(String reason) {
        return status("unavailable", null, reason);
    }

    private static JsonObject depends(String note) {
        return status("depends", note, null);
    }

    private static JsonObject status(String status, String note, String reason) {
        JsonObject o = new JsonObject();
        o.addProperty("status", status);
        String displayLabel = displayLabelFor(status);
        if (displayLabel != null) {
            o.addProperty("display_label", displayLabel);
        }
        if (note != null) {
            o.addProperty("note", note);
        }
        if (reason != null) {
            o.addProperty("reason", reason);
        }
        return o;
    }

    private static String displayLabelFor(String status) {
        return switch (status) {
            case "misleading" -> "Scoped";
            case "approximate" -> "Approximate";
            case "unavailable" -> "Unavailable";
            default -> null;
        };
    }
}
