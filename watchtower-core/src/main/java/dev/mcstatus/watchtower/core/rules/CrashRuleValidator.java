package dev.mcstatus.watchtower.core.rules;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.regex.PatternSyntaxException;

/**
 * Security-first validator for crash rule packs. Rejects exec/jexl/unknown keys before evaluate.
 */
public final class CrashRuleValidator {

    private static final Set<String> TOP_KEYS = Set.of("schema_version", "pack", "rules");
    private static final Set<String> PACK_KEYS = Set.of("id", "name", "priority");
    private static final Set<String> RULE_KEYS = Set.of("id", "priority", "description", "when", "emit");
    private static final Set<String> EMIT_KEYS = Set.of(
            "failure_kind", "primary_mod_id", "confidence", "fix_hints", "issue_id", "override");
    private static final Set<String> WHEN_KEYS = Set.of(
            "all", "any", "source", "regex", "mod_present", "mod_absent", "log_type", "field");
    private static final Set<String> DANGEROUS_TOKENS = Set.of(
            "exec", "jexl", "http", "https", "shell", "script", "eval", "file_write", "classpath",
            "process", "runtime", "invoke");
    private static final Set<String> SOURCES = Set.of(
            "crash_report", "log_excerpt", "stack", "fml_issue", "description");
    private static final Set<String> LOG_TYPES = Set.of("latest", "stderr", "pre_crash");
    private static final Set<String> FML_FIELDS = Set.of("mod_id", "message", "file");

    private CrashRuleValidator() {
    }

    public record Result(boolean valid, List<String> errors) {
        public Result {
            errors = errors == null ? List.of() : List.copyOf(errors);
        }

        public static Result ok() {
            return new Result(true, List.of());
        }

        public static Result fail(List<String> errors) {
            return new Result(false, errors);
        }
    }

    public static Result validate(String yamlText) {
        try {
            Map<String, Object> raw = CrashRuleYaml.parseRaw(yamlText);
            return validate(raw);
        } catch (Exception e) {
            return Result.fail(List.of("YAML parse failed: " + e.getMessage()));
        }
    }

    public static Result validate(Map<String, Object> raw) {
        List<String> errors = new ArrayList<>();
        if (raw == null || raw.isEmpty()) {
            errors.add("Empty or non-object YAML root");
            return Result.fail(errors);
        }
        rejectDangerousKeys(raw, "root", errors);
        for (String key : raw.keySet()) {
            if (!TOP_KEYS.contains(key)) {
                errors.add("Unknown top-level key: " + key);
            }
        }
        int schema = CrashRuleModels.intVal(raw, "schema_version", -1);
        if (schema != CrashRuleModels.SCHEMA_VERSION) {
            errors.add("schema_version must be " + CrashRuleModels.SCHEMA_VERSION);
        }
        Object packObj = raw.get("pack");
        if (!(packObj instanceof Map<?, ?>)) {
            errors.add("pack must be an object with id");
        } else {
            Map<String, Object> pack = CrashRuleModels.asMap(packObj);
            rejectDangerousKeys(pack, "pack", errors);
            for (String key : pack.keySet()) {
                if (!PACK_KEYS.contains(key)) {
                    errors.add("Unknown pack key: " + key);
                }
            }
            String id = CrashRuleModels.str(pack, "id");
            if (id == null || id.isBlank()) {
                errors.add("pack.id is required");
            }
        }
        Object rulesObj = raw.get("rules");
        if (!(rulesObj instanceof List<?>)) {
            errors.add("rules must be a list");
        } else {
            List<Object> rules = CrashRuleModels.asList(rulesObj);
            if (rules.size() > CrashRuleModels.MAX_RULES_PER_PACK) {
                errors.add("Too many rules (max " + CrashRuleModels.MAX_RULES_PER_PACK + ")");
            }
            Set<String> seenIds = new LinkedHashSet<>();
            int i = 0;
            for (Object el : rules) {
                String prefix = "rules[" + i + "]";
                if (!(el instanceof Map<?, ?>)) {
                    errors.add(prefix + " must be an object");
                    i++;
                    continue;
                }
                Map<String, Object> rule = CrashRuleModels.asMap(el);
                rejectDangerousKeys(rule, prefix, errors);
                for (String key : rule.keySet()) {
                    if (!RULE_KEYS.contains(key)) {
                        errors.add(prefix + ": unknown key " + key);
                    }
                }
                String rid = CrashRuleModels.str(rule, "id");
                if (rid == null || rid.isBlank()) {
                    errors.add(prefix + ".id is required");
                } else if (!seenIds.add(rid)) {
                    errors.add("Duplicate rule id: " + rid);
                }
                if (!rule.containsKey("when")) {
                    errors.add(prefix + ".when is required");
                } else {
                    validateWhen(rule.get("when"), prefix + ".when", errors);
                }
                if (rule.containsKey("emit")) {
                    Object emitObj = rule.get("emit");
                    if (!(emitObj instanceof Map<?, ?>)) {
                        errors.add(prefix + ".emit must be an object");
                    } else {
                        Map<String, Object> emit = CrashRuleModels.asMap(emitObj);
                        rejectDangerousKeys(emit, prefix + ".emit", errors);
                        for (String key : emit.keySet()) {
                            if (!EMIT_KEYS.contains(key)) {
                                errors.add(prefix + ".emit: unknown key " + key);
                            }
                        }
                        Object hints = emit.get("fix_hints");
                        if (hints != null && !(hints instanceof List<?>)) {
                            errors.add(prefix + ".emit.fix_hints must be a list");
                        }
                    }
                }
                i++;
            }
        }
        return errors.isEmpty() ? Result.ok() : Result.fail(errors);
    }

    private static void validateWhen(Object node, String path, List<String> errors) {
        if (!(node instanceof Map<?, ?>)) {
            errors.add(path + " must be an object");
            return;
        }
        Map<String, Object> map = CrashRuleModels.asMap(node);
        rejectDangerousKeys(map, path, errors);
        for (String key : map.keySet()) {
            if (!WHEN_KEYS.contains(key)) {
                errors.add(path + ": unknown key " + key);
            }
        }
        boolean hasAll = map.containsKey("all");
        boolean hasAny = map.containsKey("any");
        boolean hasModPresent = map.containsKey("mod_present");
        boolean hasModAbsent = map.containsKey("mod_absent");
        boolean hasSource = map.containsKey("source");
        int kinds = (hasAll ? 1 : 0) + (hasAny ? 1 : 0) + (hasModPresent ? 1 : 0)
                + (hasModAbsent ? 1 : 0) + (hasSource ? 1 : 0);
        if (kinds == 0) {
            errors.add(path + ": expected all, any, source, mod_present, or mod_absent");
            return;
        }
        if (kinds > 1) {
            errors.add(path + ": use only one of all/any/source/mod_present/mod_absent");
            return;
        }
        if (hasAll) {
            List<Object> kids = CrashRuleModels.asList(map.get("all"));
            if (kids.isEmpty()) {
                errors.add(path + ".all must be a non-empty list");
            }
            int i = 0;
            for (Object c : kids) {
                validateWhen(c, path + ".all[" + i + "]", errors);
                i++;
            }
            return;
        }
        if (hasAny) {
            List<Object> kids = CrashRuleModels.asList(map.get("any"));
            if (kids.isEmpty()) {
                errors.add(path + ".any must be a non-empty list");
            }
            int i = 0;
            for (Object c : kids) {
                validateWhen(c, path + ".any[" + i + "]", errors);
                i++;
            }
            return;
        }
        if (hasModPresent) {
            Object v = map.get("mod_present");
            if (v == null || String.valueOf(v).isBlank()) {
                errors.add(path + ".mod_present requires a mod id");
            }
            return;
        }
        if (hasModAbsent) {
            Object v = map.get("mod_absent");
            if (v == null || String.valueOf(v).isBlank()) {
                errors.add(path + ".mod_absent requires a mod id");
            }
            return;
        }
        String source = CrashRuleModels.str(map, "source");
        if (source == null || !SOURCES.contains(source.toLowerCase(Locale.ROOT))) {
            errors.add(path + ".source must be one of " + SOURCES);
        }
        String regex = CrashRuleModels.str(map, "regex");
        if (regex == null || regex.isBlank()) {
            errors.add(path + ".regex is required for source match");
        } else {
            if (regex.length() > CrashRuleModels.MAX_REGEX_CHARS) {
                errors.add(path + ".regex exceeds " + CrashRuleModels.MAX_REGEX_CHARS + " chars");
            }
            try {
                Pattern.compile(regex);
            } catch (PatternSyntaxException e) {
                errors.add(path + ".regex invalid: " + e.getDescription());
            }
        }
        if (map.containsKey("log_type")) {
            String lt = CrashRuleModels.str(map, "log_type");
            if (lt == null || !LOG_TYPES.contains(lt.toLowerCase(Locale.ROOT))) {
                errors.add(path + ".log_type must be one of " + LOG_TYPES);
            }
            if (source != null && !"log_excerpt".equalsIgnoreCase(source)) {
                errors.add(path + ".log_type only applies to source=log_excerpt");
            }
        }
        if (map.containsKey("field")) {
            String field = CrashRuleModels.str(map, "field");
            if (field == null || !FML_FIELDS.contains(field.toLowerCase(Locale.ROOT))) {
                errors.add(path + ".field must be one of " + FML_FIELDS);
            }
            if (source != null && !"fml_issue".equalsIgnoreCase(source)) {
                errors.add(path + ".field only applies to source=fml_issue");
            }
        }
    }

    private static void rejectDangerousKeys(Map<String, Object> map, String path, List<String> errors) {
        for (String key : map.keySet()) {
            String lower = key.toLowerCase(Locale.ROOT);
            if (DANGEROUS_TOKENS.contains(lower)) {
                errors.add(path + ": forbidden key '" + key + "'");
            }
            Object val = map.get(key);
            if (val instanceof Map<?, ?>) {
                rejectDangerousKeys(CrashRuleModels.asMap(val), path + "." + key, errors);
            } else if (val instanceof List<?> list) {
                int i = 0;
                for (Object el : list) {
                    if (el instanceof Map<?, ?>) {
                        rejectDangerousKeys(CrashRuleModels.asMap(el), path + "." + key + "[" + i + "]", errors);
                    }
                    i++;
                }
            }
        }
    }
}
