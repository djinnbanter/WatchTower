package dev.mcstatus.watchtower.core.rules;

import java.util.List;
import java.util.Map;

/**
 * Public schema facade for crash rule packs (CA-26 / WT-035).
 */
public final class CrashRuleSchema {

    public static final int VERSION = CrashRuleModels.SCHEMA_VERSION;
    public static final int MAX_REGEX_CHARS = CrashRuleModels.MAX_REGEX_CHARS;
    public static final int MAX_RULES_PER_PACK = CrashRuleModels.MAX_RULES_PER_PACK;
    public static final int MAX_PACKS = CrashRuleModels.MAX_PACKS;

    private CrashRuleSchema() {
    }

    public static CrashRuleValidator.Result validate(String yamlText) {
        return CrashRuleValidator.validate(yamlText);
    }

    public static CrashRuleValidator.Result validate(Map<String, Object> raw) {
        return CrashRuleValidator.validate(raw);
    }

    public static CrashRuleModels.CrashRulePack parsePack(String yamlText, String source, boolean builtin) {
        Map<String, Object> raw = CrashRuleYaml.parseRaw(yamlText);
        CrashRuleValidator.Result vr = CrashRuleValidator.validate(raw);
        if (!vr.valid()) {
            throw new IllegalArgumentException(String.join("; ", vr.errors()));
        }
        return CrashRuleYaml.toPack(raw, source, builtin);
    }

    public static List<String> allowedWhenKeys() {
        return List.of("all", "any", "source", "regex", "mod_present", "mod_absent", "log_type", "field");
    }
}
