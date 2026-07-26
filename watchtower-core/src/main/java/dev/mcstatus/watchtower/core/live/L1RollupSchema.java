package dev.mcstatus.watchtower.core.live;

/**
 * L1 performance rollup file schema (minute aggregates from L0 live samples).
 *
 * <p>Minute row fields include TPS/MSPT/heap/GC plus optional disk capacity and I/O
 * ({@code disk_use_pct_avg}, {@code disk_free_gb_avg}, {@code disk_write_mb_s_avg},
 * {@code disk_write_await_ms_avg}) for fill projection and I/O health (1.1.2).
 */
public final class L1RollupSchema {

    public static final int SCHEMA = 1;
    public static final int INTERVAL_SEC = 60;

    private L1RollupSchema() {
    }
}
