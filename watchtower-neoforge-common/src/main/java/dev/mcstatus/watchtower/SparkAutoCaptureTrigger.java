package dev.mcstatus.watchtower;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.collect.SparkCollectResult;
import dev.mcstatus.watchtower.core.collect.SparkCollector;
import dev.mcstatus.watchtower.core.collect.SparkPaths;
import dev.mcstatus.watchtower.core.collect.SparkProfileBuilder;
import dev.mcstatus.watchtower.core.collect.SparkProfileEntry;
import dev.mcstatus.watchtower.core.incident.IncidentWriter;
import dev.mcstatus.watchtower.core.ops.LagIssueBuilder;
import dev.mcstatus.watchtower.core.ops.OpsCacheWriter;
import dev.mcstatus.watchtower.core.report.ReportConfig;
import dev.mcstatus.watchtower.core.report.StateManager;
import dev.mcstatus.watchtower.runtime.ModRuntime;
import dev.mcstatus.watchtower.runtime.ServerContext;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Opt-in async Spark profiler capture after a critical lag incident.
 * Dispatches console commands; never uploads to lucko.me.
 */
public final class SparkAutoCaptureTrigger {

    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    private static final DateTimeFormatter ISO = DateTimeFormatter.ISO_OFFSET_DATE_TIME;
    private static final Set<String> VANILLA_MODS = Set.of("minecraft", "neoforge", "forge");
    private static final long FLUSH_GRACE_SEC = 4L;
    /** After a failed attempt, allow retry sooner than the full success cooldown. */
    static final long FAILURE_COOLDOWN_SEC = 60L;
    /** If the server tick never runs the start runnable, clear inFlight. */
    static final long START_WATCHDOG_SEC = 30L;

    private static final SparkAutoCaptureTrigger INSTANCE = new SparkAutoCaptureTrigger();

    private final ScheduledExecutorService executor = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread t = new Thread(r, "watchtower-spark-auto-capture");
        t.setDaemon(true);
        return t;
    });
    private final AtomicBoolean inFlight = new AtomicBoolean(false);

    private SparkAutoCaptureTrigger() {
    }

    public static SparkAutoCaptureTrigger get() {
        return INSTANCE;
    }

    /** Snapshot for dashboard status; capture lifecycle remains owned by this service. */
    public boolean isInFlight() {
        return inFlight.get();
    }

    /**
     * Schedule a capture after a critical lag incident was written.
     * Safe to call from the live-sample thread — work runs async.
     */
    public static void schedule(
            ServerContext server,
            String incidentId,
            ReportConfig config,
            Path statePath,
            Path opsCachePath,
            Path incidentsDir
    ) {
        get().scheduleInternal(server, incidentId, config, statePath, opsCachePath, incidentsDir);
    }

    void scheduleInternal(
            ServerContext server,
            String incidentId,
            ReportConfig config,
            Path statePath,
            Path opsCachePath,
            Path incidentsDir
    ) {
        if (server == null || config == null || incidentId == null || incidentId.isBlank()) {
            return;
        }
        if (!config.sparkAutoCaptureOnLag() || !config.sparkEnabled()) {
            return;
        }
        if (!server.isModLoaded("spark")) {
            ModRuntime.logger().debug("Spark auto-capture skipped — spark mod not loaded");
            return;
        }
        if (!inFlight.compareAndSet(false, true)) {
            return;
        }

        long now = Instant.now().getEpochSecond();
        try {
            long last = StateManager.getLastSparkAutoCaptureAt(statePath);
            if (now - last < Math.max(1, config.sparkAutoCaptureCooldownSec())) {
                inFlight.set(false);
                return;
            }
            // Tentative cooldown for storm control while in-flight; rolled back on failure.
            StateManager.setLastSparkAutoCaptureAt(statePath, now);
        } catch (Exception e) {
            inFlight.set(false);
            ModRuntime.logger().debug("Spark auto-capture cooldown check failed: {}", e.toString());
            return;
        }

        int windowSec = Math.max(5, Math.min(300, config.sparkAutoCaptureWindowSec()));
        Instant captureStart = Instant.now();
        ModRuntime.logger().info("Watchtower Spark auto-capture starting for incident {} ({}s window)",
                incidentId, windowSec);

        AtomicBoolean startAccepted = new AtomicBoolean(false);
        executor.schedule(() -> {
            if (startAccepted.get() || !inFlight.get()) {
                return;
            }
            ModRuntime.logger().warn("Spark auto-capture start watchdog fired for {} — server tick did not run start",
                    incidentId);
            finishFailed(config, incidentId, incidentsDir, opsCachePath, statePath,
                    windowSec, "spark profiler start timed out waiting for server tick");
        }, START_WATCHDOG_SEC, TimeUnit.SECONDS);

        server.execute(() -> {
            startAccepted.set(true);
            try {
                boolean started = server.runConsoleCommand("spark profiler start");
                if (!started) {
                    finishFailed(config, incidentId, incidentsDir, opsCachePath, statePath,
                            windowSec, "spark profiler start failed or already profiling");
                    return;
                }
                executor.schedule(
                        () -> completeCapture(server, config, incidentId, statePath, opsCachePath, incidentsDir,
                                captureStart, windowSec),
                        windowSec,
                        TimeUnit.SECONDS
                );
            } catch (Exception e) {
                ModRuntime.logger().warn("Spark auto-capture start threw for {}: {}", incidentId, e.toString());
                finishFailed(config, incidentId, incidentsDir, opsCachePath, statePath,
                        windowSec, e.toString());
            }
        });
    }

    private void completeCapture(
            ServerContext server,
            ReportConfig config,
            String incidentId,
            Path statePath,
            Path opsCachePath,
            Path incidentsDir,
            Instant captureStart,
            int windowSec
    ) {
        try {
            java.util.concurrent.CountDownLatch stopLatch = new java.util.concurrent.CountDownLatch(1);
            java.util.concurrent.atomic.AtomicBoolean stopOk = new java.util.concurrent.atomic.AtomicBoolean(false);
            server.execute(() -> {
                try {
                    stopOk.set(server.runConsoleCommand("spark profiler stop --save-to-file"));
                } finally {
                    stopLatch.countDown();
                }
            });
            if (!stopLatch.await(15, TimeUnit.SECONDS)) {
                ModRuntime.logger().warn("Spark auto-capture stop timed out for {}", incidentId);
            }
            try {
                Thread.sleep(FLUSH_GRACE_SEC * 1000L);
            } catch (InterruptedException ie) {
                Thread.currentThread().interrupt();
            }
            if (!stopOk.get()) {
                ModRuntime.logger().debug("Spark auto-capture stop returned false for {}", incidentId);
            }

            Instant windowEnd = Instant.now().plusSeconds(2);
            String serverDir = server.serverDirectory().toAbsolutePath().toString();
            Optional<SparkProfileEntry> found = SparkCollector.findNewestInMtimeWindow(
                    serverDir, config, captureStart.minusSeconds(2), windowEnd);

            if (found.isEmpty()) {
                patchIncident(config, incidentId, incidentsDir, opsCachePath, statePath,
                        windowSec, null, null, "failed",
                        "no new .sparkprofile found after stop");
                applyFailureCooldown(statePath, config);
                return;
            }

            SparkProfileEntry entry = found.get();
            String relativePath = entry.sourcePath();
            if (config.sparkAutoCaptureCopyToUpload()) {
                try {
                    relativePath = copyToUpload(server.serverDirectory(), config, entry, incidentId);
                } catch (Exception e) {
                    ModRuntime.logger().warn("Spark auto-capture copy failed, using original path: {}", e.toString());
                }
            }

            Optional<SparkCollectResult> collected = SparkCollector.readProfile(serverDir, config, relativePath);
            if (collected.isEmpty()) {
                patchIncident(config, incidentId, incidentsDir, opsCachePath, statePath,
                        windowSec, relativePath, null, "failed",
                        "could not parse spark profile");
                applyFailureCooldown(statePath, config);
                return;
            }

            JsonObject profile = SparkProfileBuilder.build(collected.get(), serverDir, config);
            JsonArray topMods = topNonVanillaMods(profile, 3);
            patchIncident(config, incidentId, incidentsDir, opsCachePath, statePath,
                    windowSec, relativePath, topMods, "ok", null);
            // Success: keep full cooldown written at schedule time (or refresh to now).
            try {
                StateManager.setLastSparkAutoCaptureAt(statePath, Instant.now().getEpochSecond());
            } catch (Exception e) {
                ModRuntime.logger().debug("Spark auto-capture success cooldown write failed: {}", e.toString());
            }
            ModRuntime.logger().info("Watchtower Spark auto-capture ok for incident {} → {}",
                    incidentId, relativePath);
        } catch (Exception e) {
            ModRuntime.logger().warn("Spark auto-capture failed for {}: {}", incidentId, e.toString());
            try {
                patchIncident(config, incidentId, incidentsDir, opsCachePath, statePath,
                        windowSec, null, null, "failed", e.toString());
            } catch (Exception ignored) {
                // leave incident as-is
            }
            applyFailureCooldown(statePath, config);
        } finally {
            inFlight.set(false);
        }
    }

    private void finishFailed(
            ReportConfig config,
            String incidentId,
            Path incidentsDir,
            Path opsCachePath,
            Path statePath,
            int windowSec,
            String error
    ) {
        try {
            patchIncident(config, incidentId, incidentsDir, opsCachePath, statePath,
                    windowSec, null, null, "failed", error);
        } catch (Exception e) {
            ModRuntime.logger().debug("Spark auto-capture fail patch: {}", e.toString());
        } finally {
            applyFailureCooldown(statePath, config);
            inFlight.set(false);
        }
    }

    /**
     * Shorten the remaining wait after a failed attempt so a bad start does not burn
     * the full success cooldown. Next attempt is allowed after {@link #FAILURE_COOLDOWN_SEC}.
     */
    static void applyFailureCooldown(Path statePath, ReportConfig config) {
        if (statePath == null || config == null) {
            return;
        }
        try {
            long cooldown = Math.max(1, config.sparkAutoCaptureCooldownSec());
            long adjusted = Instant.now().getEpochSecond() - cooldown + FAILURE_COOLDOWN_SEC;
            StateManager.setLastSparkAutoCaptureAt(statePath, Math.max(0L, adjusted));
        } catch (Exception e) {
            ModRuntime.logger().debug("Spark auto-capture failure cooldown write failed: {}", e.toString());
        }
    }

    static JsonArray topNonVanillaMods(JsonObject profile, int limit) {
        JsonArray out = new JsonArray();
        if (profile == null || limit <= 0) {
            return out;
        }
        JsonArray source = null;
        if (profile.has("mod_rollups") && profile.get("mod_rollups").isJsonArray()) {
            source = profile.getAsJsonArray("mod_rollups");
        } else if (profile.has("mod_hints") && profile.get("mod_hints").isJsonArray()) {
            source = profile.getAsJsonArray("mod_hints");
        }
        if (source == null) {
            return out;
        }
        java.util.ArrayList<JsonObject> rows = new java.util.ArrayList<>();
        for (var el : source) {
            if (!el.isJsonObject()) {
                continue;
            }
            JsonObject row = el.getAsJsonObject();
            String modId = row.has("mod_id") ? row.get("mod_id").getAsString() : "";
            if (modId.isBlank() || VANILLA_MODS.contains(modId.toLowerCase(Locale.ROOT))) {
                continue;
            }
            rows.add(row);
        }
        rows.sort((a, b) -> Double.compare(
                b.has("pct") ? b.get("pct").getAsDouble() : 0,
                a.has("pct") ? a.get("pct").getAsDouble() : 0));
        for (JsonObject row : rows) {
            JsonObject copy = new JsonObject();
            copy.addProperty("mod_id", row.get("mod_id").getAsString());
            if (row.has("pct")) {
                copy.addProperty("pct", row.get("pct").getAsDouble());
            }
            if (row.has("display_name")) {
                copy.addProperty("display_name", row.get("display_name").getAsString());
            }
            if (row.has("top_label")) {
                copy.addProperty("top_label", row.get("top_label").getAsString());
            } else if (row.has("summary")) {
                copy.addProperty("top_label", row.get("summary").getAsString());
            }
            out.add(copy);
            if (out.size() >= limit) {
                break;
            }
        }
        return out;
    }

    static String copyToUpload(Path serverRoot, ReportConfig config, SparkProfileEntry entry, String incidentId)
            throws Exception {
        Path root = serverRoot.toAbsolutePath().normalize();
        Path src = root.resolve(entry.sourcePath().replace('\\', '/')).normalize();
        if (!src.startsWith(root) || !Files.isRegularFile(src)) {
            throw new IllegalStateException("source missing or outside server root: " + entry.sourcePath());
        }
        Path uploadDir = SparkPaths.uploadDir(root, config);
        if (!uploadDir.startsWith(root)) {
            throw new IllegalStateException("upload dir escapes server root: " + uploadDir);
        }
        Files.createDirectories(uploadDir);
        String safeId = incidentId.replaceAll("[^A-Za-z0-9._-]", "_");
        Path dest = uploadDir.resolve("auto-" + safeId + ".sparkprofile").normalize();
        if (!dest.startsWith(uploadDir)) {
            throw new IllegalStateException("dest escapes upload dir");
        }
        Files.copy(src, dest, StandardCopyOption.REPLACE_EXISTING);
        return root.relativize(dest).toString().replace('\\', '/');
    }

    private void patchIncident(
            ReportConfig config,
            String incidentId,
            Path incidentsDir,
            Path opsCachePath,
            Path statePath,
            int windowSec,
            String profilePath,
            JsonArray topMods,
            String status,
            String error
    ) throws Exception {
        Path file = incidentsDir.resolve(incidentId + ".json");
        if (!Files.isRegularFile(file)) {
            return;
        }
        JsonObject incident = GSON.fromJson(Files.readString(file, StandardCharsets.UTF_8), JsonObject.class);
        if (incident == null) {
            return;
        }

        JsonObject auto = new JsonObject();
        auto.addProperty("status", status);
        auto.addProperty("window_sec", windowSec);
        auto.addProperty("captured_at", Instant.now().atOffset(ZoneOffset.UTC).format(ISO));
        if (profilePath != null) {
            auto.addProperty("spark_profile_path", profilePath);
            incident.addProperty("spark_profile_path", profilePath);
        }
        if (topMods != null) {
            auto.add("top_mods", topMods);
            incident.add("top_mods", topMods);
            if (!topMods.isEmpty()) {
                JsonObject top = topMods.get(0).getAsJsonObject();
                String modId = top.has("mod_id") ? top.get("mod_id").getAsString() : "";
                double pct = top.has("pct") ? top.get("pct").getAsDouble() : 0;
                String name = top.has("display_name") && !top.get("display_name").getAsString().isBlank()
                        ? top.get("display_name").getAsString()
                        : modId;
                // Match LagIssueBuilder.primarySuspect auto-profiled format
                incident.addProperty("primary_suspect",
                        String.format(Locale.ROOT, "%s ~%.0f%% (auto-profiled)", name, pct));
            }
        }
        if (error != null && !error.isBlank()) {
            auto.addProperty("error", error);
        }
        incident.add("spark_auto_capture", auto);

        IncidentWriter.write(incidentsDir, incident, config.incidentMaxFiles());

        JsonObject lagIssue = LagIssueBuilder.buildPeekEntry(incident);
        OpsCacheWriter.applyLagIncident(opsCachePath, statePath, incident, lagIssue, null);
    }

    /** Test seam: reset in-flight (unit tests only). */
    void resetInFlightForTests() {
        inFlight.set(false);
    }
}
