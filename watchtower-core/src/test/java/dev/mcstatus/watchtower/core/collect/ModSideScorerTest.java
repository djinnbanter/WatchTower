package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.report.ReportConfig;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class ModSideScorerTest {

    @Test
    void flagsKnownClientModAsLikelyRemovable() {
        JsonObject optional = new JsonObject();
        JsonArray mods = new JsonArray();
        JsonObject mod = new JsonObject();
        mod.addProperty("id", "modmenu");
        mod.addProperty("version", "1.0");
        mods.add(mod);
        optional.add("mods", mods);

        ModSideScorer.apply(optional, ReportConfig.builder().build(), "");
        JsonObject entry = optional.getAsJsonArray("client_only_mods").get(0).getAsJsonObject();
        assertEquals("likely_removable", entry.get("bucket").getAsString());
        assertEquals("medium", entry.get("confidence").getAsString());
        assertTrue(entry.has("signals"));
        assertEquals("likely_removable", mods.get(0).getAsJsonObject().get("side_score").getAsString());
        assertTrue(mods.get(0).getAsJsonObject().has("side_signals"));
        assertEquals(0, mods.get(0).getAsJsonObject().get("dependents_count").getAsInt());
    }

    @Test
    void createNeverSuggestedRemovableEvenWithClientSignals() {
        JsonObject optional = baseOptional(
                mod("create", "1.0", "Create", "Client rendering for contraptions"),
                mod("flywheel", "1.0", "Flywheel", "Client rendering engine"));
        JsonArray warnings = new JsonArray();
        warnings.add(warn("create", 10));
        warnings.add(warn("flywheel", 10));
        optional.add("client_class_warnings_by_mod", warnings);

        ModSideScorer.apply(optional, ReportConfig.builder().build(), "");
        assertFalse(containsClientOnly(optional, "create"));
        assertFalse(containsClientOnly(optional, "flywheel"));
        assertEquals("server_required", sideScore(optional, "create"));
        assertEquals("server_required", sideScore(optional, "flywheel"));
    }

    @Test
    void ponderProtectedWhenCreatePresentOtherwiseUncertain() {
        JsonObject withCreate = baseOptional(mod("create", "1.0"), mod("ponder", "1.0"));
        ModSideScorer.apply(withCreate, ReportConfig.builder().build(), "");
        assertFalse(containsClientOnly(withCreate, "ponder"));
        assertEquals("server_required", sideScore(withCreate, "ponder"));

        JsonObject withoutCreate = baseOptional(mod("ponder", "1.0"));
        ModSideScorer.apply(withoutCreate, ReportConfig.builder().build(), "");
        assertTrue(containsClientOnly(withoutCreate, "ponder"));
        assertEquals("uncertain", bucketOf(withoutCreate, "ponder"));
        assertNotEquals("likely_removable", bucketOf(withoutCreate, "ponder"));
    }

    @Test
    void xaeroHybridIsUncertainWithHybridReason() {
        JsonObject optional = baseOptional(mod("xaerominimap", "1.0"));
        ModSideScorer.apply(optional, ReportConfig.builder().build(), "");
        assertEquals("uncertain", bucketOf(optional, "xaerominimap"));
        String reason = optional.getAsJsonArray("client_only_mods").get(0).getAsJsonObject()
                .get("reason").getAsString();
        assertTrue(reason.contains("optional server component"));
    }

    @Test
    void protectionInheritsDependentsAndDependencies() {
        JsonObject create = mod("create", "1.0");
        JsonArray createDeps = new JsonArray();
        JsonObject dep = new JsonObject();
        dep.addProperty("modId", "somecorelib");
        dep.addProperty("mandatory", true);
        createDeps.add(dep);
        create.add("dependencies", createDeps);

        JsonObject railways = mod("railways", "1.0");
        JsonArray railDeps = new JsonArray();
        JsonObject cdep = new JsonObject();
        cdep.addProperty("modId", "create");
        cdep.addProperty("mandatory", true);
        railDeps.add(cdep);
        railways.add("dependencies", railDeps);

        JsonObject optional = baseOptional(create, mod("somecorelib", "1.0"), railways);
        ModSideScorer.apply(optional, ReportConfig.builder().build(), "");
        assertEquals("server_required", sideScore(optional, "railways"));
        assertEquals("server_required", sideScore(optional, "somecorelib"));
        assertFalse(containsClientOnly(optional, "railways"));
        assertFalse(containsClientOnly(optional, "somecorelib"));
    }

    @Test
    void ignoredClientModsExcludedFromListAndSummary() {
        JsonObject optional = baseOptional(mod("modmenu", "1.0"), mod("appleskin", "1.0"));
        JsonObject ignores = new JsonObject();
        ignores.addProperty("modmenu", true);
        optional.add("ignored_client_mods", ignores);

        ModSideScorer.apply(optional, ReportConfig.builder().build(), "");
        assertFalse(containsClientOnly(optional, "modmenu"));
        assertTrue(containsClientOnly(optional, "appleskin"));
        assertEquals("likely_removable", sideScore(optional, "modmenu"));
        assertEquals(1, optional.getAsJsonObject("client_only_mods_summary").get("detected").getAsInt());
    }

    @Test
    void lowSignalModLandsInTestRemove() {
        JsonObject optional = baseOptional(mod("unknownclientmod", "?"));
        ModSideScorer.apply(optional, ReportConfig.builder().build(), "");
        assertFalse(optional.has("client_only_mods"),
                "Mods with no client signals should not appear in client_only_mods");
    }

    @Test
    void mergeModrinthServerRequiredForcesProtection() {
        ModSideScorer.Score layer1 = new ModSideScorer.Score(
                ModSideScorer.Bucket.LIKELY_REMOVABLE,
                ModSideScorer.Confidence.MEDIUM,
                java.util.List.of("heuristic"),
                "guess",
                "advice");
        ModrinthLookupService.SideInfo info = new ModrinthLookupService.SideInfo(
                "p", "slug", "unsupported", "required", "Title", false);
        ModSideScorer.Score merged = ModSideScorer.mergeModrinth(layer1, info);
        assertEquals(ModSideScorer.Bucket.SERVER_REQUIRED, merged.bucket());
        assertTrue(merged.signals().contains("modrinth:server_required"));
    }

    @Test
    void mergeModrinthClientOnlyRaisesConfidence() {
        ModSideScorer.Score layer1 = new ModSideScorer.Score(
                ModSideScorer.Bucket.UNCERTAIN,
                ModSideScorer.Confidence.LOW,
                java.util.List.of("heuristic"),
                "guess",
                "advice");
        ModrinthLookupService.SideInfo info = new ModrinthLookupService.SideInfo(
                "p", "slug", "required", "unsupported", "Title", false);
        ModSideScorer.Score merged = ModSideScorer.mergeModrinth(layer1, info);
        assertEquals(ModSideScorer.Bucket.LIKELY_REMOVABLE, merged.bucket());
        assertEquals(ModSideScorer.Confidence.HIGH, merged.confidence());
        assertTrue(merged.signals().contains("modrinth:client_only"));
    }

    @Test
    void mergeModrinthOptionalBothKeepsLayer1() {
        ModSideScorer.Score layer1 = new ModSideScorer.Score(
                ModSideScorer.Bucket.UNCERTAIN,
                ModSideScorer.Confidence.MEDIUM,
                java.util.List.of("heuristic"),
                "hybrid",
                "advice");
        ModrinthLookupService.SideInfo info = new ModrinthLookupService.SideInfo(
                "p", "slug", "optional", "optional", "Title", false);
        ModSideScorer.Score merged = ModSideScorer.mergeModrinth(layer1, info);
        assertEquals(ModSideScorer.Bucket.UNCERTAIN, merged.bucket());
        assertTrue(merged.signals().contains("modrinth:optional_both"));
    }

    private static JsonObject baseOptional(JsonObject... mods) {
        JsonObject optional = new JsonObject();
        JsonArray arr = new JsonArray();
        for (JsonObject m : mods) {
            arr.add(m);
        }
        optional.add("mods", arr);
        return optional;
    }

    private static JsonObject mod(String id, String version) {
        return mod(id, version, null, null);
    }

    private static JsonObject mod(String id, String version, String display, String description) {
        JsonObject mod = new JsonObject();
        mod.addProperty("id", id);
        mod.addProperty("version", version);
        if (display != null) {
            mod.addProperty("display_name", display);
        }
        if (description != null) {
            mod.addProperty("description", description);
        }
        return mod;
    }

    private static JsonObject warn(String id, int count) {
        JsonObject w = new JsonObject();
        w.addProperty("mod_id", id);
        w.addProperty("count", count);
        return w;
    }

    private static boolean containsClientOnly(JsonObject optional, String id) {
        if (!optional.has("client_only_mods")) {
            return false;
        }
        for (var el : optional.getAsJsonArray("client_only_mods")) {
            if (id.equals(el.getAsJsonObject().get("mod_id").getAsString())) {
                return true;
            }
        }
        return false;
    }

    private static String bucketOf(JsonObject optional, String id) {
        for (var el : optional.getAsJsonArray("client_only_mods")) {
            JsonObject e = el.getAsJsonObject();
            if (id.equals(e.get("mod_id").getAsString())) {
                return e.get("bucket").getAsString();
            }
        }
        return null;
    }

    private static String sideScore(JsonObject optional, String id) {
        for (var el : optional.getAsJsonArray("mods")) {
            JsonObject m = el.getAsJsonObject();
            if (id.equals(m.get("id").getAsString())) {
                return m.has("side_score") ? m.get("side_score").getAsString() : null;
            }
        }
        return null;
    }
}
