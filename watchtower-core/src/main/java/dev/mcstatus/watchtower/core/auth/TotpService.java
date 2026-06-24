package dev.mcstatus.watchtower.core.auth;

import dev.samstevens.totp.code.CodeGenerator;
import dev.samstevens.totp.code.CodeVerifier;
import dev.samstevens.totp.code.DefaultCodeGenerator;
import dev.samstevens.totp.code.DefaultCodeVerifier;
import dev.samstevens.totp.code.HashingAlgorithm;
import dev.samstevens.totp.exceptions.QrGenerationException;
import dev.samstevens.totp.qr.QrData;
import dev.samstevens.totp.qr.QrGenerator;
import dev.samstevens.totp.qr.ZxingPngQrGenerator;
import dev.samstevens.totp.secret.DefaultSecretGenerator;
import dev.samstevens.totp.secret.SecretGenerator;
import dev.samstevens.totp.time.SystemTimeProvider;
import dev.samstevens.totp.time.TimeProvider;

import java.util.Base64;

/** RFC 6238 TOTP setup and verification. */
public final class TotpService {
    private static final SecretGenerator SECRET_GENERATOR = new DefaultSecretGenerator();
    private static final CodeGenerator CODE_GENERATOR = new DefaultCodeGenerator(HashingAlgorithm.SHA1);
    private static final TimeProvider TIME_PROVIDER = new SystemTimeProvider();
    private static final CodeVerifier CODE_VERIFIER = new DefaultCodeVerifier(CODE_GENERATOR, TIME_PROVIDER);

    private final SecretCipher cipher;

    public TotpService(AuthKeyStore keyStore) {
        this.cipher = new SecretCipher(keyStore.totpAesKey());
    }

    public String generateSecret() {
        return SECRET_GENERATOR.generate();
    }

    public String encryptSecret(String secret) {
        return cipher.encrypt(secret);
    }

    public String decryptSecret(String encrypted) {
        return cipher.decrypt(encrypted);
    }

    public String buildOtpAuthUri(String issuer, String username, String secret) {
        return buildQrData(issuer, username, secret).getUri();
    }

    public QrData buildQrData(String issuer, String username, String secret) {
        return new QrData.Builder()
                .label(username)
                .secret(secret)
                .issuer(issuer)
                .algorithm(HashingAlgorithm.SHA1)
                .digits(6)
                .period(30)
                .build();
    }

    public String qrPngDataUrl(QrData data) throws QrGenerationException {
        QrGenerator generator = new ZxingPngQrGenerator();
        byte[] png = generator.generate(data);
        return "data:image/png;base64," + Base64.getEncoder().encodeToString(png);
    }

    public boolean verifyCode(String secret, String code) {
        if (secret == null || code == null) {
            return false;
        }
        String digits = code.replaceAll("\\s+", "");
        if (!digits.matches("\\d{6}")) {
            return false;
        }
        return CODE_VERIFIER.isValidCode(secret, digits);
    }
}
