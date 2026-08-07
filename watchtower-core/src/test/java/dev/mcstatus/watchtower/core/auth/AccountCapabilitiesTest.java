package dev.mcstatus.watchtower.core.auth;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AccountCapabilitiesTest {

    @Test
    void ownerAlwaysHasModsMutate() {
        DashboardAuthRecord owner = new DashboardAuthRecord();
        owner.role = AccountRole.OWNER.wire();
        owner.capabilities = new ArrayList<>();
        assertTrue(AccountCapabilities.has(owner, AccountCapabilities.MODS_MUTATE));
        assertTrue(AccountCapabilities.canMutateMods(owner));
    }

    @Test
    void adminEmptyCapabilitiesDenied() {
        DashboardAuthRecord admin = new DashboardAuthRecord();
        admin.role = AccountRole.ADMIN.wire();
        admin.capabilities = new ArrayList<>();
        assertFalse(AccountCapabilities.has(admin, AccountCapabilities.MODS_MUTATE));
        assertFalse(AccountCapabilities.canMutateMods(admin));
    }

    @Test
    void adminWithModsMutateAllowed() {
        DashboardAuthRecord admin = new DashboardAuthRecord();
        admin.role = AccountRole.ADMIN.wire();
        admin.capabilities = List.of(AccountCapabilities.MODS_MUTATE);
        assertTrue(AccountCapabilities.has(admin, AccountCapabilities.MODS_MUTATE));
        assertTrue(AccountCapabilities.canMutateMods(admin));
    }

    @Test
    void nullRecordFalse() {
        assertFalse(AccountCapabilities.has(null, AccountCapabilities.MODS_MUTATE));
        assertFalse(AccountCapabilities.canMutateMods(null));
    }

    @Test
    void normalizeDropsUnknownAndBlanksDedupes() {
        List<String> out = AccountCapabilities.normalize(List.of(
                " mods.mutate ",
                "",
                "mods.mutate",
                "unknown.flag",
                "  "));
        assertEquals(List.of(AccountCapabilities.MODS_MUTATE), out);
    }

    @Test
    void normalizeNullReturnsEmpty() {
        assertTrue(AccountCapabilities.normalize(null).isEmpty());
    }
}
