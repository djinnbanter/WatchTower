package dev.mcstatus.watchtower.core.auth;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/** On-disk dashboard credential record (Gson-serializable). */
public final class DashboardAuthRecord {
    public static final int SCHEMA = 1;
    public static final String DEFAULT_USERNAME = "watchtower";
    public static final String DEFAULT_INITIAL_PASSWORD = "password";

    public int schema = SCHEMA;
    public String username = DEFAULT_USERNAME;
    public PasswordHasher.HashRecord password;
    public boolean must_change_password = true;
    public boolean totp_enabled = false;
    public String totp_secret_enc;
    public List<String> recovery_code_hashes = new ArrayList<>();
    public String created_at;
    public String password_changed_at;

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
}
