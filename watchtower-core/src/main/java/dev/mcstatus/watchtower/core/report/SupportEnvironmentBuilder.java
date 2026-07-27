package dev.mcstatus.watchtower.core.report;

import com.google.gson.JsonObject;

import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;

/**
 * Builds environment.json for support packs.
 */
public final class SupportEnvironmentBuilder {

    public record Context(
            String modVersion,
            String minecraftVersion,
            String loader,
            String loaderVersion,
            String hostname,
            String panel,
            boolean javaRunning,
            String osName,
            String osArch
    ) {
    }

    private SupportEnvironmentBuilder() {
    }

    public static JsonObject build(Context ctx) {
        JsonObject env = new JsonObject();
        env.addProperty("generated_at", ZonedDateTime.now().format(DateTimeFormatter.ISO_OFFSET_DATE_TIME));
        env.addProperty("bundle_version", SupportBundlePackager.BUNDLE_VERSION);
        env.addProperty("mod_version", nz(ctx != null ? ctx.modVersion() : null));
        env.addProperty("minecraft_version", nz(ctx != null ? ctx.minecraftVersion() : null));
        env.addProperty("loader", nz(ctx != null ? ctx.loader() : null, "unknown"));
        if (ctx != null && ctx.loaderVersion() != null && !ctx.loaderVersion().isBlank()) {
            env.addProperty("loader_version", ctx.loaderVersion());
        }
        env.addProperty("hostname", nz(ctx != null ? ctx.hostname() : null, "unknown"));
        env.addProperty("panel", nz(ctx != null ? ctx.panel() : null, "unknown"));
        env.addProperty("java_running", ctx == null || ctx.javaRunning());
        env.addProperty("java_version", System.getProperty("java.version", ""));
        env.addProperty("java_vendor", System.getProperty("java.vendor", ""));
        env.addProperty("java_major", parseJavaMajor());
        env.addProperty("os_name", ctx != null && ctx.osName() != null && !ctx.osName().isBlank()
                ? ctx.osName()
                : System.getProperty("os.name", ""));
        env.addProperty("os_arch", ctx != null && ctx.osArch() != null && !ctx.osArch().isBlank()
                ? ctx.osArch()
                : System.getProperty("os.arch", ""));
        env.addProperty("redaction", true);
        return env;
    }

    private static String nz(String v) {
        return nz(v, "");
    }

    private static String nz(String v, String fallback) {
        return v != null && !v.isBlank() ? v : fallback;
    }

    private static int parseJavaMajor() {
        String spec = System.getProperty("java.specification.version", "");
        try {
            if (spec.startsWith("1.")) {
                return Integer.parseInt(spec.substring(2));
            }
            return Integer.parseInt(spec.replaceAll("[^0-9].*$", ""));
        } catch (NumberFormatException e) {
            return -1;
        }
    }
}
