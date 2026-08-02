package dev.mcstatus.watchtower.core.analyze;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.report.SupportRedactor;
import dev.mcstatus.watchtower.core.util.TimeParse;

import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Enrich join-rejection scanner rows against the server's mod inventory (1.1.10).
 * Read-only — never touches {@code mods/}.
 */
public final class JoinClinicAnalyzer {

    public static final int MAX_ENTRIES = 25;
    public static final int RETENTION_DAYS = 7;

    private static final DateTimeFormatter ISO = DateTimeFormatter.ISO_OFFSET_DATE_TIME;
    private static final Pattern VERSION_PAIR = Pattern.compile(
            "\\b([a-z0-9_.-]+)@([0-9][\\w.+-]*)\\s+required.*?client has\\s+([0-9][\\w.+-]*)",
            Pattern.CASE_INSENSITIVE);

    private JoinClinicAnalyzer() {
    }

    /**
     * Enrich raw rejection rows against the current ops-cache inventory snapshot.
     *
     * @param rawRows list of scanner rows
     * @param cache   full ops-cache root (for running_mods, mods_inventory, mods_light)
     * @param prev    previous join_clinic block (may be null) for merge/retention
     */
    public static JsonObject analyze(List<JsonObject> rawRows, JsonObject cache, JsonObject prev) {
        if (cache == null) {
            cache = new JsonObject();
        }
        Map<String, ServerMod> serverMods = loadServerMods(cache);
        Map<String, String> clientOnlyBuckets = loadClientOnlyBuckets(cache);
        boolean vsKnownGood = hasJarDrift(cache);

        Map<String, JsonObject> byKey = new LinkedHashMap<>();
        if (prev != null && prev.has("entries") && prev.get("entries").isJsonArray()) {
            for (JsonElement el : prev.getAsJsonArray("entries")) {
                if (!el.isJsonObject()) {
                    continue;
                }
                JsonObject e = el.getAsJsonObject();
                String key = str(e, "key");
                if (!key.isBlank()) {
                    byKey.put(key, e.deepCopy());
                }
            }
        }

        int newCount = 0;
        List<JsonObject> incoming = rawRows != null ? rawRows : List.of();
        for (JsonObject raw : incoming) {
            if (raw == null) {
                continue;
            }
            JsonObject entry = enrich(raw, serverMods, clientOnlyBuckets, vsKnownGood);
            String key = str(entry, "key");
            if (key.isBlank()) {
                continue;
            }
            byKey.put(key, entry);
            newCount++;
        }

        long cutoff = Instant.now().getEpochSecond() - (long) RETENTION_DAYS * 86400L;
        List<JsonObject> sorted = new ArrayList<>(byKey.values());
        sorted.sort((a, b) -> str(b, "time").compareTo(str(a, "time")));

        JsonArray entries = new JsonArray();
        for (JsonObject e : sorted) {
            if (entries.size() >= MAX_ENTRIES) {
                break;
            }
            Instant t = TimeParse.parseTime(str(e, "time"));
            if (t != null && t.getEpochSecond() < cutoff) {
                continue;
            }
            if (!e.has("fix_copy") || str(e, "fix_copy").isBlank()) {
                e.addProperty("fix_copy", buildPlayerSafeCopy(e));
            }
            entries.add(e);
        }

        JsonObject block = new JsonObject();
        block.addProperty("scanned_at", Instant.now().atOffset(ZoneOffset.UTC).format(ISO));
        block.addProperty("new_count", newCount);
        block.add("entries", entries);
        return block;
    }

    /** Player-safe Discord/plain text for one entry (already redacted). */
    public static String buildPlayerSafeCopy(JsonObject entry) {
        if (entry == null) {
            return "";
        }
        String player = str(entry, "player");
        String kind = str(entry, "kind");
        String kindLabel = switch (kind) {
            case "mismatched_channel" -> "mismatched channels";
            case "missing_mod" -> "missing mods";
            case "wrong_version" -> "wrong mod versions";
            case "registry" -> "registry mismatch";
            default -> "pack sync mismatch";
        };
        StringBuilder sb = new StringBuilder();
        if (!player.isBlank()) {
            sb.append("Hey ").append(player).append(" — the server rejected your join (")
                    .append(kindLabel).append(").\n\n");
        } else {
            sb.append("The server rejected a join (").append(kindLabel).append(").\n\n");
        }

        JsonArray missing = array(entry, "missing");
        JsonArray wrong = array(entry, "wrong_version");
        JsonArray extra = array(entry, "extra");

        if (missing.size() > 0 || wrong.size() > 0) {
            sb.append("Install/update on your client:\n");
            for (JsonElement el : missing) {
                if (!el.isJsonObject()) {
                    continue;
                }
                JsonObject m = el.getAsJsonObject();
                String id = str(m, "mod_id");
                String ver = str(m, "server_version");
                if (id.isBlank()) {
                    continue;
                }
                if (!ver.isBlank()) {
                    sb.append("- ").append(id).append(" (server has ").append(ver).append(")\n");
                } else {
                    sb.append("- ").append(id).append('\n');
                }
            }
            for (JsonElement el : wrong) {
                if (!el.isJsonObject()) {
                    continue;
                }
                JsonObject m = el.getAsJsonObject();
                String id = str(m, "mod_id");
                String want = str(m, "server_version");
                String have = str(m, "client_version");
                if (id.isBlank()) {
                    continue;
                }
                sb.append("- ").append(id);
                if (!want.isBlank()) {
                    sb.append(" → need ").append(want);
                }
                if (!have.isBlank()) {
                    sb.append(" (you have ").append(have).append(')');
                }
                sb.append('\n');
            }
            sb.append('\n');
        }
        if (extra.size() > 0) {
            sb.append("Remove these client-only extras (not on the server):\n");
            for (JsonElement el : extra) {
                if (!el.isJsonObject()) {
                    continue;
                }
                String id = str(el.getAsJsonObject(), "mod_id");
                if (!id.isBlank()) {
                    sb.append("- ").append(id).append('\n');
                }
            }
            sb.append('\n');
        }
        if (entry.has("vs_known_good") && entry.get("vs_known_good").getAsBoolean()) {
            sb.append("Note: server jars have drifted since the last baseline — confirm the pack pin with an admin.\n\n");
        }
        sb.append("Ask the admin if you need the pack download.");
        return SupportRedactor.redactText(sb.toString());
    }

    private static JsonObject enrich(
            JsonObject raw,
            Map<String, ServerMod> serverMods,
            Map<String, String> clientOnlyBuckets,
            boolean vsKnownGood
    ) {
        String kind = str(raw, "kind");
        String player = str(raw, "player");
        List<String> modIds = new ArrayList<>();
        if (raw.has("mod_ids") && raw.get("mod_ids").isJsonArray()) {
            for (JsonElement el : raw.getAsJsonArray("mod_ids")) {
                if (el.isJsonPrimitive()) {
                    String id = el.getAsString().strip().toLowerCase(Locale.ROOT);
                    if (!id.isEmpty()) {
                        modIds.add(id);
                    }
                }
            }
        }

        JsonArray missing = new JsonArray();
        JsonArray extra = new JsonArray();
        JsonArray wrongVersion = new JsonArray();
        JsonArray suppressed = new JsonArray();

        Map<String, String[]> versionHints = parseVersionHints(str(raw, "reason") + " " + str(raw, "sample_line"));

        for (String id : modIds) {
            if (versionHints.containsKey(id)) {
                String[] pair = versionHints.get(id);
                JsonObject w = new JsonObject();
                w.addProperty("mod_id", id);
                if (pair[0] != null && !pair[0].isBlank()) {
                    w.addProperty("server_version", pair[0]);
                }
                if (pair[1] != null && !pair[1].isBlank()) {
                    w.addProperty("client_version", pair[1]);
                }
                if (serverMods.containsKey(id) && !strObj(serverMods.get(id).version).isBlank()) {
                    w.addProperty("server_version", serverMods.get(id).version);
                }
                wrongVersion.add(w);
                continue;
            }
            if (serverMods.containsKey(id)) {
                ServerMod sm = serverMods.get(id);
                JsonObject m = new JsonObject();
                m.addProperty("mod_id", id);
                if (!strObj(sm.version).isBlank()) {
                    m.addProperty("server_version", sm.version);
                }
                if (!strObj(sm.displayName).isBlank()) {
                    m.addProperty("display_name", sm.displayName);
                }
                missing.add(m);
            } else if (clientOnlyBuckets.containsKey(id)) {
                JsonObject s = new JsonObject();
                s.addProperty("mod_id", id);
                s.addProperty("bucket", clientOnlyBuckets.get(id));
                suppressed.add(s);
            } else {
                JsonObject e = new JsonObject();
                e.addProperty("mod_id", id);
                extra.add(e);
            }
        }

        String key = kind + "|" + player + "|" + String.join(",", modIds);
        JsonObject entry = new JsonObject();
        entry.addProperty("key", key);
        entry.addProperty("kind", kind);
        entry.addProperty("platform", str(raw, "platform"));
        if (!player.isBlank()) {
            entry.addProperty("player", player);
        }
        entry.addProperty("time", str(raw, "time"));
        entry.addProperty("confidence", str(raw, "confidence"));
        entry.addProperty("reason", str(raw, "reason"));
        entry.addProperty("sample_line", str(raw, "sample_line"));
        entry.add("missing", missing);
        entry.add("extra", extra);
        entry.add("wrong_version", wrongVersion);
        entry.add("suppressed_client_only", suppressed);
        entry.addProperty("vs_known_good", vsKnownGood);
        entry.addProperty("fix_copy", buildPlayerSafeCopy(entry));
        return entry;
    }

    private static Map<String, String[]> parseVersionHints(String text) {
        Map<String, String[]> out = new HashMap<>();
        if (text == null || text.isBlank()) {
            return out;
        }
        Matcher m = VERSION_PAIR.matcher(text);
        while (m.find()) {
            String id = m.group(1).toLowerCase(Locale.ROOT);
            out.put(id, new String[]{m.group(2), m.group(3)});
        }
        return out;
    }

    private static Map<String, ServerMod> loadServerMods(JsonObject cache) {
        Map<String, ServerMod> out = new LinkedHashMap<>();
        if (cache.has("running_mods") && cache.get("running_mods").isJsonObject()) {
            JsonObject block = cache.getAsJsonObject("running_mods");
            if (block.has("mods") && block.get("mods").isJsonArray()) {
                for (JsonElement el : block.getAsJsonArray("mods")) {
                    if (!el.isJsonObject()) {
                        continue;
                    }
                    JsonObject m = el.getAsJsonObject();
                    String id = str(m, "id");
                    if (id.isBlank()) {
                        id = str(m, "mod_id");
                    }
                    if (id.isBlank()) {
                        continue;
                    }
                    out.put(id.toLowerCase(Locale.ROOT), new ServerMod(
                            id.toLowerCase(Locale.ROOT),
                            str(m, "version"),
                            str(m, "display_name")));
                }
            }
        }
        if (!out.isEmpty()) {
            return out;
        }
        if (cache.has("mods_inventory") && cache.get("mods_inventory").isJsonObject()) {
            JsonObject inv = cache.getAsJsonObject("mods_inventory");
            JsonArray rows = null;
            if (inv.has("current") && inv.get("current").isJsonArray()) {
                rows = inv.getAsJsonArray("current");
            } else if (inv.has("snapshot") && inv.get("snapshot").isJsonArray()) {
                rows = inv.getAsJsonArray("snapshot");
            } else if (inv.has("mods") && inv.get("mods").isJsonArray()) {
                rows = inv.getAsJsonArray("mods");
            }
            if (rows != null) {
                for (JsonElement el : rows) {
                    if (!el.isJsonObject()) {
                        continue;
                    }
                    JsonObject m = el.getAsJsonObject();
                    String id = str(m, "mod_id");
                    if (id.isBlank()) {
                        id = str(m, "id");
                    }
                    if (id.isBlank()) {
                        continue;
                    }
                    out.put(id.toLowerCase(Locale.ROOT), new ServerMod(
                            id.toLowerCase(Locale.ROOT),
                            str(m, "version"),
                            str(m, "display_name")));
                }
            }
        }
        return out;
    }

    private static Map<String, String> loadClientOnlyBuckets(JsonObject cache) {
        Map<String, String> out = new HashMap<>();
        addClientOnlyFromArray(out, clientOnlyEntries(cache));
        return out;
    }

    private static JsonArray clientOnlyEntries(JsonObject cache) {
        if (cache.has("mods_light") && cache.get("mods_light").isJsonObject()) {
            JsonObject light = cache.getAsJsonObject("mods_light");
            if (light.has("client_only_mods") && light.get("client_only_mods").isJsonArray()) {
                return light.getAsJsonArray("client_only_mods");
            }
        }
        if (cache.has("modrinth_scan") && cache.get("modrinth_scan").isJsonObject()) {
            JsonObject scan = cache.getAsJsonObject("modrinth_scan");
            if (scan.has("client_only_mods") && scan.get("client_only_mods").isJsonArray()) {
                return scan.getAsJsonArray("client_only_mods");
            }
        }
        return new JsonArray();
    }

    private static void addClientOnlyFromArray(Map<String, String> out, JsonArray entries) {
        for (JsonElement el : entries) {
            if (!el.isJsonObject()) {
                continue;
            }
            JsonObject e = el.getAsJsonObject();
            String bucket = str(e, "bucket");
            if (bucket.isBlank()) {
                bucket = str(e, "side_score");
            }
            if (!"likely_removable".equals(bucket) && !"client_library".equals(bucket)) {
                continue;
            }
            String modId = str(e, "mod_id");
            if (modId.isBlank()) {
                modId = str(e, "id");
            }
            if (!modId.isBlank()) {
                out.put(modId.toLowerCase(Locale.ROOT), bucket);
            }
        }
    }

    private static boolean hasJarDrift(JsonObject cache) {
        if (!cache.has("mods_inventory") || !cache.get("mods_inventory").isJsonObject()) {
            return false;
        }
        JsonObject inv = cache.getAsJsonObject("mods_inventory");
        if (!inv.has("diff") || !inv.get("diff").isJsonObject()) {
            return false;
        }
        JsonObject diff = inv.getAsJsonObject("diff");
        if (diff.has("drift_count")) {
            try {
                return diff.get("drift_count").getAsInt() > 0;
            } catch (Exception ignored) {
                // fall through
            }
        }
        return diff.has("drift") && diff.get("drift").isJsonArray()
                && diff.getAsJsonArray("drift").size() > 0;
    }

    private record ServerMod(String id, String version, String displayName) {
    }

    private static String str(JsonObject o, String k) {
        if (o == null || !o.has(k) || o.get(k).isJsonNull()) {
            return "";
        }
        try {
            return o.get(k).getAsString();
        } catch (Exception e) {
            return "";
        }
    }

    private static String strObj(String s) {
        return s == null ? "" : s;
    }

    private static JsonArray array(JsonObject o, String k) {
        if (o != null && o.has(k) && o.get(k).isJsonArray()) {
            return o.getAsJsonArray(k);
        }
        return new JsonArray();
    }
}
