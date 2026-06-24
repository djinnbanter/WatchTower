package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.report.ReportConfig;

/**
 * Heuristic detection of client-oriented mods installed on a dedicated server.
 */
public final class ClientModDetector {

    public enum Bucket {
        LIKELY_REMOVABLE("likely_removable"),
        CLIENT_LIBRARY("client_library"),
        UNCERTAIN("uncertain"),
        TEST_REMOVE("test_remove");

        private final String id;

        Bucket(String id) {
            this.id = id;
        }

        public String id() {
            return id;
        }
    }

    private ClientModDetector() {
    }

    public static void apply(JsonObject optional) {
        apply(optional, ReportConfig.builder().build(), "");
    }

    public static void apply(JsonObject optional, ReportConfig config, String serverDir) {
        ModSideScorer.apply(optional, config, serverDir != null ? serverDir : "");
    }
}
