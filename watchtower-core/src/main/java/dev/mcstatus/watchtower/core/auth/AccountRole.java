package dev.mcstatus.watchtower.core.auth;

import java.util.Locale;

/** Dashboard account roles. Least privilege wins on anything unrecognized. */
public enum AccountRole {
    OWNER,
    ADMIN,
    VIEWER;

    public boolean canWrite() {
        return this == OWNER || this == ADMIN;
    }

    public boolean canManageAccounts() {
        return this == OWNER;
    }

    public String wire() {
        return name().toLowerCase(Locale.ROOT);
    }

    public static AccountRole fromWire(String raw) {
        if (raw == null) {
            return VIEWER;
        }
        return switch (raw.trim().toLowerCase(Locale.ROOT)) {
            case "owner" -> OWNER;
            case "admin" -> ADMIN;
            default -> VIEWER;
        };
    }
}
