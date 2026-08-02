package dev.mcstatus.watchtower.core.analyze;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.collect.LogScanner;
import dev.mcstatus.watchtower.core.ops.IssuesLiveEvaluators;
import dev.mcstatus.watchtower.core.ops.IssuesLiveRecord;
import dev.mcstatus.watchtower.core.report.ReportConfig;
import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.*;

/**
 * FB-11 vs FB-13: MariaDB ACL / GLRA must stay distinct from Create mounted-storage NPE.
 */
class GriefLoggerSignalsIsolationTest {

    @Test
    void combinedLogYieldsTwoDistinctHitsAndIssueIds() throws Exception {
        String aclLine = "[29Jul2026 15:01:12.171] [modloading-worker-0/ERROR] [com.daqem.grieflogger.GriefLogger/]: "
                + "Failed to connect to database, disabling GriefLogger... "
                + "Host '172.19.0.1' is not allowed to connect — Error: 1130-HY000\n";
        String createBlob = """
                [29Jul2026 21:31:11.921] [Server thread/ERROR] [net.minecraft.util.thread.BlockableEventLoop/FATAL]: Error executing task on Server
                java.lang.NullPointerException: Cannot invoke "net.minecraft.world.MenuProvider.getClass()" because "menuProvider" is null
                \tat TRANSFORMER/grieflogger@1.2.9-1.21.1/com.daqem.grieflogger.block.container.ContainerHandler.getContainers(ContainerHandler.java:39)
                \tat TRANSFORMER/create@6.0.10/com.simibubi.create.api.contraption.storage.item.MountedItemStorage.handleInteraction(MountedItemStorage.java:80)
                [29Jul2026 21:31:11.923] Failed to process payload: create:contraption_interact
                """;

        DbAddonSignatures.Hit acl = DbAddonSignatures.match(aclLine.strip());
        assertNotNull(acl);
        assertEquals("db_addon_acl", acl.kind());

        GriefLoggerCreateCompatSignatures.Hit compat = GriefLoggerCreateCompatSignatures.match(createBlob);
        assertNotNull(compat);
        assertEquals("grieflogger_create_compat", compat.kind());
        assertNotEquals(acl.kind(), compat.kind());
        assertNotEquals(DbAddonSignatures.ISSUE_ID, GriefLoggerCreateCompatSignatures.ISSUE_ID);

        // Combined log through LogScanner → both optional blocks + two event types.
        Path server = Files.createTempDirectory("wt-gl-isolation");
        Path logs = Files.createDirectories(server.resolve("logs"));
        Files.writeString(logs.resolve("latest.log"), aclLine + "\n" + createBlob);

        ReportConfig config = ReportConfig.builder()
                .serverDir(server.toString())
                .lookbackHours(24 * 14)
                .build();
        JsonObject staging = new JsonObject();
        staging.add("minecraft", new JsonObject());
        staging.add("optional", new JsonObject());
        staging.add("events", new JsonArray());
        LogScanner.scanLogs(server.toString(), staging, config.windowStartEpoch(), config);

        JsonObject optional = staging.getAsJsonObject("optional");
        assertTrue(optional.has("db_addon_fail"), "expected FB-11 db_addon_fail");
        assertTrue(optional.has("gl_create_npe"), "expected FB-13 gl_create_npe");
        assertEquals("signal_db_addon_fail", optional.getAsJsonObject("db_addon_fail").get("issue_id").getAsString());
        assertEquals("signal_gl_create_npe", optional.getAsJsonObject("gl_create_npe").get("issue_id").getAsString());

        // Ops-cache shaped for Issues Live: both signals present → two issue rows, not one merged id.
        JsonObject cache = new JsonObject();
        cache.add("optional", optional.deepCopy());
        List<IssuesLiveRecord> dbRows = IssuesLiveEvaluators.fromDbAddonFail(cache);
        List<IssuesLiveRecord> glRows = IssuesLiveEvaluators.fromGlCreateNpe(cache);
        assertEquals(1, dbRows.size());
        assertEquals(1, glRows.size());
        assertEquals("SIGNAL_DB_ADDON_FAIL", dbRows.get(0).normalizedKey());
        assertEquals("SIGNAL_GL_CREATE_NPE", glRows.get(0).normalizedKey());

        List<IssuesLiveRecord> merged = IssuesLiveEvaluators.evaluateAndMerge(cache, List.of(), true, "2026-08-02T12:00:00Z");
        Set<String> keys = merged.stream()
                .filter(r -> "SIGNAL_DB_ADDON_FAIL".equals(r.normalizedKey())
                        || "SIGNAL_GL_CREATE_NPE".equals(r.normalizedKey()))
                .map(IssuesLiveRecord::normalizedKey)
                .collect(Collectors.toSet());
        assertEquals(Set.of("SIGNAL_DB_ADDON_FAIL", "SIGNAL_GL_CREATE_NPE"), keys,
                "combined log must yield two distinct Issues Live keys, not one merged row");
    }
}
