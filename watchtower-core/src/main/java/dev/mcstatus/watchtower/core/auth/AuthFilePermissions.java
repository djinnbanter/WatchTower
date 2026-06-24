package dev.mcstatus.watchtower.core.auth;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.PosixFilePermission;
import java.util.EnumSet;
import java.util.Set;

/** Best-effort restrictive permissions for credential files. */
public final class AuthFilePermissions {
    private static final Set<PosixFilePermission> OWNER_RW = EnumSet.of(
            PosixFilePermission.OWNER_READ,
            PosixFilePermission.OWNER_WRITE
    );

    private AuthFilePermissions() {
    }

    public static void restrictToOwner(Path path) {
        try {
            Files.setPosixFilePermissions(path, OWNER_RW);
        } catch (UnsupportedOperationException | IOException ignored) {
            // Windows and some FS types do not support POSIX permissions.
        }
    }
}
