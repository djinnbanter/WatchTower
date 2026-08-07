package dev.mcstatus.watchtower.core;

/**
 * On-disk filenames under {@code <server>/watchtower/}.
 */
public final class WatchtowerFiles {
    public static final String CONF_FILENAME = "watchtower.conf";
    public static final String STATE_FILENAME = ".watchtower-state.json";
    public static final String FACTS_PREFIX = "watchtower-facts-";
    public static final String BRIEF_PREFIX = "watchtower-brief-";
    /** Support-compose artifacts — excluded from BAU {@link dev.mcstatus.watchtower.core.collect.ReportArtifactFinder}. */
    public static final String SUPPORT_FACTS_INFIX = "-support-";
    public static final String OPS_CACHE_FILENAME = "ops-cache.json";
    public static final String CONFIG_BACKUPS_DIR = "config-backups";
    /** In-flight Modrinth jar downloads for assisted mutate jobs. */
    public static final String MOD_STAGING_DIR = "mod-staging";
    /** Successful swap/quarantine jar backups + index. */
    public static final String MOD_BACKUPS_DIR = "mod-backups";

    private WatchtowerFiles() {
    }
}
