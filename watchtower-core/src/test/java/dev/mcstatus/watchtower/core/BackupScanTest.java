package dev.mcstatus.watchtower.core;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.brief.BriefFormatters;
import dev.mcstatus.watchtower.core.collect.CraftyCollector;
import dev.mcstatus.watchtower.core.report.ReportConfig;
import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.*;

class BackupScanTest {

    @Test
    void backupInventoryFromMultipleDirs() throws Exception {
        Path tmp = Files.createTempDirectory("wt-backup-inv");
        Path backupA = tmp.resolve("backups-a");
        Path backupB = tmp.resolve("backups-b");
        Files.createDirectories(backupA);
        Files.createDirectories(backupB);
        Path serverDir = tmp.resolve("server-uuid1234");
        Files.createDirectories(serverDir);

        Path archiveA = backupA.resolve("server-uuid1234-world.tar.gz");
        Path archiveB = backupB.resolve("server-uuid1234-world-older.tar.gz");
        Files.writeString(archiveA, "newer");
        Files.writeString(archiveB, "older");
        Files.setLastModifiedTime(archiveA, java.nio.file.attribute.FileTime.fromMillis(System.currentTimeMillis()));
        Files.setLastModifiedTime(archiveB, java.nio.file.attribute.FileTime.fromMillis(System.currentTimeMillis() - 86400000L));

        JsonObject staging = new JsonObject();
        staging.add("optional", new JsonObject());
        ReportConfig config = ReportConfig.builder()
                .serverDir(serverDir.toString())
                .backupDirs(backupA.toString(), backupB.toString())
                .lookbackHours(24 * 30)
                .build();

        CraftyCollector.scanBackups(staging, serverDir.toString(), 0, config);
        JsonObject optional = staging.getAsJsonObject("optional");
        JsonObject last = optional.getAsJsonObject("last_backup");
        assertEquals("success", last.get("status").getAsString());
        assertTrue(optional.has("backup_inventory"));
        assertTrue(last.get("inventory_count").getAsInt() >= 2);
        assertEquals(2, last.get("searched_dirs").getAsInt());
    }

    @Test
    void emptyBackupDirReportsReason() throws Exception {
        Path tmp = Files.createTempDirectory("wt-backup");
        Path backupDir = tmp.resolve("backups");
        Files.createDirectories(backupDir);
        Path serverDir = tmp.resolve("server");
        Files.createDirectories(serverDir);

        JsonObject staging = new JsonObject();
        staging.add("optional", new JsonObject());
        ReportConfig config = ReportConfig.builder()
                .serverDir(serverDir.toString())
                .backupDir(backupDir.toString())
                .lookbackHours(24)
                .build();

        CraftyCollector.scanBackups(staging, serverDir.toString(), 0, config);
        JsonObject last = staging.getAsJsonObject("optional").getAsJsonObject("last_backup");
        assertEquals("not_found", last.get("status").getAsString());
        assertEquals("empty", last.get("reason").getAsString());
        assertTrue(last.has("search_dirs"));
        assertEquals(0, last.get("files_seen").getAsInt());

        String line = BriefFormatters.fmtBackupLine(last);
        assertTrue(line.contains("NOT FOUND"));
        assertTrue(line.contains("empty"));
    }

    @Test
    void notFoundBackupRaisesIssueInFacts() throws Exception {
        Path tmp = Files.createTempDirectory("wt-backup-facts");
        Path backupDir = tmp.resolve("backups");
        Files.createDirectories(backupDir);
        Path serverDir = tmp.resolve("server");
        Files.createDirectories(serverDir);

        JsonObject staging = new JsonObject();
        staging.add("meta", new JsonObject());
        staging.add("flags", new JsonObject());
        JsonObject mc = new JsonObject();
        mc.addProperty("log_had_activity_in_window", true);
        staging.add("minecraft", mc);
        JsonObject system = new JsonObject();
        staging.add("system", system);
        staging.add("events", new JsonArray());
        staging.add("thresholds", new JsonObject());
        JsonObject optional = new JsonObject();
        JsonObject last = new JsonObject();
        last.addProperty("status", "not_found");
        last.addProperty("reason", "empty");
        optional.add("last_backup", last);
        staging.add("optional", optional);

        JsonObject facts = dev.mcstatus.watchtower.core.analyze.ReportPipeline.buildFacts(staging);
        JsonArray issues = facts.getAsJsonArray("issues");
        boolean found = false;
        for (var el : issues) {
            if ("BACKUP_NOT_FOUND".equals(el.getAsJsonObject().get("id").getAsString())) {
                found = true;
                break;
            }
        }
        assertTrue(found, "BACKUP_NOT_FOUND issue expected");
    }

    @Test
    void craftyTimestampBackupInServerUuidDir() throws Exception {
        Path tmp = Files.createTempDirectory("wt-crafty-backup");
        String serverId = "00000000-0000-0000-0000-000000000001";
        Path craftyRoot = tmp.resolve("crafty-4");
        Path serverDir = craftyRoot.resolve("servers").resolve(serverId);
        Path backupDir = craftyRoot.resolve("backups").resolve(serverId);
        Files.createDirectories(serverDir);
        Files.createDirectories(backupDir);
        Path archive = backupDir.resolve("2026-06-17_01-06-30.zip");
        Files.writeString(archive, "backup");

        JsonObject staging = new JsonObject();
        staging.add("optional", new JsonObject());
        ReportConfig config = ReportConfig.builder()
                .serverDir(serverDir.toString())
                .backupDir(backupDir.toString())
                .lookbackHours(24 * 30)
                .build();

        CraftyCollector.scanBackups(staging, serverDir.toString(), 0, config);
        JsonObject last = staging.getAsJsonObject("optional").getAsJsonObject("last_backup");
        assertEquals("success", last.get("status").getAsString(), "Crafty timestamp zip in UUID folder should match");
        assertEquals("2026-06-17_01-06-30.zip", last.get("path").getAsString());
    }

    @Test
    void pterodactylFlatBackupUuidFilename() throws Exception {
        Path tmp = Files.createTempDirectory("wt-ptero-backup");
        Path backupDir = tmp.resolve("pterodactyl").resolve("backups");
        Files.createDirectories(backupDir);
        Path serverDir = tmp.resolve("pterodactyl").resolve("volumes").resolve("d3aac109-server-uuid");
        Files.createDirectories(serverDir);
        Path archive = backupDir.resolve("550e8400-e29b-41d4-a716-446655440000.tar.gz");
        Files.writeString(archive, "backup");

        JsonObject staging = new JsonObject();
        staging.add("optional", new JsonObject());
        ReportConfig config = ReportConfig.builder()
                .serverDir(serverDir.toString())
                .backupDir(backupDir.toString())
                .lookbackHours(24 * 30)
                .build();

        CraftyCollector.scanBackups(staging, serverDir.toString(), 0, config);
        JsonObject last = staging.getAsJsonObject("optional").getAsJsonObject("last_backup");
        assertEquals("success", last.get("status").getAsString(),
                "Wings backup UUID filename should match in flat pterodactyl/backups dir");
    }

    @Test
    void ampInstanceBackupsFolder() throws Exception {
        Path tmp = Files.createTempDirectory("wt-amp-backup");
        Path serverDir = tmp.resolve(".ampdata").resolve("instances").resolve("Minecraft01");
        Path backups = serverDir.resolve("Backups");
        Files.createDirectories(backups);
        Path archive = backups.resolve("2026-06-17-01-06-30.zip");
        Files.writeString(archive, "backup");

        JsonObject staging = new JsonObject();
        staging.add("optional", new JsonObject());
        ReportConfig config = ReportConfig.builder()
                .serverDir(serverDir.toString())
                .backupDir(backups.toString())
                .lookbackHours(24 * 30)
                .build();

        CraftyCollector.scanBackups(staging, serverDir.toString(), 0, config);
        JsonObject last = staging.getAsJsonObject("optional").getAsJsonObject("last_backup");
        assertEquals("success", last.get("status").getAsString());
    }

    @Test
    void mineOsPerServerBackupDir() throws Exception {
        Path tmp = Files.createTempDirectory("wt-mineos-backup");
        Path serverDir = tmp.resolve("games").resolve("minecraft").resolve("servers").resolve("survival");
        Path backupDir = tmp.resolve("games").resolve("minecraft").resolve("backup").resolve("survival");
        Files.createDirectories(serverDir);
        Files.createDirectories(backupDir);
        Path archive = backupDir.resolve("survival-2026-06-17.tar.gz");
        Files.writeString(archive, "backup");

        JsonObject staging = new JsonObject();
        staging.add("optional", new JsonObject());
        ReportConfig config = ReportConfig.builder()
                .serverDir(serverDir.toString())
                .backupDir(backupDir.toString())
                .lookbackHours(24 * 30)
                .build();

        CraftyCollector.scanBackups(staging, serverDir.toString(), 0, config);
        JsonObject last = staging.getAsJsonObject("optional").getAsJsonObject("last_backup");
        assertEquals("success", last.get("status").getAsString());
    }

    @Test
    void unconfiguredBackupDir() {
        JsonObject staging = new JsonObject();
        staging.add("optional", new JsonObject());
        ReportConfig config = ReportConfig.builder()
                .serverDir("/nonexistent/server")
                .backupDir("")
                .lookbackHours(24)
                .build();

        CraftyCollector.scanBackups(staging, "/nonexistent/server", 0, config);
        JsonObject last = staging.getAsJsonObject("optional").getAsJsonObject("last_backup");
        assertEquals("unconfigured", last.get("status").getAsString());
        String line = BriefFormatters.fmtBackupLine(last);
        assertTrue(line.contains("unconfigured"));
    }

    @Test
    void craftyBackupFoundViaServerUuidConfigWhenFolderNameDiffers() throws Exception {
        Path tmp = Files.createTempDirectory("wt-crafty-uuid-cfg");
        String serverUuid = "00000000-0000-0000-0000-000000000001";
        Path craftyRoot = tmp.resolve("crafty-4");
        Path serverDir = craftyRoot.resolve("servers").resolve("example-host");
        Path backupDir = craftyRoot.resolve("backups").resolve(serverUuid);
        Files.createDirectories(serverDir);
        Files.createDirectories(backupDir);
        Path archive = backupDir.resolve("2026-06-17_01-06-30.zip");
        Files.writeString(archive, "backup");

        JsonObject staging = new JsonObject();
        staging.add("optional", new JsonObject());
        ReportConfig config = ReportConfig.builder()
                .serverDir(serverDir.toString())
                .backupDir(backupDir.toString())
                .craftyServerUuid(serverUuid)
                .lookbackHours(24 * 30)
                .build();

        CraftyCollector.scanBackups(staging, serverDir.toString(), 0, config);
        JsonObject last = staging.getAsJsonObject("optional").getAsJsonObject("last_backup");
        assertEquals("success", last.get("status").getAsString());
        assertEquals("2026-06-17_01-06-30.zip", last.get("path").getAsString());
    }

    @Test
    void nestedZipInUuidSubfolderOfParentBackupsDir() throws Exception {
        Path tmp = Files.createTempDirectory("wt-crafty-nested");
        Path backupsParent = tmp.resolve("backups");
        Path uuidDir = backupsParent.resolve("a1b2c3d4-e5f6-7890-abcd-ef1234567890");
        Files.createDirectories(uuidDir);
        Path archive = uuidDir.resolve("world.zip");
        Files.writeString(archive, "backup");
        Path serverDir = tmp.resolve("server");
        Files.createDirectories(serverDir);

        JsonObject staging = new JsonObject();
        staging.add("optional", new JsonObject());
        ReportConfig config = ReportConfig.builder()
                .serverDir(serverDir.toString())
                .backupDir(backupsParent.toString())
                .lookbackHours(24 * 30)
                .build();

        CraftyCollector.scanBackups(staging, serverDir.toString(), 0, config);
        JsonObject last = staging.getAsJsonObject("optional").getAsJsonObject("last_backup");
        assertEquals("success", last.get("status").getAsString());
        assertEquals("world.zip", last.get("path").getAsString());
    }

    @Test
    void craftyNestedBackupJobUuidFolder() throws Exception {
        Path tmp = Files.createTempDirectory("wt-crafty-job");
        String serverUuid = "00000000-0000-0000-0000-000000000001";
        String jobUuid = "c4520153-58b6-4431-8a22-c4662701ae85";
        Path craftyRoot = tmp.resolve("crafty-4");
        Path serverDir = craftyRoot.resolve("servers").resolve(serverUuid);
        Path jobDir = craftyRoot.resolve("backups").resolve(serverUuid).resolve(jobUuid);
        Files.createDirectories(serverDir);
        Files.createDirectories(jobDir);
        Path archive = jobDir.resolve("2026-06-17_01-06-30.zip");
        Files.writeString(archive, "backup");

        JsonObject staging = new JsonObject();
        staging.add("optional", new JsonObject());
        ReportConfig config = ReportConfig.builder()
                .serverDir(serverDir.toString())
                .backupDirs(jobDir.toString())
                .lookbackHours(24 * 30)
                .build();

        CraftyCollector.scanBackups(staging, serverDir.toString(), 0, config);
        JsonObject last = staging.getAsJsonObject("optional").getAsJsonObject("last_backup");
        assertEquals("success", last.get("status").getAsString());
        assertEquals("2026-06-17_01-06-30.zip", last.get("path").getAsString());
    }

    @Test
    void craftyNestedBackupJobUuidViaConfiguredParentDir() throws Exception {
        Path tmp = Files.createTempDirectory("wt-crafty-job-auto");
        String serverUuid = "00000000-0000-0000-0000-000000000001";
        String jobUuid = "c4520153-58b6-4431-8a22-c4662701ae85";
        Path craftyRoot = tmp.resolve("crafty-4");
        Path serverDir = craftyRoot.resolve("servers").resolve(serverUuid);
        Path serverBackupDir = craftyRoot.resolve("backups").resolve(serverUuid);
        Path jobDir = serverBackupDir.resolve(jobUuid);
        Files.createDirectories(serverDir);
        Files.createDirectories(jobDir);
        Files.writeString(jobDir.resolve("2026-06-17_01-06-30.zip"), "backup");

        JsonObject staging = new JsonObject();
        staging.add("optional", new JsonObject());
        ReportConfig config = ReportConfig.builder()
                .serverDir(serverDir.toString())
                .backupDir(serverBackupDir.toString())
                .lookbackHours(24 * 30)
                .build();

        CraftyCollector.scanBackups(staging, serverDir.toString(), 0, config);
        JsonObject last = staging.getAsJsonObject("optional").getAsJsonObject("last_backup");
        assertEquals("success", last.get("status").getAsString());
    }

    @Test
    void unconfiguredBackupDirSkipsAutoDiscovery() throws Exception {
        Path tmp = Files.createTempDirectory("wt-crafty-no-auto");
        String serverUuid = "00000000-0000-0000-0000-000000000001";
        Path craftyRoot = tmp.resolve("crafty-4");
        Path serverDir = craftyRoot.resolve("servers").resolve(serverUuid);
        Path backupDir = craftyRoot.resolve("backups").resolve(serverUuid);
        Files.createDirectories(serverDir);
        Files.createDirectories(backupDir);
        Files.writeString(backupDir.resolve("2026-06-17_01-06-30.zip"), "backup");

        JsonObject staging = new JsonObject();
        staging.add("optional", new JsonObject());
        ReportConfig config = ReportConfig.builder()
                .serverDir(serverDir.toString())
                .lookbackHours(24 * 30)
                .build();

        CraftyCollector.scanBackups(staging, serverDir.toString(), 0, config);
        JsonObject last = staging.getAsJsonObject("optional").getAsJsonObject("last_backup");
        assertEquals("unconfigured", last.get("status").getAsString());
    }
}
