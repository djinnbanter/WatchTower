package dev.mcstatus.watchtower.core.auth;

/** One-time plaintext credentials returned when a default or reset password is generated. */
public record GeneratedCredentials(String username, String password) {
}
