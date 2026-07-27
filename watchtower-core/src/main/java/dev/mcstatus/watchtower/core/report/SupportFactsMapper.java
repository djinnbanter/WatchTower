package dev.mcstatus.watchtower.core.report;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.ops.IssuesLiveRecord;
import dev.mcstatus.watchtower.core.ops.IssuesLiveStore;
import dev.mcstatus.watchtower.core.ops.OpsCacheSchema;

import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

/**
 * Maps continuous ops-cache blocks into a facts-shaped JSON for support compose only.
 * BAU dashboard must never treat this as the master facts file.
 */
public final class SupportFactsMapper {

    private SupportFactsMapper() {
    }

    public record Context(
            String serverDir,
            String hostname,
            String loader,
            String panel,
            boolean javaRunning,
            int logStaleMinutes,
            String modVersion,
            String minecraftVersion
    ) {
        public Context(
                String serverDir,
                String hostname,
                String loader,
                String panel,
                boolean javaRunning,
                int logStaleMinutes
        ) {
            this(serverDir, hostname, loader, panel, javaRunning, logStaleMinutes, null, null);
        }
    }

    public static JsonObject fromOpsCache(JsonObject ops, Context ctx) {
        JsonObject facts = new JsonObject();
        facts.add("meta", buildMeta(ctx));
        facts.add("health", buildHealth(ops, ctx));
        facts.add("minecraft", buildMinecraft(ops));
        facts.add("issues", buildIssues(ops));
        facts.add("events", buildEvents(ops));
        facts.add("optional", buildOptional(ops));
        JsonObject thresholds = new JsonObject();
        thresholds.addProperty("log_stale_minutes", ctx.logStaleMinutes());
        facts.add("thresholds", thresholds);
        return facts;
    }

    private static JsonObject buildMeta(Context ctx) {
        JsonObject meta = new JsonObject();
        meta.addProperty("generated", ZonedDateTime.now().format(DateTimeFormatter.ISO_OFFSET_DATE_TIME));
        meta.addProperty("hostname", ctx.hostname() != null ? ctx.hostname() : "unknown");
        meta.addProperty("server_dir", ctx.serverDir() != null ? ctx.serverDir() : "");
        meta.addProperty("loader", ctx.loader() != null ? ctx.loader() : "unknown");
        meta.addProperty("panel", ctx.panel() != null ? ctx.panel() : "unknown");
        meta.addProperty("report_mode", "support_compose");
        meta.addProperty("source", "continuous_ops");
        if (ctx.modVersion() != null && !ctx.modVersion().isBlank()) {
            meta.addProperty("mod_version", ctx.modVersion());
        }
        if (ctx.minecraftVersion() != null && !ctx.minecraftVersion().isBlank()) {
            meta.addProperty("minecraft_version", ctx.minecraftVersion());
        }
        return meta;
    }

    private static JsonObject buildHealth(JsonObject ops, Context ctx) {
        JsonObject health = new JsonObject();
        health.addProperty("java_running", ctx.javaRunning());
        String status = deriveStatus(ops);
        health.addProperty("status", status);
        health.addProperty("current_status", status);
        if (ops.has(OpsCacheSchema.LOG_STALE) && ops.get(OpsCacheSchema.LOG_STALE).isJsonObject()) {
            JsonObject ls = ops.getAsJsonObject(OpsCacheSchema.LOG_STALE);
            if (ls.has("gap_minutes")) {
                health.addProperty("log_gap_minutes", ls.get("gap_minutes").getAsDouble());
            }
            if (ls.has("active") && ls.get("active").getAsBoolean()) {
                health.addProperty("status_note", "Log output may be stale while Java is running.");
            }
        }
        if (ops.has("jvm_health") && ops.get("jvm_health").isJsonObject()) {
            health.add("jvm_health", ops.get("jvm_health").deepCopy());
        }
        if (ops.has("disk") && ops.get("disk").isJsonObject()) {
            health.add("disk", ops.get("disk").deepCopy());
        } else if (ops.has("disk_projection") && ops.get("disk_projection").isJsonObject()) {
            health.add("disk_projection", ops.get("disk_projection").deepCopy());
        }
        if (ops.has("backup") && ops.get("backup").isJsonObject()) {
            health.add("backup", ops.get("backup").deepCopy());
        } else if (ops.has("backups") && ops.get("backups").isJsonObject()) {
            health.add("backups", ops.get("backups").deepCopy());
        }
        return health;
    }

    private static String deriveStatus(JsonObject ops) {
        List<IssuesLiveRecord> active = IssuesLiveStore.activeOnly(IssuesLiveStore.readAll(ops));
        boolean critical = active.stream().anyMatch(r -> "critical".equalsIgnoreCase(r.severity()));
        boolean warning = active.stream().anyMatch(r -> "warning".equalsIgnoreCase(r.severity()));
        if (critical) {
            return "critical";
        }
        if (warning) {
            return "warning";
        }
        return "ok";
    }

    private static JsonObject buildMinecraft(JsonObject ops) {
        JsonObject mc = new JsonObject();
        if (ops.has("player_directory") && ops.get("player_directory").isJsonObject()) {
            JsonObject dir = ops.getAsJsonObject("player_directory");
            if (dir.has("online_count")) {
                mc.addProperty("players_online", dir.get("online_count").getAsInt());
            }
            if (dir.has("known_count")) {
                mc.addProperty("unique_players", dir.get("known_count").getAsInt());
            }
        }
        if (ops.has(OpsCacheSchema.RUNNING_MODS) && ops.get(OpsCacheSchema.RUNNING_MODS).isJsonObject()) {
            JsonObject rm = ops.getAsJsonObject(OpsCacheSchema.RUNNING_MODS);
            if (rm.has(OpsCacheSchema.RUNNING_MODS_COUNT)) {
                mc.addProperty("mod_count", rm.get(OpsCacheSchema.RUNNING_MODS_COUNT).getAsInt());
            }
        }
        if (ops.has(OpsCacheSchema.CRASHES) && ops.get(OpsCacheSchema.CRASHES).isJsonObject()) {
            JsonObject crashes = ops.getAsJsonObject(OpsCacheSchema.CRASHES);
            if (crashes.has(OpsCacheSchema.CRASHES_UNREVIEWED)) {
                mc.addProperty("unreviewed_crashes", crashes.get(OpsCacheSchema.CRASHES_UNREVIEWED).getAsInt());
            }
        }
        return mc;
    }

    private static JsonArray buildIssues(JsonObject ops) {
        JsonArray out = new JsonArray();
        for (IssuesLiveRecord r : IssuesLiveStore.activeOnly(IssuesLiveStore.readAll(ops))) {
            JsonObject issue = new JsonObject();
            issue.addProperty("id", r.id());
            issue.addProperty("severity", r.severity());
            issue.addProperty("message", r.message());
            if (!r.fixSteps().isEmpty()) {
                JsonArray steps = new JsonArray();
                r.fixSteps().forEach(steps::add);
                issue.add("fix_steps", steps);
            }
            out.add(issue);
        }
        return out;
    }

    private static JsonArray buildEvents(JsonObject ops) {
        JsonArray out = new JsonArray();
        if (!ops.has(OpsCacheSchema.ACTIVITY) || !ops.get(OpsCacheSchema.ACTIVITY).isJsonObject()) {
            return out;
        }
        JsonObject activity = ops.getAsJsonObject(OpsCacheSchema.ACTIVITY);
        if (!activity.has(OpsCacheSchema.ACTIVITY_EVENTS)) {
            return out;
        }
        int limit = 120;
        JsonArray events = activity.getAsJsonArray(OpsCacheSchema.ACTIVITY_EVENTS);
        for (int i = 0; i < events.size() && i < limit; i++) {
            JsonElement el = events.get(i);
            if (el.isJsonObject()) {
                out.add(el.getAsJsonObject().deepCopy());
            }
        }
        return out;
    }

    private static JsonObject buildOptional(JsonObject ops) {
        JsonObject optional = new JsonObject();
        optional.add("crash_summaries", crashSummaries(ops));
        if (ops.has(OpsCacheSchema.MOD_LOG_ERRORS) && ops.get(OpsCacheSchema.MOD_LOG_ERRORS).isJsonObject()) {
            JsonObject modLog = ops.getAsJsonObject(OpsCacheSchema.MOD_LOG_ERRORS);
            if (modLog.has(OpsCacheSchema.MOD_LOG_ENTRIES)) {
                JsonArray entries = modLog.getAsJsonArray(OpsCacheSchema.MOD_LOG_ENTRIES);
                JsonArray top = new JsonArray();
                int n = Math.min(25, entries.size());
                for (int i = 0; i < n; i++) {
                    top.add(entries.get(i).deepCopy());
                }
                optional.add("mod_log_errors", top);
            }
        }
        if (ops.has("startup_profile")) {
            optional.add("startup_profile", ops.get("startup_profile").deepCopy());
        }
        if (ops.has(OpsCacheSchema.MODS_DEEP)) {
            optional.add("mods_deep", ops.get(OpsCacheSchema.MODS_DEEP).deepCopy());
        }
        if (ops.has("player_directory")) {
            optional.add("player_directory", redactPlayerDirectory(ops.get("player_directory").deepCopy()));
        }
        if (ops.has(OpsCacheSchema.ISSUES_LIVE)) {
            optional.add(OpsCacheSchema.ISSUES_LIVE, ops.get(OpsCacheSchema.ISSUES_LIVE).deepCopy());
        }
        if (ops.has("sources") && ops.get("sources").isJsonObject()) {
            optional.add("sources", ops.get("sources").deepCopy());
        }
        if (ops.has("last_support_compose_at")) {
            optional.addProperty("last_support_compose_at", ops.get("last_support_compose_at").getAsString());
        }
        return optional;
    }

    private static JsonElement redactPlayerDirectory(JsonElement el) {
        if (!el.isJsonObject()) {
            return el;
        }
        JsonObject dir = el.getAsJsonObject();
        if (dir.has("players") && dir.get("players").isJsonArray()) {
            for (JsonElement p : dir.getAsJsonArray("players")) {
                if (p.isJsonObject()) {
                    JsonObject row = p.getAsJsonObject();
                    if (row.has("ip")) {
                        row.addProperty("ip", "[IP_REDACTED]");
                    }
                    if (row.has("last_ip")) {
                        row.addProperty("last_ip", "[IP_REDACTED]");
                    }
                }
            }
        }
        return dir;
    }

    private static JsonArray crashSummaries(JsonObject ops) {
        JsonArray out = new JsonArray();
        if (!ops.has(OpsCacheSchema.CRASHES) || !ops.get(OpsCacheSchema.CRASHES).isJsonObject()) {
            return out;
        }
        JsonObject crashes = ops.getAsJsonObject(OpsCacheSchema.CRASHES);
        if (!crashes.has(OpsCacheSchema.CRASHES_ENTRIES)) {
            return out;
        }
        int limit = 20;
        for (JsonElement el : crashes.getAsJsonArray(OpsCacheSchema.CRASHES_ENTRIES)) {
            if (!el.isJsonObject() || out.size() >= limit) {
                continue;
            }
            JsonObject row = el.getAsJsonObject();
            JsonObject summary = new JsonObject();
            if (row.has(OpsCacheSchema.ENTRY_FILE)) {
                summary.addProperty("file", row.get(OpsCacheSchema.ENTRY_FILE).getAsString());
            }
            if (row.has("plain_english")) {
                summary.addProperty("summary", row.get("plain_english").getAsString());
            } else if (row.has(OpsCacheSchema.ENTRY_DISPLAY_LABEL)) {
                summary.addProperty("summary", row.get(OpsCacheSchema.ENTRY_DISPLAY_LABEL).getAsString());
            }
            if (row.has("exception")) {
                summary.addProperty("exception", row.get("exception").getAsString());
            }
            if (row.has("primary_mod_id")) {
                summary.addProperty("mod_file", row.get("primary_mod_id").getAsString());
            }
            out.add(summary);
        }
        return out;
    }
}
