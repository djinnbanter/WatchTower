package dev.mcstatus.watchtower.core.rules;

import org.yaml.snakeyaml.LoaderOptions;
import org.yaml.snakeyaml.Yaml;
import org.yaml.snakeyaml.constructor.SafeConstructor;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Loads crash-rule YAML into raw maps / models. Uses SnakeYAML SafeConstructor only.
 */
public final class CrashRuleYaml {

    private CrashRuleYaml() {
    }

    public static Map<String, Object> parseRaw(String yamlText) {
        if (yamlText == null || yamlText.isBlank()) {
            return Map.of();
        }
        LoaderOptions opts = new LoaderOptions();
        opts.setMaxAliasesForCollections(50);
        opts.setNestingDepthLimit(50);
        opts.setCodePointLimit(256_000);
        Yaml yaml = new Yaml(new SafeConstructor(opts));
        Object loaded = yaml.load(yamlText);
        if (!(loaded instanceof Map<?, ?>)) {
            return Map.of();
        }
        @SuppressWarnings("unchecked")
        Map<String, Object> map = (Map<String, Object>) loaded;
        return new LinkedHashMap<>(map);
    }

    public static Map<String, Object> parseRaw(Path path) throws IOException {
        return parseRaw(Files.readString(path, StandardCharsets.UTF_8));
    }

    public static Map<String, Object> parseRaw(InputStream in) throws IOException {
        return parseRaw(new String(in.readAllBytes(), StandardCharsets.UTF_8));
    }

    /**
     * Builds a pack from a validated raw map. Caller must validate first.
     */
    public static CrashRuleModels.CrashRulePack toPack(
            Map<String, Object> raw,
            String sourcePath,
            boolean builtin
    ) {
        int schema = CrashRuleModels.intVal(raw, "schema_version", CrashRuleModels.SCHEMA_VERSION);
        Map<String, Object> pack = CrashRuleModels.asMap(raw.get("pack"));
        String id = CrashRuleModels.str(pack, "id");
        if (id == null || id.isBlank()) {
            id = "unknown";
        }
        String name = CrashRuleModels.str(pack, "name");
        if (name == null || name.isBlank()) {
            name = id;
        }
        int priority = CrashRuleModels.intVal(pack, "priority", 100);
        List<CrashRuleModels.CrashRule> rules = new ArrayList<>();
        for (Object el : CrashRuleModels.asList(raw.get("rules"))) {
            Map<String, Object> rm = CrashRuleModels.asMap(el);
            String rid = CrashRuleModels.str(rm, "id");
            if (rid == null || rid.isBlank()) {
                continue;
            }
            rules.add(new CrashRuleModels.CrashRule(
                    rid,
                    CrashRuleModels.intVal(rm, "priority", 100),
                    CrashRuleModels.str(rm, "description"),
                    parsePredicate(rm.get("when")),
                    CrashRuleModels.emitFromMap(CrashRuleModels.asMap(rm.get("emit")))
            ));
        }
        return new CrashRuleModels.CrashRulePack(schema, id, name, priority, rules, sourcePath, builtin);
    }

    static CrashRuleModels.PredicateNode parsePredicate(Object node) {
        if (!(node instanceof Map<?, ?>)) {
            return new CrashRuleModels.AllNode(List.of());
        }
        Map<String, Object> map = CrashRuleModels.asMap(node);
        if (map.containsKey("all")) {
            List<CrashRuleModels.PredicateNode> kids = new ArrayList<>();
            for (Object c : CrashRuleModels.asList(map.get("all"))) {
                kids.add(parsePredicate(c));
            }
            return new CrashRuleModels.AllNode(kids);
        }
        if (map.containsKey("any")) {
            List<CrashRuleModels.PredicateNode> kids = new ArrayList<>();
            for (Object c : CrashRuleModels.asList(map.get("any"))) {
                kids.add(parsePredicate(c));
            }
            return new CrashRuleModels.AnyNode(kids);
        }
        if (map.containsKey("mod_present")) {
            return new CrashRuleModels.ModPresent(String.valueOf(map.get("mod_present")).trim());
        }
        if (map.containsKey("mod_absent")) {
            return new CrashRuleModels.ModAbsent(String.valueOf(map.get("mod_absent")).trim());
        }
        String source = CrashRuleModels.str(map, "source");
        String regex = CrashRuleModels.str(map, "regex");
        String logType = CrashRuleModels.str(map, "log_type");
        String field = CrashRuleModels.str(map, "field");
        return new CrashRuleModels.SourceMatch(
                source != null ? source.toLowerCase(Locale.ROOT) : "",
                regex != null ? regex : "",
                logType != null ? logType.toLowerCase(Locale.ROOT) : null,
                field != null ? field.toLowerCase(Locale.ROOT) : null
        );
    }
}
