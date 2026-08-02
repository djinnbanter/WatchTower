package dev.mcstatus.watchtower.core.auth;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AccountRoleTest {
    @Test
    void ownerCanManageAndWrite() {
        assertTrue(AccountRole.OWNER.canWrite());
        assertTrue(AccountRole.OWNER.canManageAccounts());
    }

    @Test
    void adminWritesButCannotManageAccounts() {
        assertTrue(AccountRole.ADMIN.canWrite());
        assertFalse(AccountRole.ADMIN.canManageAccounts());
    }

    @Test
    void viewerCannotWrite() {
        assertFalse(AccountRole.VIEWER.canWrite());
        assertFalse(AccountRole.VIEWER.canManageAccounts());
    }

    @Test
    void unknownWireValueFallsBackToViewer() {
        assertEquals(AccountRole.VIEWER, AccountRole.fromWire("superuser"));
        assertEquals(AccountRole.VIEWER, AccountRole.fromWire(null));
        assertEquals(AccountRole.ADMIN, AccountRole.fromWire("ADMIN"));
        assertEquals("owner", AccountRole.OWNER.wire());
    }
}
