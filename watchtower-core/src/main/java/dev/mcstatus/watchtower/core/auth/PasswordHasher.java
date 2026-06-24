package dev.mcstatus.watchtower.core.auth;

import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.security.spec.InvalidKeySpecException;
import java.util.Base64;

/** PBKDF2-HMAC-SHA256 password hashing and secure password generation. */
public final class PasswordHasher {
    public static final String ALGORITHM = "pbkdf2-sha256";
    public static final int ITERATIONS = 120_000;
    public static final int SALT_BYTES = 16;
    public static final int KEY_BITS = 256;

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final String PASSWORD_ALPHABET =
            "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789-_";

    private PasswordHasher() {
    }

    public record HashRecord(String algorithm, int iterations, String salt, String hash) {
    }

    public static HashRecord hashPassword(char[] password) {
        byte[] salt = new byte[SALT_BYTES];
        RANDOM.nextBytes(salt);
        byte[] derived = derive(password, salt, ITERATIONS);
        return new HashRecord(
                ALGORITHM,
                ITERATIONS,
                Base64.getEncoder().encodeToString(salt),
                Base64.getEncoder().encodeToString(derived)
        );
    }

    public static boolean verify(char[] password, HashRecord record) {
        if (record == null || record.salt() == null || record.hash() == null) {
            return false;
        }
        if (!ALGORITHM.equals(record.algorithm())) {
            return false;
        }
        byte[] salt = Base64.getDecoder().decode(record.salt());
        byte[] expected = Base64.getDecoder().decode(record.hash());
        byte[] actual = derive(password, salt, record.iterations());
        return constantTimeEquals(expected, actual);
    }

    public static String generatePassword(int length) {
        if (length < 16) {
            length = 16;
        }
        StringBuilder sb = new StringBuilder(length);
        for (int i = 0; i < length; i++) {
            sb.append(PASSWORD_ALPHABET.charAt(RANDOM.nextInt(PASSWORD_ALPHABET.length())));
        }
        return sb.toString();
    }

    private static byte[] derive(char[] password, byte[] salt, int iterations) {
        try {
            PBEKeySpec spec = new PBEKeySpec(password, salt, iterations, KEY_BITS);
            SecretKeyFactory factory = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256");
            return factory.generateSecret(spec).getEncoded();
        } catch (NoSuchAlgorithmException | InvalidKeySpecException e) {
            throw new IllegalStateException("PBKDF2 unavailable", e);
        }
    }

    private static boolean constantTimeEquals(byte[] a, byte[] b) {
        if (a.length != b.length) {
            return false;
        }
        int diff = 0;
        for (int i = 0; i < a.length; i++) {
            diff |= a[i] ^ b[i];
        }
        return diff == 0;
    }
}
