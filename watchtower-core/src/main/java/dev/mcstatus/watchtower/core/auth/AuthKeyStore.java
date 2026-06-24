package dev.mcstatus.watchtower.core.auth;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;

/** Loads or creates watchtower/.auth-key for session HMAC and TOTP encryption. */
public final class AuthKeyStore {
    private static final int KEY_BYTES = 32;
    private static final SecureRandom RANDOM = new SecureRandom();

    private final byte[] masterKey;

    public AuthKeyStore(Path keyPath) throws IOException {
        if (Files.isRegularFile(keyPath)) {
            byte[] raw = Files.readAllBytes(keyPath);
            if (raw.length < KEY_BYTES) {
                throw new IOException("Auth key file too short: " + keyPath);
            }
            this.masterKey = new byte[KEY_BYTES];
            System.arraycopy(raw, 0, this.masterKey, 0, KEY_BYTES);
        } else {
            Files.createDirectories(keyPath.getParent());
            byte[] generated = new byte[KEY_BYTES];
            RANDOM.nextBytes(generated);
            Files.write(keyPath, generated);
            AuthFilePermissions.restrictToOwner(keyPath);
            this.masterKey = generated;
        }
    }

    public byte[] sessionHmacKey() {
        return derive("watchtower-session-hmac-v1");
    }

    public byte[] totpAesKey() {
        return derive("watchtower-totp-aes-v1");
    }

    public String signSessionId(String sessionId) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(sessionHmacKey(), "HmacSHA256"));
            byte[] sig = mac.doFinal(sessionId.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(sig);
        } catch (Exception e) {
            throw new IllegalStateException("HMAC failed", e);
        }
    }

    public boolean verifySessionSignature(String sessionId, String signature) {
        if (sessionId == null || signature == null || signature.isBlank()) {
            return false;
        }
        String expected = signSessionId(sessionId);
        return constantTimeEquals(expected, signature);
    }

    public String formatCookieValue(String sessionId) {
        return sessionId + "." + signSessionId(sessionId);
    }

    public String parseSessionId(String cookieValue) {
        if (cookieValue == null || cookieValue.isBlank()) {
            return null;
        }
        int dot = cookieValue.lastIndexOf('.');
        if (dot <= 0 || dot >= cookieValue.length() - 1) {
            return null;
        }
        String sessionId = cookieValue.substring(0, dot);
        String sig = cookieValue.substring(dot + 1);
        if (!verifySessionSignature(sessionId, sig)) {
            return null;
        }
        return sessionId;
    }

    private byte[] derive(String label) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            digest.update(label.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            digest.update(masterKey);
            return digest.digest();
        } catch (Exception e) {
            throw new IllegalStateException("Key derivation failed", e);
        }
    }

    private static boolean constantTimeEquals(String a, String b) {
        if (a.length() != b.length()) {
            return false;
        }
        int diff = 0;
        for (int i = 0; i < a.length(); i++) {
            diff |= a.charAt(i) ^ b.charAt(i);
        }
        return diff == 0;
    }
}
