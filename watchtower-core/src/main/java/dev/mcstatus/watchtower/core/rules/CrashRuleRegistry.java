package dev.mcstatus.watchtower.core.rules;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.URL;
import java.nio.file.DirectoryStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Enumeration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.jar.JarEntry;
import java.util.jar.JarFile;
import java.util.logging.Logger;

/**
 * Discovers builtin + operator crash rule packs with priority sort and soft-fail.
 */
public final class CrashRuleRegistry {

    private static final Logger LOG = Logger.getLogger(CrashRuleRegistry.class.getName());
    public static final String BUILTIN_PREFIX = "builtin-rules/";
    public static final String OPERATOR_DIR = "config/watchtower/rules";

    private final List<CrashRuleModels.CrashRulePack> packs;
    private final List<String> warnings;

    private CrashRuleRegistry(List<CrashRuleModels.CrashRulePack> packs, List<String> warnings) {
        this.packs = List.copyOf(packs);
        this.warnings = List.copyOf(warnings);
    }

    public List<CrashRuleModels.CrashRulePack> packs() {
        return packs;
    }

    public List<String> warnings() {
        return warnings;
    }

    public List<ResolvedRule> resolvedRules() {
        List<ResolvedRule> out = new ArrayList<>();
        for (CrashRuleModels.CrashRulePack pack : packs) {
            for (CrashRuleModels.CrashRule rule : pack.rules()) {
                out.add(new ResolvedRule(pack, rule));
            }
        }
        out.sort(Comparator
                .comparingInt((ResolvedRule r) -> r.pack().priority()).reversed()
                .thenComparingInt(r -> r.rule().priority()).reversed()
                .thenComparing(r -> r.pack().id())
                .thenComparing(r -> r.rule().id()));
        return out;
    }

    public record ResolvedRule(CrashRuleModels.CrashRulePack pack, CrashRuleModels.CrashRule rule) {
        public String key() {
            return pack.id() + "/" + rule.id();
        }
    }

    public static CrashRuleRegistry load(Path serverDir, boolean loadBuiltin, boolean loadOperator) {
        List<String> warnings = new ArrayList<>();
        Map<String, CrashRuleModels.CrashRulePack> byId = new LinkedHashMap<>();

        if (loadBuiltin) {
            for (LoadedYaml ly : loadBuiltinYamls(warnings)) {
                acceptPack(ly, true, byId, warnings);
            }
        }
        if (loadOperator && serverDir != null) {
            Path rulesDir = serverDir.resolve(OPERATOR_DIR);
            if (Files.isDirectory(rulesDir)) {
                try (DirectoryStream<Path> ds = Files.newDirectoryStream(rulesDir, "*.{yaml,yml}")) {
                    List<Path> files = new ArrayList<>();
                    for (Path p : ds) {
                        files.add(p);
                    }
                    files.sort(Comparator.comparing(p -> p.getFileName().toString().toLowerCase(Locale.ROOT)));
                    int operatorCount = 0;
                    for (Path p : files) {
                        if (byId.size() >= CrashRuleModels.MAX_PACKS && !byId.containsKey(peekPackId(p))) {
                            warnings.add("Skipping pack " + p.getFileName() + ": max "
                                    + CrashRuleModels.MAX_PACKS + " packs");
                            continue;
                        }
                        try {
                            Map<String, Object> raw = CrashRuleYaml.parseRaw(p);
                            if (acceptPack(new LoadedYaml(raw, p.toString()), false, byId, warnings)) {
                                operatorCount++;
                            }
                        } catch (Exception e) {
                            String msg = "Bad rule pack " + p.getFileName() + ": " + e.getMessage();
                            warnings.add(msg);
                            LOG.warning(msg);
                        }
                    }
                    if (operatorCount > 0) {
                        LOG.info("Loaded " + operatorCount + " operator crash rule pack(s) from " + rulesDir);
                    }
                } catch (IOException e) {
                    warnings.add("Cannot read rules dir: " + e.getMessage());
                    LOG.warning(warnings.get(warnings.size() - 1));
                }
            }
        }

        List<CrashRuleModels.CrashRulePack> packs = new ArrayList<>(byId.values());
        packs.sort(Comparator.comparingInt(CrashRuleModels.CrashRulePack::priority).reversed()
                .thenComparing(CrashRuleModels.CrashRulePack::id));
        return new CrashRuleRegistry(packs, warnings);
    }

    private static String peekPackId(Path p) {
        try {
            Map<String, Object> raw = CrashRuleYaml.parseRaw(p);
            Map<String, Object> pack = CrashRuleModels.asMap(raw.get("pack"));
            return CrashRuleModels.str(pack, "id");
        } catch (Exception e) {
            return null;
        }
    }

    /** @return true when the pack was accepted into the registry */
    private static boolean acceptPack(
            LoadedYaml ly,
            boolean builtin,
            Map<String, CrashRuleModels.CrashRulePack> byId,
            List<String> warnings
    ) {
        CrashRuleValidator.Result vr = CrashRuleValidator.validate(ly.raw());
        if (!vr.valid()) {
            String msg = "Skipping invalid pack " + ly.source() + ": " + String.join("; ", vr.errors());
            warnings.add(msg);
            LOG.warning(msg);
            return false;
        }
        CrashRuleModels.CrashRulePack pack = CrashRuleYaml.toPack(ly.raw(), ly.source(), builtin);
        // Operator pack overrides builtin with same id
        CrashRuleModels.CrashRulePack existing = byId.get(pack.id());
        if (existing != null && existing.builtin() && !builtin) {
            byId.put(pack.id(), pack);
            return true;
        }
        if (existing != null && !existing.builtin() && builtin) {
            return false; // keep operator
        }
        if (existing != null && !builtin) {
            byId.put(pack.id(), pack); // last operator wins
            return true;
        }
        if (byId.size() >= CrashRuleModels.MAX_PACKS && !byId.containsKey(pack.id())) {
            warnings.add("Skipping pack " + pack.id() + ": max " + CrashRuleModels.MAX_PACKS + " packs");
            return false;
        }
        byId.put(pack.id(), pack);
        return true;
    }

    private record LoadedYaml(Map<String, Object> raw, String source) {
    }

    private static List<LoadedYaml> loadBuiltinYamls(List<String> warnings) {
        List<LoadedYaml> out = new ArrayList<>();
        ClassLoader cl = CrashRuleRegistry.class.getClassLoader();
        try {
            Enumeration<URL> resources = cl.getResources(BUILTIN_PREFIX);
            while (resources.hasMoreElements()) {
                URL url = resources.nextElement();
                String protocol = url.getProtocol();
                if ("file".equals(protocol)) {
                    Path dir = Path.of(URI.create(url.toString()));
                    if (Files.isDirectory(dir)) {
                        try (DirectoryStream<Path> ds = Files.newDirectoryStream(dir, "*.{yaml,yml}")) {
                            for (Path p : ds) {
                                out.add(new LoadedYaml(CrashRuleYaml.parseRaw(p), "classpath:" + BUILTIN_PREFIX
                                        + p.getFileName()));
                            }
                        }
                    }
                } else if ("jar".equals(protocol)) {
                    String path = url.getPath();
                    int bang = path.indexOf('!');
                    if (bang < 0) {
                        continue;
                    }
                    Path jarPath = Path.of(URI.create(path.substring(0, bang)));
                    try (JarFile jar = new JarFile(jarPath.toFile())) {
                        Enumeration<JarEntry> entries = jar.entries();
                        while (entries.hasMoreElements()) {
                            JarEntry e = entries.nextElement();
                            String name = e.getName();
                            if (!name.startsWith(BUILTIN_PREFIX) || e.isDirectory()) {
                                continue;
                            }
                            if (!(name.endsWith(".yaml") || name.endsWith(".yml"))) {
                                continue;
                            }
                            try (InputStream in = jar.getInputStream(e)) {
                                out.add(new LoadedYaml(CrashRuleYaml.parseRaw(in), "classpath:" + name));
                            }
                        }
                    }
                }
            }
            // Also try direct resource listing when getResources is empty (IDE)
            if (out.isEmpty()) {
                try (InputStream probe = cl.getResourceAsStream(BUILTIN_PREFIX + "create-contraption-npe.yaml")) {
                    if (probe != null) {
                        out.add(new LoadedYaml(CrashRuleYaml.parseRaw(probe),
                                "classpath:" + BUILTIN_PREFIX + "create-contraption-npe.yaml"));
                    }
                }
            }
        } catch (Exception e) {
            warnings.add("Builtin rules load failed: " + e.getMessage());
            LOG.warning(warnings.get(warnings.size() - 1));
        }
        out.sort(Comparator.comparing(LoadedYaml::source));
        return out;
    }

    public CrashRuleModels.CrashRulePack findPack(String packId) {
        if (packId == null) {
            return null;
        }
        for (CrashRuleModels.CrashRulePack p : packs) {
            if (packId.equals(p.id())) {
                return p;
            }
        }
        return null;
    }

    public ResolvedRule findRule(String packId, String ruleId) {
        if (ruleId == null) {
            return null;
        }
        for (ResolvedRule r : resolvedRules()) {
            if (ruleId.equals(r.rule().id()) && (packId == null || packId.equals(r.pack().id()))) {
                return r;
            }
        }
        return null;
    }
}
