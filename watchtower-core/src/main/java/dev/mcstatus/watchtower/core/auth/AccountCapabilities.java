package dev.mcstatus.watchtower.core.auth;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * Named capability flags stored on {@link DashboardAuthRecord#capabilities}.
 * Owner always possesses every known capability without needing the string stored.
 */
public final class AccountCapabilities {
    public static final String MODS_MUTATE = "mods.mutate";

    private static final Set<String> KNOWN = Set.of(MODS_MUTATE);

    private AccountCapabilities() {
    }

    /** Owner always has every known capability; others need exact string in record.capabilities. */
    public static boolean has(DashboardAuthRecord record, String capability) {
        if (record == null || capability == null || capability.isBlank()) {
            return false;
        }
        String wanted = capability.trim();
        if (AccountRole.fromWire(record.role) == AccountRole.OWNER) {
            return KNOWN.contains(wanted) || (record.capabilities != null && record.capabilities.contains(wanted));
        }
        if (record.capabilities == null) {
            return false;
        }
        return record.capabilities.contains(wanted);
    }

    public static boolean canMutateMods(DashboardAuthRecord record) {
        return has(record, MODS_MUTATE);
    }

    /**
     * Normalize list: trim, dedupe (stable order), drop blanks and unknown ids.
     * Only known capability ids are retained for now.
     */
    public static List<String> normalize(List<String> raw) {
        if (raw == null || raw.isEmpty()) {
            return new ArrayList<>();
        }
        LinkedHashSet<String> out = new LinkedHashSet<>();
        for (String item : raw) {
            if (item == null) {
                continue;
            }
            String trimmed = item.trim();
            if (trimmed.isEmpty()) {
                continue;
            }
            if (KNOWN.contains(trimmed)) {
                out.add(trimmed);
            }
        }
        return new ArrayList<>(out);
    }

    public static boolean isKnown(String capability) {
        return capability != null && KNOWN.contains(capability.trim());
    }
}
