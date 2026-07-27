package dev.mcstatus.watchtower.runtime;

/**
 * Online player row for roster overlay (no Minecraft types).
 */
public record OnlinePlayerView(String name, String uuid, int ping, String dimension) {
}
