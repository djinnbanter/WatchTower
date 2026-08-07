package dev.mcstatus.watchtower.core.collect;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Locale;
import java.util.Objects;

/**
 * Soft-disable / enable top-level jars under {@code mods/} via Modrinth-style rename
 * ({@code foo.jar} ↔ {@code foo.jar.disabled}). Pure filesystem helper — no loader hooks.
 */
public final class ModJarDisable {

    public static final String DISABLED_SUFFIX = ".jar.disabled";
    /** Legacy / alternate: {@code name.disabled} after a {@code .jar} stem is unusual; we primarily use {@link #DISABLED_SUFFIX}. */
    public static final String ALT_DISABLED_SUFFIX = ".disabled";

    private ModJarDisable() {
    }

    public record Result(boolean ok, String jarBefore, String jarAfter, String errorCode, String message) {
        public static Result success(String before, String after) {
            return new Result(true, before, after, null, null);
        }

        public static Result fail(String code, String message) {
            return new Result(false, null, null, code, message);
        }
    }

    public static boolean isDisabledName(String name) {
        if (name == null || name.isBlank()) {
            return false;
        }
        String n = name.trim();
        return n.toLowerCase(Locale.ROOT).endsWith(DISABLED_SUFFIX)
                || (n.toLowerCase(Locale.ROOT).endsWith(ALT_DISABLED_SUFFIX)
                && !n.toLowerCase(Locale.ROOT).endsWith(".jar"));
    }

    /** {@code foo.jar} → {@code foo.jar.disabled} */
    public static String disabledNameFor(String enabledJarBasename) {
        String base = Objects.requireNonNullElse(enabledJarBasename, "").trim();
        if (isDisabledName(base)) {
            return base;
        }
        if (!base.toLowerCase(Locale.ROOT).endsWith(".jar")) {
            return base + DISABLED_SUFFIX;
        }
        return base + ".disabled";
    }

    /** {@code foo.jar.disabled} → {@code foo.jar}; also {@code foo.disabled} → {@code foo} if needed. */
    public static String enabledNameFor(String disabledJarBasename) {
        String base = Objects.requireNonNullElse(disabledJarBasename, "").trim();
        String lower = base.toLowerCase(Locale.ROOT);
        if (lower.endsWith(DISABLED_SUFFIX)) {
            return base.substring(0, base.length() - ".disabled".length());
        }
        if (lower.endsWith(ALT_DISABLED_SUFFIX) && !lower.endsWith(".jar")) {
            String stem = base.substring(0, base.length() - ALT_DISABLED_SUFFIX.length());
            if (!stem.toLowerCase(Locale.ROOT).endsWith(".jar")) {
                return stem + ".jar";
            }
            return stem;
        }
        return base;
    }

    public static Result disable(Path modsDir, String jarBasename) {
        Path resolved = ModJarPaths.resolveTopLevelJar(modsDir, jarBasename);
        if (resolved == null) {
            return Result.fail("invalid_jar", "Jar must be a top-level file under mods/");
        }
        String name = resolved.getFileName().toString();
        if (isDisabledName(name)) {
            return Result.success(name, name);
        }
        if (!Files.isRegularFile(resolved)) {
            return Result.fail("not_found", "Jar not found: " + name);
        }
        if (!name.toLowerCase(Locale.ROOT).endsWith(".jar")) {
            return Result.fail("invalid_jar", "Only .jar files can be disabled");
        }
        String after = disabledNameFor(name);
        Path target = resolved.getParent().resolve(after);
        if (Files.exists(target)) {
            return Result.fail("target_exists", "Disabled jar already exists: " + after);
        }
        try {
            Files.move(resolved, target);
            return Result.success(name, after);
        } catch (IOException e) {
            return Result.fail("io_error", e.getMessage() != null ? e.getMessage() : "rename failed");
        }
    }

    public static Result enable(Path modsDir, String jarBasename) {
        Path resolved = ModJarPaths.resolveTopLevelJar(modsDir, jarBasename);
        if (resolved == null) {
            return Result.fail("invalid_jar", "Jar must be a top-level file under mods/");
        }
        String name = resolved.getFileName().toString();
        if (!isDisabledName(name)) {
            // already enabled
            if (Files.isRegularFile(resolved) && name.toLowerCase(Locale.ROOT).endsWith(".jar")) {
                return Result.success(name, name);
            }
            return Result.fail("invalid_jar", "Not a disabled jar: " + name);
        }
        if (!Files.isRegularFile(resolved)) {
            return Result.fail("not_found", "Disabled jar not found: " + name);
        }
        String after = enabledNameFor(name);
        Path target = resolved.getParent().resolve(after);
        if (Files.exists(target)) {
            return Result.fail("target_exists", "Enabled jar already exists: " + after);
        }
        try {
            Files.move(resolved, target, StandardCopyOption.ATOMIC_MOVE);
            return Result.success(name, after);
        } catch (IOException e) {
            try {
                Files.move(resolved, target);
                return Result.success(name, after);
            } catch (IOException e2) {
                return Result.fail("io_error", e2.getMessage() != null ? e2.getMessage() : "rename failed");
            }
        }
    }
}
