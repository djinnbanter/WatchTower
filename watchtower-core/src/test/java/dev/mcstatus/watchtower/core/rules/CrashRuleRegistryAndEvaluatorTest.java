package dev.mcstatus.watchtower.core.rules;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.analyze.CrashClassifier;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CrashRuleRegistryAndEvaluatorTest {

    @TempDir
    Path temp;

    @Test
    void registryLoadsOperatorPackAndSkipsBadYaml() throws Exception {
        Path rules = temp.resolve("config/watchtower/rules");
        Files.createDirectories(rules);
        Files.writeString(rules.resolve("good.yaml"), """
                schema_version: 1
                pack: { id: op-pack, name: Op, priority: 200 }
                rules:
                  - id: kube-hit
                    priority: 100
                    when: { source: description, regex: "KubeJS startup" }
                    emit: { failure_kind: mod_load_script, primary_mod_id: kubejs }
                """, StandardCharsets.UTF_8);
        Files.writeString(rules.resolve("bad.yaml"), """
                schema_version: 1
                pack: { id: evil }
                rules:
                  - id: x
                    when: { exec: "boom" }
                """, StandardCharsets.UTF_8);

        CrashRuleRegistry reg = CrashRuleRegistry.load(temp, false, true);
        assertEquals(1, reg.packs().size());
        assertEquals("op-pack", reg.packs().get(0).id());
        assertFalse(reg.warnings().isEmpty());
    }

    @Test
    void evaluatorGoldenCreateAndWatchdog() throws Exception {
        Path rules = temp.resolve("config/watchtower/rules");
        Files.createDirectories(rules);
        Files.writeString(rules.resolve("create.yaml"), """
                schema_version: 1
                pack: { id: test-create, priority: 200 }
                rules:
                  - id: create-contraption-npe
                    priority: 200
                    when:
                      all:
                        - { source: crash_report, regex: "mf\\\\.axis is null" }
                        - { mod_present: create }
                    emit:
                      failure_kind: mod_runtime
                      primary_mod_id: create
                      override: false
                      fix_hints: ["Stop the assembly first"]
                """, StandardCharsets.UTF_8);
        CrashRuleRegistry reg = CrashRuleRegistry.load(temp, false, true);

        JsonObject crash = new JsonObject();
        crash.addProperty("summary", "mf.axis is null at ContinuousOBBCollider");
        crash.addProperty("description", "Exception: mf.axis is null");
        JsonArray mods = new JsonArray();
        JsonObject create = new JsonObject();
        create.addProperty("id", "create");
        mods.add(create);

        CrashClassifier.Classification unknown =
                new CrashClassifier.Classification("unknown", CrashClassifier.FK_UNKNOWN, null, null, null,
                        new JsonArray());
        CrashRuleEvaluator.EvalResult hit = CrashRuleEvaluator.evaluate(
                reg,
                CrashRuleEvaluator.EvalContext.of(crash, null, mods, new JsonArray(), "", "", ""),
                unknown);
        assertEquals(1, hit.hits().size());
        assertEquals("mod_runtime", hit.merged().failureKind());
        assertEquals("create", hit.merged().primaryModId());
        assertTrue(hit.merged().fixHints().toString().contains("Stop the assembly"));

        CrashClassifier.Classification watchdog =
                new CrashClassifier.Classification("mod", CrashClassifier.FK_WATCHDOG_PREGEN, null, "chunky",
                        "chunky", new JsonArray());
        CrashRuleEvaluator.EvalResult noOverride = CrashRuleEvaluator.evaluate(
                reg,
                CrashRuleEvaluator.EvalContext.of(crash, null, mods, new JsonArray(), "", "", ""),
                watchdog);
        assertEquals(1, noOverride.hits().size());
        assertEquals(CrashClassifier.FK_WATCHDOG_PREGEN, noOverride.merged().failureKind());
        assertFalse(noOverride.kindChanged());
    }

    @Test
    void builtinClasspathPackLoads() {
        CrashRuleRegistry reg = CrashRuleRegistry.load(null, true, false);
        assertTrue(reg.packs().stream().anyMatch(p -> "builtin".equals(p.id())),
                () -> "expected builtin pack, got " + reg.packs() + " warnings=" + reg.warnings());
        assertTrue(reg.findRule("builtin", "create-contraption-npe") != null);
    }

    @Test
    void packsDisabledLeavesClassificationUnchanged() {
        CrashRuleRegistry empty = CrashRuleRegistry.load(null, false, false);
        assertTrue(empty.packs().isEmpty());
        JsonObject crash = new JsonObject();
        crash.addProperty("summary", "mf.axis is null");
        CrashClassifier.Classification watchdog =
                new CrashClassifier.Classification("mod", CrashClassifier.FK_WATCHDOG_PREGEN, null, "chunky",
                        "chunky", new JsonArray());
        CrashRuleEvaluator.EvalResult r = CrashRuleEvaluator.evaluate(
                empty,
                CrashRuleEvaluator.EvalContext.of(crash, null, new JsonArray(), new JsonArray(), "", "", ""),
                watchdog);
        assertTrue(r.hits().isEmpty());
        assertEquals(CrashClassifier.FK_WATCHDOG_PREGEN, r.merged().failureKind());
        assertFalse(r.kindChanged());
    }

    @Test
    void suppressionHidesAndRestores() throws Exception {
        Path state = temp.resolve(".watchtower-state.json");
        Files.writeString(state, "{}", StandardCharsets.UTF_8);
        IssueSuppressionStore store = IssueSuppressionStore.load(state, "CLIENT_ON_SERVER", "");
        assertTrue(store.isSuppressed("CLIENT_ON_SERVER"));

        JsonArray issues = new JsonArray();
        JsonObject a = new JsonObject();
        a.addProperty("id", "CLIENT_ON_SERVER");
        a.addProperty("title", "Client mod");
        issues.add(a);
        JsonObject b = new JsonObject();
        b.addProperty("id", "DISK_HIGH");
        issues.add(b);

        assertEquals(1, store.filterActive(issues).size());
        assertEquals(1, store.filterSuppressedOnly(issues).size());

        IssueSuppressionStore emptyConf = IssueSuppressionStore.load(state, "", "");
        assertFalse(emptyConf.isSuppressed("LOOT_PARSE_SPAM"));
        assertTrue(emptyConf.suppress("LOOT_PARSE_SPAM", "test"));
        IssueSuppressionStore reloaded = IssueSuppressionStore.load(state, "", "");
        assertTrue(reloaded.isSuppressed("LOOT_PARSE_SPAM"));
        assertTrue(reloaded.unsuppress("LOOT_PARSE_SPAM"));
        assertFalse(IssueSuppressionStore.load(state, "", "").isSuppressed("LOOT_PARSE_SPAM"));
    }
}
