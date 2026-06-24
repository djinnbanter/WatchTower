package dev.mcstatus.watchtower.core.auth;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PasswordHasherTest {

    @Test
    void hashAndVerifyRoundTrip() {
        PasswordHasher.HashRecord hash = PasswordHasher.hashPassword("secret-pass".toCharArray());
        assertTrue(PasswordHasher.verify("secret-pass".toCharArray(), hash));
        assertFalse(PasswordHasher.verify("wrong-pass".toCharArray(), hash));
    }

    @Test
    void generatedPasswordsAreUnique() {
        String a = PasswordHasher.generatePassword(20);
        String b = PasswordHasher.generatePassword(20);
        assertNotEquals(a, b);
        assertTrue(a.length() >= 16);
    }
}
