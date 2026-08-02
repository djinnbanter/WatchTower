package dev.mcstatus.watchtower.core.auth;

import java.util.ArrayList;
import java.util.List;

/**
 * On-disk dashboard-auth.json envelope (schema 2: multiple accounts).
 *
 * <p>The trailing fields mirror the owner account exactly as schema 1 stored it. Pre-1.1.18
 * builds ignore {@code accounts} and read the mirror, so rolling the jar back still signs the
 * owner in. Never read the mirror here — {@code accounts} is the source of truth.
 */
public final class DashboardAuthFile {
    public static final int SCHEMA = 2;

    public int schema = SCHEMA;
    public List<DashboardAuthRecord> accounts = new ArrayList<>();

    public String username;
    public PasswordHasher.HashRecord password;
    public boolean must_change_password;
    public boolean totp_enabled;
    public String totp_secret_enc;
    public List<String> recovery_code_hashes = new ArrayList<>();
}
