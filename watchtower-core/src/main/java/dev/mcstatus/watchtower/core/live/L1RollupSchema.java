package dev.mcstatus.watchtower.core.live;

/**
 * L1 performance rollup file schema (minute aggregates from L0 live samples).
 */
public final class L1RollupSchema {

    public static final int SCHEMA = 1;
    public static final int INTERVAL_SEC = 60;

    private L1RollupSchema() {
    }
}
