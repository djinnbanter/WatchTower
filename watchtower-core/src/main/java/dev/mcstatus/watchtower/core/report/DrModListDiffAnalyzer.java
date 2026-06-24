package dev.mcstatus.watchtower.core.report;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Compares mod sets from baseline (last successful start) vs latest failed attempt logs.
 */
public final class DrModListDiffAnalyzer {

    private DrModListDiffAnalyzer() {
    }

    public record ModChange(
            String id,
            String changeType,
            String fromVersion,
            String toVersion,
            String file,
            int line
    ) {
    }

    public record ModDiffResult(
            DrModListFromLogParser.ParsedModList baseline,
            DrModListFromLogParser.ParsedModList latest,
            List<ModChange> added,
            List<ModChange> removed,
            List<ModChange> updated,
            boolean hasChanges
    ) {
    }

    public static ModDiffResult analyze(DrLogFileSelector.DrLogSelection selection) {
        DrModListFromLogParser.ParsedModList baseline = null;
        DrLogAnchorFinder.LogAnchor anchor = selection.anchor();
        if (anchor.found() && anchor.sourcePath() != null) {
            baseline = DrModListFromLogParser.parse(anchor.sourcePath(), anchor.zipEntryPath());
        }

        DrModListFromLogParser.ParsedModList latest = null;
        List<DrLogFileSelector.SelectedLogFile> regular = selection.regular();
        if (!regular.isEmpty()) {
            DrLogFileSelector.SelectedLogFile last = regular.get(regular.size() - 1);
            latest = DrModListFromLogParser.parse(last.sourcePath(), last.zipEntryPath());
        }

        if (baseline == null || latest == null) {
            return new ModDiffResult(baseline, latest, List.of(), List.of(), List.of(), false);
        }

        Map<String, DrModListFromLogParser.ModEntry> baseMods = baseline.mods();
        Map<String, DrModListFromLogParser.ModEntry> latestMods = latest.mods();

        List<ModChange> added = new ArrayList<>();
        List<ModChange> removed = new ArrayList<>();
        List<ModChange> updated = new ArrayList<>();

        for (Map.Entry<String, DrModListFromLogParser.ModEntry> e : latestMods.entrySet()) {
            if (!baseMods.containsKey(e.getKey())) {
                DrModListFromLogParser.ModEntry m = e.getValue();
                added.add(new ModChange(m.id(), "added", null, m.version(), m.sourceFile(), m.line()));
            }
        }
        for (Map.Entry<String, DrModListFromLogParser.ModEntry> e : baseMods.entrySet()) {
            if (!latestMods.containsKey(e.getKey())) {
                DrModListFromLogParser.ModEntry m = e.getValue();
                removed.add(new ModChange(m.id(), "removed", m.version(), null, m.sourceFile(), m.line()));
            }
        }
        for (Map.Entry<String, DrModListFromLogParser.ModEntry> e : latestMods.entrySet()) {
            DrModListFromLogParser.ModEntry base = baseMods.get(e.getKey());
            if (base == null) {
                continue;
            }
            String bv = base.version();
            String lv = e.getValue().version();
            if (bv != null && lv != null && !bv.equals(lv)) {
                DrModListFromLogParser.ModEntry m = e.getValue();
                updated.add(new ModChange(m.id(), "updated", bv, lv, m.sourceFile(), m.line()));
            }
        }

        boolean hasChanges = !added.isEmpty() || !removed.isEmpty() || !updated.isEmpty();
        return new ModDiffResult(baseline, latest, added, removed, updated, hasChanges);
    }

    public static JsonObject toJson(ModDiffResult result, DrLogAnchorFinder.LogAnchor anchor) {
        JsonObject o = new JsonObject();
        if (anchor.found()) {
            JsonObject src = new JsonObject();
            src.addProperty("file", anchor.zipEntryPath());
            src.addProperty("line", anchor.line());
            if (anchor.anchorTime() != null) {
                src.addProperty("time", anchor.anchorTime().toString());
            }
            o.add("baseline_source", src);
        }
        o.add("added", changesJson(result.added()));
        o.add("removed", changesJson(result.removed()));
        o.add("updated", changesJson(result.updated()));
        o.addProperty("has_changes", result.hasChanges());
        return o;
    }

    private static JsonArray changesJson(List<ModChange> changes) {
        JsonArray arr = new JsonArray();
        for (ModChange c : changes) {
            JsonObject o = new JsonObject();
            o.addProperty("id", c.id());
            o.addProperty("change", c.changeType());
            if (c.fromVersion() != null) {
                o.addProperty("from", c.fromVersion());
            }
            if (c.toVersion() != null) {
                o.addProperty("to", c.toVersion());
            }
            JsonObject ev = new JsonObject();
            ev.addProperty("file", c.file());
            ev.addProperty("line", c.line());
            o.add("first_seen", ev);
            arr.add(o);
        }
        return arr;
    }

    public static void applyToFacts(com.google.gson.JsonObject facts, ModDiffResult diff, DrLogAnchorFinder.LogAnchor anchor) {
        if (facts == null) {
            return;
        }
        com.google.gson.JsonObject optional = facts.has("optional") && facts.get("optional").isJsonObject()
                ? facts.getAsJsonObject("optional")
                : new com.google.gson.JsonObject();
        optional.add("dr_mod_diff", toJson(diff, anchor));
        facts.add("optional", optional);

        if (!diff.hasChanges()) {
            return;
        }

        Set<String> failedMods = new HashSet<>();
        if (facts.has("issues") && facts.get("issues").isJsonArray()) {
            for (var el : facts.getAsJsonArray("issues")) {
                if (el.isJsonObject() && el.getAsJsonObject().has("message")) {
                    String msg = el.getAsJsonObject().get("message").getAsString().toLowerCase();
                    for (ModChange c : diff.added()) {
                        if (msg.contains(c.id())) {
                            failedMods.add(c.id());
                        }
                    }
                    for (ModChange c : diff.updated()) {
                        if (msg.contains(c.id())) {
                            failedMods.add(c.id());
                        }
                    }
                }
            }
        }

        String severity = failedMods.isEmpty() ? "warning" : "critical";
        StringBuilder msg = new StringBuilder("Mod set changed since last successful start: ");
        if (!diff.added().isEmpty()) {
            msg.append('+').append(diff.added().size()).append(" added ");
        }
        if (!diff.removed().isEmpty()) {
            msg.append('-').append(diff.removed().size()).append(" removed ");
        }
        if (!diff.updated().isEmpty()) {
            msg.append('~').append(diff.updated().size()).append(" updated");
        }

        JsonArray evidence = new JsonArray();
        for (ModChange c : concat(diff.added(), diff.removed(), diff.updated())) {
            if (evidence.size() >= 5) {
                break;
            }
            JsonObject ev = new JsonObject();
            ev.addProperty("file", c.file());
            ev.addProperty("line", c.line());
            ev.addProperty("quote", c.id() + " " + c.changeType());
            evidence.add(ev);
        }

        DrCrashLoopAnalyzer.addDrIssue(facts, "MOD_SET_CHANGED", severity, msg.toString().strip(),
                List.of("Review added/removed/updated mods since the last successful boot.",
                        "Revert recent mod changes and restart the server."),
                evidence);
    }

    @SafeVarargs
    private static List<ModChange> concat(List<ModChange>... lists) {
        List<ModChange> all = new ArrayList<>();
        for (List<ModChange> l : lists) {
            all.addAll(l);
        }
        return all;
    }
}
