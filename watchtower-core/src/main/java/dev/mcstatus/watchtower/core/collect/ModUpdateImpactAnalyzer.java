package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Cross-checks a Modrinth-compatible update against the installed pack:
 * required/incompatible Modrinth deps, local TOML version ranges, and dependents.
 */
public final class ModUpdateImpactAnalyzer {

    private ModUpdateImpactAnalyzer() {
    }

    /**
     * Enrich each {@code optional.modrinth_updates[]} row with impact fields.
     *
     * @param mods  optional.mods[]
     * @param updates rows from {@link ModrinthLookupService#buildUpdatesSummary}
     * @param byModId Modrinth SideInfo keyed by local mod id (may be empty)
     */
    public static JsonArray enrich(
            JsonArray mods,
            JsonArray updates,
            Map<String, ModrinthLookupService.SideInfo> byModId) {
        if (updates == null || updates.isEmpty()) {
            return updates == null ? new JsonArray() : updates;
        }
        Map<String, JsonObject> modsById = indexMods(mods);
        Map<String, String> projectToModId = projectIndex(modsById, byModId);
        ModDependencyGraph graph = ModDependencyGraph.fromMods(mods);

        JsonArray out = new JsonArray();
        for (JsonElement el : updates) {
            if (!el.isJsonObject()) {
                continue;
            }
            JsonObject row = el.getAsJsonObject().deepCopy();
            String modId = str(row, "mod_id");
            if (modId == null) {
                out.add(row);
                continue;
            }
            JsonObject mod = modsById.get(modId);
            ModrinthLookupService.SideInfo info = byModId != null ? byModId.get(modId) : null;
            applyImpact(row, modId, mod, info, modsById, projectToModId, graph);
            out.add(row);
        }
        return out;
    }

    static void applyImpact(
            JsonObject row,
            String modId,
            JsonObject mod,
            ModrinthLookupService.SideInfo info,
            Map<String, JsonObject> modsById,
            Map<String, String> projectToModId,
            ModDependencyGraph graph) {
        List<JsonObject> blockers = new ArrayList<>();
        List<JsonObject> coUpdates = new ArrayList<>();
        List<JsonObject> dependents = new ArrayList<>();
        boolean hadUnknown = false;
        boolean hadModrinthDeps = info != null && info.compatibleDependencies() != null
                && !info.compatibleDependencies().isEmpty();

        if (info != null) {
            for (ModrinthLookupService.VersionDependency dep : info.compatibleDependencies()) {
                String type = dep.dependencyType() != null ? dep.dependencyType() : "";
                if ("embedded".equals(type) || "optional".equals(type)) {
                    continue;
                }
                String localId = resolveLocalId(dep, projectToModId, modsById);
                if ("required".equals(type)) {
                    if (localId == null) {
                        String modKey = (dep.slug() != null && !dep.slug().isBlank())
                                ? dep.slug()
                                : (dep.projectId() != null ? dep.projectId() : "unknown");
                        JsonObject b = blocker(
                                modKey,
                                displayNameForDep(dep, null, modsById),
                                "need_install",
                                "Required dependency is not installed in this pack.");
                        if (dep.projectId() != null && !dep.projectId().isBlank()) {
                            b.addProperty("project_id", dep.projectId());
                            b.addProperty("modrinth_project_id", dep.projectId());
                        }
                        if (dep.versionId() != null && !dep.versionId().isBlank()) {
                            b.addProperty("version_id", dep.versionId());
                            b.addProperty("modrinth_version_id", dep.versionId());
                        }
                        blockers.add(b);
                        continue;
                    }
                    JsonObject local = modsById.get(localId);
                    String installedVer = local != null ? str(local, "version") : null;
                    if (installedVer == null || "?".equals(installedVer)) {
                        hadUnknown = true;
                        coUpdates.add(coUpdate(localId, displayNameForMod(localId, modsById), installedVer, null,
                                "Required dependency is present but version is unknown."));
                    }
                } else if ("incompatible".equals(type)) {
                    if (localId != null) {
                        blockers.add(blocker(localId, displayNameForMod(localId, modsById), "conflict",
                                "Candidate update marks this mod as incompatible."));
                    }
                }
            }
        }

        // Dependents of the mod being updated — check their TOML versionRange on this mod
        if (graph != null) {
            for (String dependentId : graph.dependentsOf(modId)) {
                JsonObject depRow = new JsonObject();
                depRow.addProperty("mod_id", dependentId);
                String dependentName = displayNameForMod(dependentId, modsById);
                if (dependentName != null) {
                    depRow.addProperty("display_name", dependentName);
                }
                depRow.addProperty("mandatory", true);
                dependents.add(depRow);

                String range = findVersionRange(dependentId, modId, modsById);
                String candidateVer = str(row, "latest_compatible");
                if (range != null && candidateVer != null) {
                    ModVersionRange.Match match = ModVersionRange.parse(range).contains(candidateVer);
                    if (match == ModVersionRange.Match.NOT_SATISFIED) {
                        blockers.add(blocker(dependentId, displayNameForMod(dependentId, modsById), "need_co_update",
                                "Depends on " + displayNameForMod(modId, modsById) + " " + range + "; candidate "
                                        + candidateVer + " is outside that range."));
                        coUpdates.add(coUpdate(dependentId, displayNameForMod(dependentId, modsById),
                                str(modsById.get(dependentId), "version"),
                                null, "Update or replace so it accepts " + candidateVer + "."));
                    } else if (match == ModVersionRange.Match.UNKNOWN) {
                        hadUnknown = true;
                        coUpdates.add(coUpdate(dependentId, displayNameForMod(dependentId, modsById),
                                str(modsById.get(dependentId), "version"),
                                null, "Version range " + range + " could not be evaluated."));
                    }
                } else if (range != null) {
                    hadUnknown = true;
                } else {
                    // No range — informational retest
                    coUpdates.add(coUpdate(dependentId, displayNameForMod(dependentId, modsById),
                            str(modsById.get(dependentId), "version"),
                            null, "Depends on " + displayNameForMod(modId, modsById) + " — retest after updating."));
                }
            }
        }

        // Create ↔ Flywheel pairing
        String related = str(row, "related_pair");
        if (related != null && !related.isBlank()) {
            JsonObject partner = modsById.get(related);
            if (partner != null) {
                coUpdates.add(coUpdate(related, displayNameForMod(related, modsById), str(partner, "version"), null,
                        "Update " + displayNameForMod(related, modsById) + " together with "
                                + displayNameForMod(modId, modsById) + "."));
            } else {
                blockers.add(blocker(related, related, "need_install",
                        "Paired mod " + related + " is missing from the pack."));
            }
        }

        boolean hardBreak = blockers.stream().anyMatch(b -> {
            String kind = str(b, "kind");
            return "need_install".equals(kind) || "conflict".equals(kind) || "need_co_update".equals(kind);
        });
        // need_co_update is break per plan ("failed mandatory range")
        boolean caution = !hardBreak && (!coUpdates.isEmpty() || hadUnknown || dependents.size() > 0);

        String verdict;
        String confidence;
        String summary;
        if (!hadModrinthDeps && blockers.isEmpty() && related == null) {
            // No Modrinth deps and no other signals → unknown (never pretend Safe)
            if (dependents.isEmpty() && coUpdates.isEmpty()) {
                verdict = "unknown";
                confidence = "low";
                summary = "No dependency metadata for this candidate — verify manually before updating.";
            } else {
                verdict = "caution";
                confidence = "low";
                summary = "Other mods depend on this jar; Modrinth did not list dependencies for the candidate.";
            }
        } else if (hardBreak) {
            verdict = "break";
            confidence = hadUnknown ? "medium" : "high";
            summary = "This update likely breaks the pack without co-updates or installs.";
        } else if (caution || hadUnknown) {
            verdict = "caution";
            confidence = hadModrinthDeps ? "medium" : "low";
            summary = hadUnknown
                    ? "Update may be fine, but some version checks were inconclusive."
                    : "Update looks possible; review co-updates and dependents first.";
        } else {
            verdict = "safe";
            confidence = "high";
            summary = "No pack blockers found for this loader/MC-compatible update.";
        }

        // If we had Modrinth deps, all required present, no conflicts, no range failures → safe
        // even with informational dependents only — plan says dependents informational for safe.
        if ("caution".equals(verdict) && hadModrinthDeps && !hardBreak && !hadUnknown
                && coUpdates.stream().allMatch(c -> {
                    String d = str(c, "detail");
                    return d != null && d.contains("retest");
                })) {
            verdict = "safe";
            confidence = "high";
            summary = "No pack blockers found for this loader/MC-compatible update.";
        }

        row.addProperty("impact_verdict", verdict);
        row.addProperty("impact_summary", summary);
        row.addProperty("confidence", confidence);
        row.add("blockers", toArray(blockers));
        row.add("co_updates", toArray(dedupeByModId(coUpdates)));
        row.add("dependents", toArray(dependents));
    }

    private static List<JsonObject> dedupeByModId(List<JsonObject> rows) {
        Map<String, JsonObject> byId = new HashMap<>();
        for (JsonObject row : rows) {
            String id = str(row, "mod_id");
            if (id == null) {
                continue;
            }
            byId.putIfAbsent(id, row);
        }
        return new ArrayList<>(byId.values());
    }

    private static JsonArray toArray(List<JsonObject> rows) {
        JsonArray arr = new JsonArray();
        for (JsonObject row : rows) {
            arr.add(row);
        }
        return arr;
    }

    private static JsonObject blocker(String modId, String displayName, String kind, String detail) {
        JsonObject o = new JsonObject();
        o.addProperty("mod_id", modId);
        if (displayName != null && !displayName.isBlank()) {
            o.addProperty("display_name", displayName);
        }
        o.addProperty("kind", kind);
        o.addProperty("detail", detail);
        return o;
    }

    private static JsonObject coUpdate(String modId, String displayName, String current, String suggested, String detail) {
        JsonObject o = new JsonObject();
        o.addProperty("mod_id", modId);
        if (displayName != null && !displayName.isBlank()) {
            o.addProperty("display_name", displayName);
        }
        if (current != null) {
            o.addProperty("current", current);
        }
        if (suggested != null) {
            o.addProperty("suggested", suggested);
        }
        if (detail != null) {
            o.addProperty("detail", detail);
        }
        return o;
    }

    private static String displayNameForDep(
            ModrinthLookupService.VersionDependency dep,
            String localId,
            Map<String, JsonObject> modsById) {
        if (localId != null) {
            return displayNameForMod(localId, modsById);
        }
        if (dep == null) {
            return null;
        }
        String fromDep = dep.displayName();
        if (fromDep != null && !fromDep.isBlank()) {
            return fromDep;
        }
        return dep.projectId();
    }

    private static String displayNameForMod(String modId, Map<String, JsonObject> modsById) {
        if (modId == null) {
            return null;
        }
        JsonObject mod = modsById != null ? modsById.get(modId) : null;
        if (mod != null) {
            String title = str(mod, "modrinth_title");
            if (title != null && !title.isBlank()) {
                return title;
            }
            String display = str(mod, "display_name");
            if (display != null && !display.isBlank()) {
                return display;
            }
        }
        return modId;
    }

    private static String resolveLocalId(
            ModrinthLookupService.VersionDependency dep,
            Map<String, String> projectToModId,
            Map<String, JsonObject> modsById) {
        if (dep.projectId() != null) {
            String byProject = projectToModId.get(dep.projectId());
            if (byProject != null) {
                return byProject;
            }
        }
        // Heuristic: project id sometimes equals slug/mod id
        if (dep.projectId() != null && modsById.containsKey(dep.projectId())) {
            return dep.projectId();
        }
        if (dep.slug() != null && modsById.containsKey(dep.slug())) {
            return dep.slug();
        }
        return null;
    }

    /** Version range that {@code fromMod} declares on {@code towardMod}. */
    private static String findVersionRange(String fromMod, String towardMod, Map<String, JsonObject> modsById) {
        JsonObject mod = modsById.get(fromMod);
        if (mod == null || !mod.has("dependencies") || !mod.get("dependencies").isJsonArray()) {
            return null;
        }
        for (JsonElement el : mod.getAsJsonArray("dependencies")) {
            if (!el.isJsonObject()) {
                continue;
            }
            JsonObject d = el.getAsJsonObject();
            if (towardMod.equalsIgnoreCase(str(d, "modId"))) {
                return str(d, "versionRange");
            }
        }
        return null;
    }

    private static Map<String, JsonObject> indexMods(JsonArray mods) {
        Map<String, JsonObject> map = new HashMap<>();
        if (mods == null) {
            return map;
        }
        for (JsonElement el : mods) {
            if (!el.isJsonObject()) {
                continue;
            }
            JsonObject mod = el.getAsJsonObject();
            String id = str(mod, "id");
            if (id != null) {
                map.put(id, mod);
            }
        }
        return map;
    }

    private static Map<String, String> projectIndex(
            Map<String, JsonObject> modsById,
            Map<String, ModrinthLookupService.SideInfo> byModId) {
        Map<String, String> map = new HashMap<>();
        for (Map.Entry<String, JsonObject> e : modsById.entrySet()) {
            String projectId = str(e.getValue(), "modrinth_project_id");
            if (projectId != null) {
                map.put(projectId, e.getKey());
            }
            String slug = str(e.getValue(), "modrinth_slug");
            if (slug != null) {
                map.putIfAbsent(slug, e.getKey());
                map.putIfAbsent(slug.toLowerCase(Locale.ROOT), e.getKey());
            }
        }
        if (byModId != null) {
            for (Map.Entry<String, ModrinthLookupService.SideInfo> e : byModId.entrySet()) {
                if (e.getValue() != null && e.getValue().projectId() != null) {
                    map.putIfAbsent(e.getValue().projectId(), e.getKey());
                }
                if (e.getValue() != null && e.getValue().slug() != null) {
                    map.putIfAbsent(e.getValue().slug(), e.getKey());
                }
            }
        }
        return map;
    }

    private static String str(JsonObject o, String key) {
        if (o == null || !o.has(key) || o.get(key).isJsonNull()) {
            return null;
        }
        return o.get(key).getAsString();
    }
}
