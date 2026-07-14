package dev.mcstatus.watchtower.core.rules;

import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CrashRuleValidatorTest {

    private static final String VALID = """
            schema_version: 1
            pack: { id: test-pack, name: "Test", priority: 100 }
            rules:
              - id: create-npe
                priority: 200
                when:
                  all:
                    - { source: crash_report, regex: "mf\\\\.axis is null" }
                    - { mod_present: create }
                emit:
                  failure_kind: mod_runtime
                  primary_mod_id: create
                  confidence: high
                  fix_hints: ["Stop the assembly first"]
            """;

    @Test
    void validPackOk() {
        CrashRuleValidator.Result r = CrashRuleValidator.validate(VALID);
        assertTrue(r.valid(), () -> String.join("; ", r.errors()));
        Map<String, Object> raw = CrashRuleYaml.parseRaw(VALID);
        CrashRuleModels.CrashRulePack pack = CrashRuleYaml.toPack(raw, "test.yaml", false);
        assertTrue(pack.rules().size() == 1);
    }

    @Test
    void rejectsExec() {
        String yaml = """
                schema_version: 1
                pack: { id: bad, priority: 1 }
                rules:
                  - id: a
                    when: { mod_present: create }
                    emit:
                      exec: "rm -rf /"
                      failure_kind: mod_runtime
                """;
        CrashRuleValidator.Result r = CrashRuleValidator.validate(yaml);
        assertFalse(r.valid(), () -> String.join("; ", r.errors()));
        assertTrue(r.errors().stream().anyMatch(e -> e.toLowerCase().contains("exec")
                || e.toLowerCase().contains("forbidden")
                || e.toLowerCase().contains("unknown")),
                () -> String.join("; ", r.errors()));
    }

    @Test
    void rejectsJexlTopLevel() {
        String yaml = """
                schema_version: 1
                pack: { id: bad, priority: 1 }
                jexl: "1+1"
                rules:
                  - id: a
                    when: { mod_present: create }
                """;
        CrashRuleValidator.Result r = CrashRuleValidator.validate(yaml);
        assertFalse(r.valid());
        assertTrue(r.errors().stream().anyMatch(e -> e.toLowerCase().contains("jexl")
                || e.toLowerCase().contains("unknown")
                || e.toLowerCase().contains("forbidden")));
    }

    @Test
    void rejectsUnknownWhenKey() {
        String yaml = """
                schema_version: 1
                pack: { id: bad, priority: 1 }
                rules:
                  - id: a
                    when:
                      jsonpath: "$.foo"
                """;
        CrashRuleValidator.Result r = CrashRuleValidator.validate(yaml);
        assertFalse(r.valid());
        assertTrue(r.errors().stream().anyMatch(e -> e.contains("unknown") || e.contains("jsonpath")));
    }

    @Test
    void rejectsOversizedRegex() {
        String longRegex = "a".repeat(CrashRuleModels.MAX_REGEX_CHARS + 1);
        String yaml = """
                schema_version: 1
                pack: { id: bad, priority: 1 }
                rules:
                  - id: a
                    when: { source: crash_report, regex: "%s" }
                """.formatted(longRegex);
        CrashRuleValidator.Result r = CrashRuleValidator.validate(yaml);
        assertFalse(r.valid());
        assertTrue(r.errors().stream().anyMatch(e -> e.contains("regex") && e.contains("exceeds")));
    }

    @Test
    void rejectsHttpKey() {
        String yaml = """
                schema_version: 1
                pack: { id: bad, priority: 1 }
                rules:
                  - id: a
                    when: { http: "https://evil" }
                """;
        CrashRuleValidator.Result r = CrashRuleValidator.validate(yaml);
        assertFalse(r.valid());
    }
}
