package dev.mcstatus.watchtower;

import dev.mcstatus.watchtower.core.report.ReportEngine;

/**
 * Verifies watchtower-core is loadable at runtime (jar-in-jar present).
 */
public final class EngineProbe {

    private static volatile boolean verified;
    private static volatile boolean available;
    private static volatile String failureReason = "Report engine not verified yet";

    private EngineProbe() {
    }

    public static boolean isAvailable() {
        if (!verified) {
            verify();
        }
        return available;
    }

    public static String getFailureReason() {
        if (!verified) {
            verify();
        }
        return failureReason;
    }

    public static void verify() {
        if (verified) {
            return;
        }
        synchronized (EngineProbe.class) {
            if (verified) {
                return;
            }
            try {
                Class<?> engine = ReportEngine.class;
                Class<?> result = ReportEngine.ReportResult.class;
                if (engine == null || result == null) {
                    markUnavailable("Report engine classes could not be resolved");
                    return;
                }
                available = true;
                failureReason = "OK";
                WatchtowerMod.LOGGER.debug("Watchtower engine probe OK ({})", ReportEngine.ENGINE_VERSION);
            } catch (LinkageError e) {
                markUnavailable(linkageMessage(e));
                WatchtowerMod.LOGGER.error("Watchtower engine probe failed: {}", failureReason, e);
            } catch (Exception e) {
                markUnavailable(e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName());
                WatchtowerMod.LOGGER.error("Watchtower engine probe failed: {}", failureReason, e);
            }
            verified = true;
        }
    }

    private static void markUnavailable(String reason) {
        available = false;
        failureReason = reason;
    }

    private static String linkageMessage(LinkageError e) {
        String msg = e.getMessage();
        if (msg != null && !msg.isBlank()) {
            return "Report engine missing from mod JAR (" + msg + ") — reinstall watchtower-neoforge-2.0.6+";
        }
        return "Report engine missing from mod JAR — reinstall watchtower-neoforge-2.0.6+";
    }
}
