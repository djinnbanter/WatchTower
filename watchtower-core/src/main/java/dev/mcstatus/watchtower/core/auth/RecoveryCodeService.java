package dev.mcstatus.watchtower.core.auth;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/** Single-use recovery code generation and verification. */
public final class RecoveryCodeService {
    public static final int CODE_COUNT = 8;
    public static final int CODE_LENGTH = 10;

    private RecoveryCodeService() {
    }

    public record GeneratedCodes(List<String> plainCodes, List<String> hashes) {
    }

    public static GeneratedCodes generate() {
        List<String> plain = new ArrayList<>(CODE_COUNT);
        List<String> hashes = new ArrayList<>(CODE_COUNT);
        for (int i = 0; i < CODE_COUNT; i++) {
            String code = randomCode();
            plain.add(code);
            hashes.add(hashCode(code));
        }
        return new GeneratedCodes(plain, hashes);
    }

    public static String hashCode(String code) {
        PasswordHasher.HashRecord h = PasswordHasher.hashPassword(normalize(code).toCharArray());
        return h.salt() + "$" + h.hash();
    }

    public static boolean verifyAndConsume(String code, List<String> hashes) {
        if (code == null || hashes == null || hashes.isEmpty()) {
            return false;
        }
        String normalized = normalize(code);
        for (int i = 0; i < hashes.size(); i++) {
            String entry = hashes.get(i);
            if (entry == null || entry.isBlank()) {
                continue;
            }
            String[] parts = entry.split("\\$", 2);
            if (parts.length != 2) {
                continue;
            }
            PasswordHasher.HashRecord record = new PasswordHasher.HashRecord(
                    PasswordHasher.ALGORITHM,
                    PasswordHasher.ITERATIONS,
                    parts[0],
                    parts[1]
            );
            if (PasswordHasher.verify(normalized.toCharArray(), record)) {
                hashes.remove(i);
                return true;
            }
        }
        return false;
    }

    private static String randomCode() {
        String alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        StringBuilder sb = new StringBuilder(CODE_LENGTH);
        java.security.SecureRandom random = new java.security.SecureRandom();
        for (int i = 0; i < CODE_LENGTH; i++) {
            if (i == 5) {
                sb.append('-');
            }
            sb.append(alphabet.charAt(random.nextInt(alphabet.length())));
        }
        return sb.toString();
    }

    private static String normalize(String code) {
        return code.trim().toUpperCase(Locale.ROOT).replace("-", "");
    }
}
