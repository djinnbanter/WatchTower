package dev.mcstatus.watchtower;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.analyze.ExternalKillDetector;
import dev.mcstatus.watchtower.core.collect.CgroupProbe;
import dev.mcstatus.watchtower.core.collect.KernelOomProbe;
import dev.mcstatus.watchtower.core.ops.OpsCacheReader;
import dev.mcstatus.watchtower.core.ops.OpsCacheSchema;
import dev.mcstatus.watchtower.core.ops.OpsCacheWriter;
import dev.mcstatus.watchtower.core.report.ReportConfig;
import dev.mcstatus.watchtower.core.report.StateManager;
import dev.mcstatus.watchtower.runtime.ModRuntime;
import dev.mcstatus.watchtower.runtime.ServerContext;

import java.nio.file.Path;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Once per server start: after a short settle delay, run external-kill post-mortem
 * against the previous session heartbeat in state.json.
 */
public final class ExternalKillPostmortemScheduler {

    private static final int DELAY_SEC = 45;
    private static final int RECENT_MAX = 5;
    private static final AtomicBoolean STARTED = new AtomicBoolean(false);
    private static ScheduledExecutorService exec;

    private ExternalKillPostmortemScheduler() {
    }

    public static void start(ServerContext server) {
        if (server == null || !STARTED.compareAndSet(false, true)) {
            return;
        }
        ReportConfig config;
        try {
            config = ModReportConfig.forServer(server);
        } catch (Exception e) {
            STARTED.set(false);
            return;
        }
        if (!config.externalKillDetectEnabled()) {
            STARTED.set(false);
            return;
        }
        exec = Executors.newSingleThreadScheduledExecutor(r -> {
            Thread t = new Thread(r, "watchtower-external-kill-postmortem");
            t.setDaemon(true);
            return t;
        });
        exec.schedule(() -> {
            try {
                runOnce(server);
            } catch (Exception e) {
                try {
                    ModRuntime.logger().debug("External-kill postmortem failed: {}", e.toString());
                } catch (Exception ignored) {
                }
            }
        }, DELAY_SEC, TimeUnit.SECONDS);
    }

    public static void stop() {
        STARTED.set(false);
        if (exec != null) {
            exec.shutdownNow();
            exec = null;
        }
    }

    static void runOnce(ServerContext server) throws Exception {
        Path statePath = WatchtowerPaths.statePath(server);
        Path opsPath = WatchtowerPaths.opsCachePath(server);
        JsonObject prevSession = StateManager.getExternalKillSession(statePath);
        String prevBootAt = str(prevSession, "boot_at");

        String lastAlive = str(prevSession, "last_alive_at");
        String since = lastAlive;
        if (since == null || since.isBlank()) {
            since = Instant.now().minus(1, ChronoUnit.HOURS).toString();
        } else {
            try {
                since = Instant.parse(lastAlive).minus(10, ChronoUnit.MINUTES).toString();
            } catch (Exception ignored) {
            }
        }

        KernelOomProbe.Result kernel = KernelOomProbe.probe(since);
        long cgroupNow = CgroupProbe.oomKillCount();
        JsonArray panelKills = extractPanelKillEvents(opsPath);

        String nowIso = Instant.now().toString();
        JsonObject verdict = ExternalKillDetector.detect(
                prevSession,
                server.serverDirectory(),
                kernel,
                cgroupNow,
                panelKills,
                nowIso);

        if (ExternalKillDetector.isVerdict(verdict)) {
            OpsCacheWriter.mutate(opsPath, cache -> {
                JsonArray recent = new JsonArray();
                if (cache.has(OpsCacheSchema.EXTERNAL_KILL)
                        && cache.get(OpsCacheSchema.EXTERNAL_KILL).isJsonObject()) {
                    JsonObject prior = cache.getAsJsonObject(OpsCacheSchema.EXTERNAL_KILL);
                    // Push prior top-level verdict onto recent (without nested recent)
                    JsonObject priorCopy = prior.deepCopy();
                    priorCopy.remove(OpsCacheSchema.EXTERNAL_KILL_RECENT);
                    recent.add(priorCopy);
                    if (prior.has(OpsCacheSchema.EXTERNAL_KILL_RECENT)
                            && prior.get(OpsCacheSchema.EXTERNAL_KILL_RECENT).isJsonArray()) {
                        for (JsonElement el : prior.getAsJsonArray(OpsCacheSchema.EXTERNAL_KILL_RECENT)) {
                            if (recent.size() >= RECENT_MAX) {
                                break;
                            }
                            recent.add(el.deepCopy());
                        }
                    }
                }
                while (recent.size() > RECENT_MAX) {
                    recent.remove(recent.size() - 1);
                }
                verdict.add(OpsCacheSchema.EXTERNAL_KILL_RECENT, recent);
                cache.add(OpsCacheSchema.EXTERNAL_KILL, verdict);
            });
            try {
                OpsScanService.refreshIssuesLive(server);
            } catch (Exception ignored) {
            }
        }

        // Always roll the session forward so we don't re-analyse this boot.
        JsonObject next = new JsonObject();
        next.addProperty("boot_at", nowIso);
        next.add("clean_stop_at", null);
        if (prevBootAt != null && !prevBootAt.isBlank()) {
            next.addProperty("postmortem_for", prevBootAt);
        } else {
            next.addProperty("postmortem_for", nowIso);
        }
        next.addProperty("last_alive_at", nowIso);
        next.addProperty("cgroup_oom_kill", cgroupNow);
        StateManager.updateExternalKillSession(statePath, next);
    }

    private static JsonArray extractPanelKillEvents(Path opsPath) {
        JsonArray out = new JsonArray();
        try {
            JsonObject cache = OpsCacheReader.load(opsPath);
            if (cache.has(OpsCacheSchema.ACTIVITY) && cache.get(OpsCacheSchema.ACTIVITY).isJsonObject()) {
                JsonObject act = cache.getAsJsonObject(OpsCacheSchema.ACTIVITY);
                if (act.has(OpsCacheSchema.ACTIVITY_EVENTS) && act.get(OpsCacheSchema.ACTIVITY_EVENTS).isJsonArray()) {
                    for (JsonElement el : act.getAsJsonArray(OpsCacheSchema.ACTIVITY_EVENTS)) {
                        if (!el.isJsonObject()) {
                            continue;
                        }
                        JsonObject ev = el.getAsJsonObject();
                        String type = str(ev, "type");
                        String detail = str(ev, "detail");
                        if ("panel_command".equals(type)
                                && detail != null
                                && detail.toLowerCase().contains("kill")) {
                            out.add(ev.deepCopy());
                        }
                    }
                }
            }
            if (cache.has("crafty_commands") && cache.get("crafty_commands").isJsonArray()) {
                for (JsonElement el : cache.getAsJsonArray("crafty_commands")) {
                    if (!el.isJsonObject()) {
                        continue;
                    }
                    JsonObject cmd = el.getAsJsonObject();
                    String msg = str(cmd, "message");
                    if (msg == null) {
                        msg = str(cmd, "action");
                    }
                    if (msg != null && msg.toLowerCase().contains("kill_server")) {
                        out.add(cmd.deepCopy());
                    }
                }
            }
        } catch (Exception ignored) {
        }
        return out;
    }

    private static String str(JsonObject o, String key) {
        if (o == null || !o.has(key) || o.get(key).isJsonNull()) {
            return null;
        }
        try {
            return o.get(key).getAsString();
        } catch (Exception e) {
            return null;
        }
    }
}
