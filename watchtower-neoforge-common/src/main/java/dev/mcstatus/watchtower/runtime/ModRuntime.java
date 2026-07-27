package dev.mcstatus.watchtower.runtime;

import dev.mcstatus.watchtower.WatchtowerRuntimeState;
import dev.mcstatus.watchtower.WatchtowerScheduler;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Process-wide binding for the active server context and config (set on server start).
 */
public final class ModRuntime {
    private static final Logger FALLBACK_LOG = LoggerFactory.getLogger("watchtower");
    private static final ModRuntimeConfig DEFAULTS = new DefaultModRuntimeConfig();

    private static volatile ServerContext context;
    private static volatile ModRuntimeConfig config;
    private static volatile WatchtowerRuntimeState state;
    private static volatile WatchtowerScheduler scheduler;

    private ModRuntime() {
    }

    public static void set(ServerContext ctx, ModRuntimeConfig cfg) {
        context = ctx;
        config = cfg != null ? cfg : DEFAULTS;
    }

    public static void bindServices(WatchtowerRuntimeState runtimeState, WatchtowerScheduler sched) {
        state = runtimeState;
        scheduler = sched;
    }

    public static void clear() {
        context = null;
        config = null;
        state = null;
        scheduler = null;
    }

    public static ServerContext context() {
        return context;
    }

    public static ServerContext requireContext() {
        ServerContext ctx = context;
        if (ctx == null) {
            throw new IllegalStateException("Watchtower ServerContext is not bound");
        }
        return ctx;
    }

    public static ModRuntimeConfig config() {
        ModRuntimeConfig cfg = config;
        return cfg != null ? cfg : DEFAULTS;
    }

    public static WatchtowerRuntimeState state() {
        return state;
    }

    public static WatchtowerRuntimeState requireState() {
        WatchtowerRuntimeState s = state;
        if (s == null) {
            throw new IllegalStateException("Watchtower runtime state is not bound");
        }
        return s;
    }

    public static WatchtowerScheduler scheduler() {
        return scheduler;
    }

    public static WatchtowerScheduler requireScheduler() {
        WatchtowerScheduler s = scheduler;
        if (s == null) {
            throw new IllegalStateException("Watchtower scheduler is not bound");
        }
        return s;
    }

    public static Logger logger() {
        ServerContext ctx = context;
        return ctx != null ? ctx.logger() : FALLBACK_LOG;
    }

    private static final class DefaultModRuntimeConfig implements ModRuntimeConfig {
        @Override
        public boolean dashboardEnabled() {
            return true;
        }

        @Override
        public String dashboardBindHost() {
            return "0.0.0.0";
        }

        @Override
        public int dashboardPort() {
            return 8787;
        }

        @Override
        public String dashboardAuthToken() {
            return "";
        }

        @Override
        public int sampleIntervalSeconds() {
            return 60;
        }

        @Override
        public int reportTimeoutMinutes() {
            return 15;
        }

        @Override
        public int lookbackHours() {
            return 24;
        }

        @Override
        public boolean incremental() {
            return true;
        }

        @Override
        public boolean countEntities() {
            return true;
        }

        @Override
        public int liveSampleIntervalSeconds() {
            return 1;
        }

        @Override
        public int liveRetentionHours() {
            return 2160;
        }

        @Override
        public int livePregenTailIntervalSeconds() {
            return 5;
        }

        @Override
        public int liveCountEntitiesIntervalSeconds() {
            return 30;
        }

        @Override
        public int liveStorageIntervalSeconds() {
            return 300;
        }

        @Override
        public int liveFlushIntervalSeconds() {
            return 30;
        }
    }
}
