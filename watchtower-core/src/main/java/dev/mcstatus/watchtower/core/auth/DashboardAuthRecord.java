package dev.mcstatus.watchtower.core.auth;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/** On-disk dashboard account record (Gson-serializable). */
public final class DashboardAuthRecord {
    public static final int SCHEMA = 1;
    public static final String DEFAULT_USERNAME = "watchtower";
    public static final String DEFAULT_INITIAL_PASSWORD = "password";

    public int schema = SCHEMA;
    public String id;
    public String username = DEFAULT_USERNAME;
    public String role = AccountRole.OWNER.wire();
    public boolean disabled = false;
    public PasswordHasher.HashRecord password;
    public boolean must_change_password = true;
    public boolean totp_enabled = false;
    public String totp_secret_enc;
    public List<String> recovery_code_hashes = new ArrayList<>();
    public String created_at;
    public String password_changed_at;
    public String created_by;
    public String last_login_at;
    /** Optional linked Minecraft player UUID (lowercase dashed). Empty/null = unlinked. */
    public String minecraft_uuid;
    /** Last known Minecraft name for display (max 16). */
    public String minecraft_name;
    /** UI theme mode: light|dark|black|system. Null → client default dark. */
    public String ui_theme;
    /** UI accent preset id. Null → signal. */
    public String ui_accent;

    public DashboardAuthRecord() {
    }

    public static DashboardAuthRecord freshDefault(String username, PasswordHasher.HashRecord passwordHash) {
        DashboardAuthRecord r = new DashboardAuthRecord();
        r.username = username;
        r.password = passwordHash;
        r.must_change_password = true;
        r.created_at = Instant.now().toString();
        return r;
    }

    public static DashboardAuthRecord newAccount(
            String username, AccountRole role, PasswordHasher.HashRecord passwordHash, String createdByAccountId) {
        DashboardAuthRecord r = new DashboardAuthRecord();
        r.id = "acc_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16);
        r.username = username;
        r.role = role.wire();
        r.password = passwordHash;
        r.must_change_password = true;
        r.created_at = Instant.now().toString();
        r.created_by = createdByAccountId;
        return r;
    }
}
