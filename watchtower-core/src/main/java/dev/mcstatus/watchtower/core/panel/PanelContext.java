package dev.mcstatus.watchtower.core.panel;

import java.nio.file.Path;
import java.util.Locale;
import java.util.Map;

/**
 * Inputs for panel detection (config + server directory).
 */
public final class PanelContext {

    private final Map<String, String> conf;
    private final Path serverDir;

    public PanelContext(Map<String, String> conf, Path serverDir) {
        this.conf = conf;
        this.serverDir = serverDir != null ? serverDir.toAbsolutePath().normalize() : Path.of("");
    }

    public Map<String, String> conf() {
        return conf;
    }

    public Path serverDir() {
        return serverDir;
    }

    public String panelMode() {
        return conf.getOrDefault("PANEL", "auto").strip().toLowerCase(Locale.ROOT);
    }

    public String confOrEnv(String key) {
        String v = conf.get(key);
        if (v != null && !v.isBlank()) {
            return v.strip();
        }
        v = System.getenv(key);
        return v != null ? v.strip() : "";
    }

    public String confOrEnv(String confKey, String envKey) {
        String v = confOrEnv(confKey);
        if (!v.isEmpty()) {
            return v;
        }
        return confOrEnv(envKey);
    }

    public Path pathFromConf(String key) {
        String v = confOrEnv(key);
        return v.isEmpty() ? null : Path.of(v).toAbsolutePath().normalize();
    }
}
