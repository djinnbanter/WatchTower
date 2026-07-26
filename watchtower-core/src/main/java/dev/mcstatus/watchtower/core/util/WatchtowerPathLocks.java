package dev.mcstatus.watchtower.core.util;

import java.nio.file.Path;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Process-local mutexes keyed by absolute path so load→mutate→write cycles on
 * {@code ops-cache.json} / {@code .watchtower-state.json} do not clobber each other.
 */
public final class WatchtowerPathLocks {

    private static final ConcurrentHashMap<String, Object> LOCKS = new ConcurrentHashMap<>();

    private WatchtowerPathLocks() {
    }

    public static Object lockFor(Path path) {
        if (path == null) {
            return WatchtowerPathLocks.class;
        }
        String key = path.toAbsolutePath().normalize().toString();
        return LOCKS.computeIfAbsent(key, k -> new Object());
    }
}
