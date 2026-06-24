package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.panel.PanelLabels;
import dev.mcstatus.watchtower.core.panel.ProcessChecks;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.TimeUnit;

/**
 * Detects deployment context (bare metal, container, VPS) for metric trust labeling.
 */
public final class HostEnvironmentDetector {

    private static final Set<String> HOSTED_PANELS = Set.of(
            "pterodactyl", "pelican", "bloom", "crafty", "pufferpanel",
            "mcsmanager", "amp", "multicraft", "mineos", "discopanel", "docker"
    );

    private HostEnvironmentDetector() {
    }

    public static JsonObject detect(String panelId) {
        return detect(panelId, ProcessChecks.isDockerContainer(), CgroupProbe.cgroupMemoryReadable());
    }

    public static JsonObject detect(String panelId, JsonObject systemBasics) {
        JsonObject env = detect(panelId);
        enrichSummary(env, systemBasics);
        return env;
    }

    static JsonObject detect(String panelId, boolean docker, boolean cgroupMemory) {
        return detect(panelId, docker, cgroupMemory, detectVps());
    }

    static JsonObject detect(String panelId, boolean docker, boolean cgroupMemory, boolean virtualized) {
        String hosting = normalizePanel(panelId);
        String deployment = resolveDeployment(hosting, docker, virtualized);
        String confidence = resolveConfidence(hosting, docker, deployment);
        String summary = buildSummary(deployment, hosting);

        JsonObject env = new JsonObject();
        env.addProperty("deployment", deployment);
        env.addProperty("hosting", hosting);
        env.addProperty("confidence", confidence);
        env.addProperty("summary", summary);
        env.add("metrics", MetricTrustMatrix.buildMetrics(deployment, hosting, cgroupMemory, docker));
        return env;
    }

    /**
     * Replaces {@code summary} with a dynamic line built from cgroup limits and panel name when available.
     */
    public static void enrichSummary(JsonObject env, JsonObject systemBasics) {
        if (env == null) {
            return;
        }
        String enriched = buildEnrichedSummary(env, systemBasics);
        if (!enriched.isBlank()) {
            env.addProperty("summary", enriched);
        }
    }

    public static boolean isHostedContainer(String panelId) {
        String id = normalizePanel(panelId);
        if ("none".equals(id) || "unknown".equals(id)) {
            return ProcessChecks.isDockerContainer();
        }
        return HOSTED_PANELS.contains(id);
    }

    private static String normalizePanel(String panelId) {
        if (panelId == null || panelId.isBlank()) {
            return "unknown";
        }
        return panelId.strip().toLowerCase(Locale.ROOT);
    }

    private static String resolveDeployment(String hosting, boolean docker) {
        return resolveDeployment(hosting, docker, detectVps());
    }

    private static String resolveDeployment(String hosting, boolean docker, boolean virtualized) {
        if (docker || HOSTED_PANELS.contains(hosting)) {
            return "container";
        }
        if (virtualized) {
            return "vps";
        }
        if ("none".equals(hosting)) {
            return "bare_metal";
        }
        return "unknown";
    }

    private static String resolveConfidence(String hosting, boolean docker, String deployment) {
        if (docker && HOSTED_PANELS.contains(hosting)) {
            return "high";
        }
        if ("container".equals(deployment) && !"unknown".equals(hosting)) {
            return "high";
        }
        if ("bare_metal".equals(deployment)) {
            return "medium";
        }
        if ("none".equals(hosting) && !docker) {
            return "low";
        }
        return "medium";
    }

    private static String buildEnrichedSummary(JsonObject env, JsonObject systemBasics) {
        java.util.ArrayList<String> parts = new java.util.ArrayList<>();
        String hosting = env.has("hosting") ? env.get("hosting").getAsString() : "unknown";
        String panelName = PanelLabels.displayName(hosting);
        if (!"Native".equals(panelName) && !"Unknown".equals(panelName)) {
            parts.add(panelName);
        }

        Double limitCores = jsonDouble(systemBasics, "cpu_limit_cores");
        Integer cpuCount = jsonInt(systemBasics, "cpu_count");
        if (limitCores != null && cpuCount != null) {
            parts.add(String.format(Locale.US, "%.1f of %d cores allocated", limitCores, cpuCount));
        } else if (limitCores != null) {
            parts.add(String.format(Locale.US, "%.1f cores allocated", limitCores));
        } else if (cpuCount != null && cpuCount > 0) {
            parts.add(cpuCount + " cores visible");
        }

        Double memTotalGb = jsonDouble(systemBasics, "mem_total_gb");
        if (memTotalGb != null && systemBasics != null && "cgroup_v2".equals(strOrNull(systemBasics, "ram_source"))) {
            parts.add(String.format(Locale.US, "%.1f GB RAM limit", memTotalGb));
        } else if (memTotalGb != null && systemBasics != null && "cgroup_v1".equals(strOrNull(systemBasics, "ram_source"))) {
            parts.add(String.format(Locale.US, "%.1f GB RAM limit", memTotalGb));
        }

        if (limitCores != null) {
            parts.add("CPU % is vs quota");
        }

        if (parts.isEmpty()) {
            return env.has("summary") ? env.get("summary").getAsString() : "";
        }
        return String.join(" · ", parts);
    }

    private static String buildSummary(String deployment, String hosting) {
        if ("container".equals(deployment)) {
            String name = PanelLabels.displayName(hosting);
            if ("Native".equals(name) || "Unknown".equals(name)) {
                return "Game server runs in a container — interpret host CPU/RAM with care.";
            }
            return "Game server runs on " + name + " — interpret host CPU/RAM with care.";
        }
        if ("vps".equals(deployment)) {
            return "Game server runs on a VPS — host metrics may reflect the whole VM.";
        }
        if ("bare_metal".equals(deployment)) {
            return "Game server appears to run directly on the host.";
        }
        return "Deployment context is unclear — verify CPU and RAM readings manually.";
    }

    private static boolean detectVps() {
        try {
            Process proc = new ProcessBuilder("systemd-detect-virt", "-q")
                    .redirectErrorStream(true)
                    .start();
            if (!proc.waitFor(2, TimeUnit.SECONDS)) {
                proc.destroyForcibly();
                return false;
            }
            return proc.exitValue() == 0;
        } catch (Exception e) {
            return readDmiProductIndicatesVm();
        }
    }

    private static Double jsonDouble(JsonObject o, String key) {
        if (o == null || !o.has(key) || o.get(key).isJsonNull()) {
            return null;
        }
        return o.get(key).getAsDouble();
    }

    private static Integer jsonInt(JsonObject o, String key) {
        if (o == null || !o.has(key) || o.get(key).isJsonNull()) {
            return null;
        }
        return o.get(key).getAsInt();
    }

    private static String strOrNull(JsonObject o, String key) {
        if (o == null || !o.has(key) || o.get(key).isJsonNull()) {
            return null;
        }
        return o.get(key).getAsString();
    }

    private static boolean readDmiProductIndicatesVm() {
        Path product = Path.of("/sys/class/dmi/id/product_name");
        if (!Files.isRegularFile(product)) {
            return false;
        }
        try {
            String name = Files.readString(product, StandardCharsets.UTF_8).toLowerCase(Locale.ROOT);
            return name.contains("kvm") || name.contains("vmware") || name.contains("virtual")
                    || name.contains("qemu") || name.contains("xen");
        } catch (Exception e) {
            return false;
        }
    }
}
