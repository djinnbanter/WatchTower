package dev.mcstatus.watchtower.core.analyze;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.collect.KernelOomProbe;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;

/**
 * Post-mortem detector for external JVM kills (OS OOM-killer or panel watchdog).
 * Pure verdict builder — no host I/O beyond an optional crash-reports mtime listing.
 */
public final class ExternalKillDetector {

    public static final String SUBTYPE_OOM = "oom";
    public static final String SUBTYPE_PANEL_WATCHDOG = "panel_watchdog";

    private static final Duration STALE_SESSION = Duration.ofDays(7);
    private static final Duration CRASH_WINDOW = Duration.ofSeconds(300);

    private ExternalKillDetector() {
    }

    /**
     * Detect an external kill from the previous session.
     *
     * @param prevSession previous {@code external_kill_session} from state.json (may be empty)
     * @param serverDir   server root (for crash-reports mtime check); may be null in unit tests
     * @param kernel      kernel OOM probe result
     * @param cgroupOomKillNow current cgroup {@code oom_kill} counter (-1 if unreadable)
     * @param panelKillEvents Crafty / panel kill events near the kill window (may be empty)
     * @param nowIso      ISO timestamp for {@code detected_at}
     * @return verdict object, or empty object when not detected
     */
    public static JsonObject detect(
            JsonObject prevSession,
            Path serverDir,
            KernelOomProbe.Result kernel,
            long cgroupOomKillNow,
            JsonArray panelKillEvents,
            String nowIso) {
        JsonObject empty = new JsonObject();
        if (prevSession == null || prevSession.size() == 0) {
            return empty;
        }
        String bootAt = str(prevSession, "boot_at");
        if (bootAt == null || bootAt.isBlank()) {
            return empty;
        }
        String postmortemFor = str(prevSession, "postmortem_for");
        if (postmortemFor != null && postmortemFor.equals(bootAt)) {
            return empty;
        }
        String cleanStopAt = str(prevSession, "clean_stop_at");
        if (cleanStopAt != null && !cleanStopAt.isBlank()) {
            return empty;
        }
        String lastAliveAt = str(prevSession, "last_alive_at");
        if (lastAliveAt == null || lastAliveAt.isBlank()) {
            return empty;
        }
        Instant killedAt;
        try {
            killedAt = Instant.parse(lastAliveAt);
        } catch (Exception e) {
            return empty;
        }
        Instant now;
        try {
            now = Instant.parse(nowIso);
        } catch (Exception e) {
            now = Instant.now();
        }
        if (Duration.between(killedAt, now).compareTo(STALE_SESSION) > 0) {
            return empty;
        }

        // Crash report in the kill window → existing crash pipeline owns it.
        if (hasCrashInWindow(serverDir, killedAt)) {
            return empty;
        }

        long sessionCgroup = longOr(prevSession, "cgroup_oom_kill", -1L);
        boolean kernelReadable = kernel != null && kernel.readable();
        JsonArray kernelEvidence = kernel != null && kernel.evidence() != null
                ? kernel.evidence() : new JsonArray();
        boolean hasKernelOom = kernelEvidence.size() > 0;
        boolean hasPanelKill = hasPanelKillInWindow(panelKillEvents, killedAt);

        String subtype;
        String confidence;
        JsonArray evidence = new JsonArray();

        if (cgroupOomKillNow >= 0 && sessionCgroup >= 0 && cgroupOomKillNow > sessionCgroup) {
            subtype = SUBTYPE_OOM;
            confidence = "high";
            JsonObject cg = new JsonObject();
            cg.addProperty("source", "cgroup");
            cg.addProperty("quote", "oom_kill " + sessionCgroup + " → " + cgroupOomKillNow);
            evidence.add(cg);
        } else if (hasKernelOom) {
            subtype = SUBTYPE_OOM;
            confidence = "high";
            evidence = kernelEvidence.deepCopy();
        } else if (hasPanelKill) {
            subtype = SUBTYPE_PANEL_WATCHDOG;
            confidence = "high";
            if (panelKillEvents != null) {
                evidence = panelKillEvents.deepCopy();
            }
        } else if (kernelReadable) {
            subtype = SUBTYPE_PANEL_WATCHDOG;
            confidence = "medium";
        } else {
            subtype = SUBTYPE_PANEL_WATCHDOG;
            confidence = "low";
        }

        // Suppressed (crash present) returns early above; empty "not detected" is size 0.
        // A real verdict always has failure_kind.
        return buildVerdict(subtype, confidence, kernelReadable, evidence, killedAt, bootAt, nowIso);
    }

    /**
     * True when the result is a real external-kill verdict (not empty, not suppressed).
     */
    public static boolean isVerdict(JsonObject result) {
        return result != null
                && result.has("failure_kind")
                && CrashClassifier.FK_EXTERNAL_KILL.equals(str(result, "failure_kind"));
    }

    private static JsonObject buildVerdict(
            String subtype,
            String confidence,
            boolean kernelReadable,
            JsonArray evidence,
            Instant killedAt,
            String bootAt,
            String nowIso) {
        JsonObject v = new JsonObject();
        v.addProperty("detected_at", nowIso);
        v.addProperty("killed_at", killedAt.toString());
        v.addProperty("failure_kind", CrashClassifier.FK_EXTERNAL_KILL);
        v.addProperty("subtype", subtype);
        v.addProperty("confidence", confidence);
        v.addProperty("kernel_log_readable", kernelReadable);
        v.addProperty("session_boot_at", bootAt);
        v.add("evidence", evidence != null ? evidence : new JsonArray());
        v.add("recent", new JsonArray());

        if (SUBTYPE_OOM.equals(subtype)) {
            v.addProperty("display_label", "Killed by the OS out-of-memory killer");
            v.addProperty("plain_english",
                    "The server process was killed from outside the JVM by the OS or container "
                            + "out-of-memory killer. There is no Minecraft crash report because the "
                            + "process was terminated by the host, not by a mod exception.");
            v.addProperty("likely_cause", "Container or host memory limit exceeded");
            v.add("fix_hints", CrashClassifier.hintsExternalKillOom());
        } else {
            v.addProperty("display_label", "Force-killed from outside the server");
            v.addProperty("plain_english",
                    "The server stopped abruptly with no clean shutdown and no Minecraft crash report. "
                            + "This usually means a hosting panel watchdog, stop timeout, or external "
                            + "SIGKILL terminated the process.");
            v.addProperty("likely_cause", "Panel watchdog or external force-kill");
            v.add("fix_hints", CrashClassifier.hintsExternalKillPanel(kernelReadable));
        }
        return v;
    }

    private static boolean hasCrashInWindow(Path serverDir, Instant killedAt) {
        if (serverDir == null) {
            return false;
        }
        Path crashDir = serverDir.resolve("crash-reports");
        if (!Files.isDirectory(crashDir)) {
            return false;
        }
        Instant lo = killedAt.minus(CRASH_WINDOW);
        Instant hi = killedAt.plus(CRASH_WINDOW);
        try (var stream = Files.list(crashDir)) {
            return stream
                    .filter(Files::isRegularFile)
                    .anyMatch(p -> {
                        try {
                            Instant m = Files.getLastModifiedTime(p).toInstant();
                            return !m.isBefore(lo) && !m.isAfter(hi);
                        } catch (IOException e) {
                            return false;
                        }
                    });
        } catch (IOException e) {
            return false;
        }
    }

    private static boolean hasPanelKillInWindow(JsonArray panelKillEvents, Instant killedAt) {
        if (panelKillEvents == null || panelKillEvents.size() == 0) {
            return false;
        }
        Instant lo = killedAt.minus(CRASH_WINDOW);
        Instant hi = killedAt.plus(Duration.ofMinutes(10));
        for (JsonElement el : panelKillEvents) {
            if (!el.isJsonObject()) {
                continue;
            }
            String time = str(el.getAsJsonObject(), "time");
            if (time == null) {
                time = str(el.getAsJsonObject(), "at");
            }
            if (time == null) {
                // Untimed kill event near an abrupt stop still counts as high-confidence panel signal.
                return true;
            }
            try {
                Instant t = Instant.parse(time);
                if (!t.isBefore(lo) && !t.isAfter(hi)) {
                    return true;
                }
            } catch (Exception ignored) {
                return true;
            }
        }
        return false;
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

    private static long longOr(JsonObject o, String key, long def) {
        if (o == null || !o.has(key) || o.get(key).isJsonNull()) {
            return def;
        }
        try {
            return o.get(key).getAsLong();
        } catch (Exception e) {
            return def;
        }
    }
}
