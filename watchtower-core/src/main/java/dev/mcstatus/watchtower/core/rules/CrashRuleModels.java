package dev.mcstatus.watchtower.core.rules;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;

/**
 * Immutable models for declarative crash rule packs (1.0.18 / WT-035).
 */
public final class CrashRuleModels {

    public static final int SCHEMA_VERSION = 1;
    public static final int MAX_REGEX_CHARS = 500;
    public static final int MAX_RULES_PER_PACK = 64;
    public static final int MAX_PACKS = 10;

    private CrashRuleModels() {
    }

    public record CrashRulePack(
            int schemaVersion,
            String id,
            String name,
            int priority,
            List<CrashRule> rules,
            String sourcePath,
            boolean builtin
    ) {
        public CrashRulePack {
            rules = rules == null ? List.of() : List.copyOf(rules);
        }
    }

    public record CrashRule(
            String id,
            int priority,
            String description,
            PredicateNode when,
            EmitSpec emit
    ) {
    }

    public record EmitSpec(
            String failureKind,
            String primaryModId,
            String confidence,
            List<String> fixHints,
            String issueId,
            boolean override
    ) {
        public EmitSpec {
            fixHints = fixHints == null ? List.of() : List.copyOf(fixHints);
        }
    }

    /** Allowlisted predicate tree — no exec / jexl / HTTP. */
    public sealed interface PredicateNode permits AllNode, AnyNode, SourceMatch, ModPresent, ModAbsent {
    }

    public record AllNode(List<PredicateNode> children) implements PredicateNode {
        public AllNode {
            children = children == null ? List.of() : List.copyOf(children);
        }
    }

    public record AnyNode(List<PredicateNode> children) implements PredicateNode {
        public AnyNode {
            children = children == null ? List.of() : List.copyOf(children);
        }
    }

    public record SourceMatch(
            String source,
            String regex,
            String logType,
            String field
    ) implements PredicateNode {
    }

    public record ModPresent(String modId) implements PredicateNode {
    }

    public record ModAbsent(String modId) implements PredicateNode {
    }

    public static EmitSpec emitFromMap(Map<String, Object> map) {
        if (map == null) {
            return new EmitSpec(null, null, null, List.of(), null, false);
        }
        List<String> hints = new ArrayList<>();
        Object rawHints = map.get("fix_hints");
        if (rawHints instanceof List<?> list) {
            for (Object o : list) {
                if (o != null) {
                    hints.add(String.valueOf(o));
                }
            }
        }
        return new EmitSpec(
                str(map, "failure_kind"),
                str(map, "primary_mod_id"),
                str(map, "confidence"),
                hints,
                str(map, "issue_id"),
                bool(map, "override")
        );
    }

    static String str(Map<String, Object> map, String key) {
        Object v = map.get(key);
        return v == null ? null : String.valueOf(v).trim();
    }

    static boolean bool(Map<String, Object> map, String key) {
        Object v = map.get(key);
        if (v instanceof Boolean b) {
            return b;
        }
        if (v == null) {
            return false;
        }
        return "true".equalsIgnoreCase(String.valueOf(v).trim());
    }

    static int intVal(Map<String, Object> map, String key, int defaultVal) {
        Object v = map.get(key);
        if (v instanceof Number n) {
            return n.intValue();
        }
        if (v == null) {
            return defaultVal;
        }
        try {
            return Integer.parseInt(String.valueOf(v).trim());
        } catch (NumberFormatException e) {
            return defaultVal;
        }
    }

    @SuppressWarnings("unchecked")
    static Map<String, Object> asMap(Object o) {
        if (o instanceof Map<?, ?> m) {
            return (Map<String, Object>) m;
        }
        return Collections.emptyMap();
    }

    @SuppressWarnings("unchecked")
    static List<Object> asList(Object o) {
        if (o instanceof List<?> list) {
            return (List<Object>) list;
        }
        return List.of();
    }
}
