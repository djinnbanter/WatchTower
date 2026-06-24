package dev.mcstatus.watchtower.core;

/**
 * On-disk filenames under {@code <server>/watchtower/}.
 */
public final class WatchtowerFiles {
    public static final String CONF_FILENAME = "watchtower.conf";
    public static final String STATE_FILENAME = ".watchtower-state.json";
    public static final String FACTS_PREFIX = "watchtower-facts-";
    public static final String BRIEF_PREFIX = "watchtower-brief-";
    public static final String OPS_CACHE_FILENAME = "ops-cache.json";

    private WatchtowerFiles() {
    }
}
