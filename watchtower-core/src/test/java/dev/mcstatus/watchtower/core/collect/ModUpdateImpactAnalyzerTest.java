package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class ModUpdateImpactAnalyzerTest {

    @Test
    void needInstallBlockerEmitsProjectAndVersionIdsForInstallCta() {
        JsonArray mods = new JsonArray();
        mods.add(mod("create", "6.0.0", null));

        JsonArray updates = new JsonArray();
        JsonObject row = new JsonObject();
        row.addProperty("mod_id", "create");
        row.addProperty("latest_compatible", "6.0.1");
        updates.add(row);

        Map<String, ModrinthLookupService.SideInfo> byId = new HashMap<>();
        byId.put("create", sideWithDeps("create",
                List.of(new ModrinthLookupService.VersionDependency(
                        "flywheelproj",
                        "flywheelVerAbc",
                        "required",
                        "Flywheel",
                        "flywheel"))));

        JsonArray enriched = ModUpdateImpactAnalyzer.enrich(mods, updates, byId);
        JsonObject blocker = enriched.get(0).getAsJsonObject()
                .getAsJsonArray("blockers").get(0).getAsJsonObject();

        assertEquals("need_install", blocker.get("kind").getAsString());
        assertEquals("Flywheel", blocker.get("display_name").getAsString());
        assertEquals("flywheel", blocker.get("mod_id").getAsString(),
                "mod_id should prefer Modrinth slug for Install CTA depModId");
        assertEquals("flywheelproj", blocker.get("project_id").getAsString());
        assertTrue(
                blocker.has("version_id") || blocker.has("modrinth_version_id"),
                "Install CTA needs version_id or modrinth_version_id");
        String versionId = blocker.has("version_id")
                ? blocker.get("version_id").getAsString()
                : blocker.get("modrinth_version_id").getAsString();
        assertEquals("flywheelVerAbc", versionId);
    }

    @Test
    void missingRequiredDependencyIsBreak() {
        JsonArray mods = new JsonArray();
        mods.add(mod("create", "6.0.0", null));

        JsonArray updates = new JsonArray();
        JsonObject row = new JsonObject();
        row.addProperty("mod_id", "create");
        row.addProperty("latest_compatible", "6.0.1");
        updates.add(row);

        Map<String, ModrinthLookupService.SideInfo> byId = new HashMap<>();
        byId.put("create", sideWithDeps("create",
                List.of(new ModrinthLookupService.VersionDependency(
                        "flywheelproj", null, "required", "Flywheel", "flywheel"))));

        JsonArray enriched = ModUpdateImpactAnalyzer.enrich(mods, updates, byId);
        JsonObject out = enriched.get(0).getAsJsonObject();
        assertEquals("break", out.get("impact_verdict").getAsString());
        assertTrue(out.getAsJsonArray("blockers").size() >= 1);
        JsonObject blocker = out.getAsJsonArray("blockers").get(0).getAsJsonObject();
        assertEquals("need_install", blocker.get("kind").getAsString());
        assertEquals("Flywheel", blocker.get("display_name").getAsString());
        assertEquals("flywheel", blocker.get("mod_id").getAsString());
    }

    @Test
    void incompatibleInstalledIsBreak() {
        JsonArray mods = new JsonArray();
        mods.add(mod("create", "6.0.0", "proj-create"));
        JsonObject bad = mod("oldlib", "1.0", "proj-old");
        mods.add(bad);

        JsonArray updates = new JsonArray();
        JsonObject row = new JsonObject();
        row.addProperty("mod_id", "create");
        row.addProperty("latest_compatible", "6.0.1");
        updates.add(row);

        Map<String, ModrinthLookupService.SideInfo> byId = new HashMap<>();
        byId.put("create", sideWithDeps("create",
                List.of(new ModrinthLookupService.VersionDependency("proj-old", null, "incompatible"))));
        byId.put("oldlib", new ModrinthLookupService.SideInfo(
                "proj-old", "oldlib", "unknown", "unknown", "Old", false));

        JsonArray enriched = ModUpdateImpactAnalyzer.enrich(mods, updates, byId);
        assertEquals("break", enriched.get(0).getAsJsonObject().get("impact_verdict").getAsString());
    }

    @Test
    void dependentRangeMismatchIsBreak() {
        JsonArray mods = new JsonArray();
        JsonObject create = mod("create", "6.0.0", "proj-create");
        mods.add(create);
        JsonObject addon = mod("createaddon", "1.0", null);
        JsonArray deps = new JsonArray();
        JsonObject dep = new JsonObject();
        dep.addProperty("modId", "create");
        dep.addProperty("mandatory", true);
        dep.addProperty("versionRange", "[6.0.0,6.0.0]");
        deps.add(dep);
        addon.add("dependencies", deps);
        mods.add(addon);

        JsonArray updates = new JsonArray();
        JsonObject row = new JsonObject();
        row.addProperty("mod_id", "create");
        row.addProperty("latest_compatible", "6.0.1");
        updates.add(row);

        Map<String, ModrinthLookupService.SideInfo> byId = new HashMap<>();
        byId.put("create", sideWithDeps("create", List.of()));

        JsonArray enriched = ModUpdateImpactAnalyzer.enrich(mods, updates, byId);
        JsonObject out = enriched.get(0).getAsJsonObject();
        assertEquals("break", out.get("impact_verdict").getAsString());
        assertTrue(out.getAsJsonArray("blockers").size() >= 1);
    }

    @Test
    void noDepsAndNoSignalsIsUnknown() {
        JsonArray mods = new JsonArray();
        mods.add(mod("jei", "1.0", "proj-jei"));

        JsonArray updates = new JsonArray();
        JsonObject row = new JsonObject();
        row.addProperty("mod_id", "jei");
        row.addProperty("latest_compatible", "1.1");
        updates.add(row);

        Map<String, ModrinthLookupService.SideInfo> byId = new HashMap<>();
        byId.put("jei", sideWithDeps("jei", List.of()));

        JsonArray enriched = ModUpdateImpactAnalyzer.enrich(mods, updates, byId);
        assertEquals("unknown", enriched.get(0).getAsJsonObject().get("impact_verdict").getAsString());
    }

    private static JsonObject mod(String id, String version, String projectId) {
        JsonObject m = new JsonObject();
        m.addProperty("id", id);
        m.addProperty("version", version);
        if (projectId != null) {
            m.addProperty("modrinth_project_id", projectId);
        }
        return m;
    }

    private static ModrinthLookupService.SideInfo sideWithDeps(
            String slug,
            List<ModrinthLookupService.VersionDependency> deps) {
        return new ModrinthLookupService.SideInfo(
                "proj-" + slug, slug, "optional", "required", slug, false,
                "old", "1.0", true, "new", "2.0", "https://modrinth.com/mod/" + slug,
                null, null, null, null, null, null, deps);
    }
}
