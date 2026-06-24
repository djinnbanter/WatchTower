package dev.mcstatus.watchtower.core;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.analyze.PreCrashContextBuilder;
import dev.mcstatus.watchtower.core.collect.CraftyCollector;
import dev.mcstatus.watchtower.core.live.LiveHistoryStore;
import dev.mcstatus.watchtower.core.report.ReportConfig;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;

import static org.junit.jupiter.api.Assertions.*;

class PreCrashContextBuilderTest {

  private static final DateTimeFormatter LOG_TS = DateTimeFormatter.ofPattern("dMMMyyyy HH:mm:ss", java.util.Locale.ENGLISH);

  @Test
  void buildIncludesTpsFromLiveHistory() throws Exception {
    LiveHistoryStore store = new LiveHistoryStore();
    store.configure(1, 24, 30, null);
    long crashEpoch = Instant.now().getEpochSecond();

    for (int i = 9; i >= 0; i--) {
      JsonObject snap = new JsonObject();
      snap.addProperty("tps", 18.0 + i * 0.2);
      snap.addProperty("mspt", 40.0 + i);
      store.append(snap);
      Thread.sleep(5);
    }

    Path tmp = Files.createTempDirectory("wt-precrash");
    Path log = tmp.resolve("logs").resolve("latest.log");
    Files.createDirectories(log.getParent());
    Files.writeString(log, "", StandardCharsets.UTF_8);

    JsonObject pre = PreCrashContextBuilder.build(crashEpoch, 10, store, log, new JsonObject(), new JsonArray());
    assertTrue(pre.has("tps"));
    JsonObject tps = pre.getAsJsonObject("tps");
    assertTrue(tps.getAsJsonArray("points").size() > 0);
    assertNull(pre.get("unavailable_reason"));
  }

  @Test
  void buildParsesCommandsAndPregenFromLog() throws Exception {
    Path tmp = Files.createTempDirectory("wt-precrash-log");
    Path log = tmp.resolve("latest.log");
    ZonedDateTime when = ZonedDateTime.now(ZoneId.systemDefault()).minusMinutes(3);
    String ts = "[" + LOG_TS.format(when) + "]";
    String body = ts + " [Server thread/INFO]: Admin issued server command: /chunky continue\n"
        + ts + " [Server thread/INFO]: Generated radius: 12.5 / 500 chunks (42 cps, 2.5%)\n";
    Files.writeString(log, body, StandardCharsets.UTF_8);

    long crashEpoch = Instant.now().getEpochSecond();
    JsonObject pre = PreCrashContextBuilder.build(crashEpoch, 10, null, log, new JsonObject(), new JsonArray());

    assertTrue(pre.has("commands"));
    assertEquals(1, pre.getAsJsonArray("commands").size());
    assertEquals("/chunky continue", pre.getAsJsonArray("commands").get(0).getAsJsonObject().get("command").getAsString());

    assertTrue(pre.has("chunk_gen"));
    assertEquals("dh_pregen", pre.getAsJsonObject("chunk_gen").get("source").getAsString());
    assertEquals(2.5, pre.getAsJsonObject("chunk_gen").get("pct").getAsDouble(), 0.01);
    assertTrue(pre.has("unavailable_reason"));
  }

  @Test
  void buildIncludesLogTailFromWindow() throws Exception {
    Path tmp = Files.createTempDirectory("wt-precrash-tail");
    Path log = tmp.resolve("latest.log");
    ZonedDateTime base = ZonedDateTime.now(ZoneId.systemDefault()).minusMinutes(5);
    String ts1 = "[" + LOG_TS.format(base) + "]";
    String ts2 = "[" + LOG_TS.format(base.plusMinutes(1)) + "]";
    String ts3 = "[" + LOG_TS.format(base.plusMinutes(2)) + "]";
    String body = ts1 + " [Server thread/INFO]: First line in window\n"
        + ts2 + " [Server thread/INFO]: Second line in window\n"
        + ts3 + " [Server thread/INFO]: Last line before crash\n";
    Files.writeString(log, body, StandardCharsets.UTF_8);

    long crashEpoch = Instant.now().getEpochSecond();
    JsonObject pre = PreCrashContextBuilder.build(crashEpoch, 10, null, log, new JsonObject(), new JsonArray());

    assertTrue(pre.has("log_tail"));
    JsonArray tail = pre.getAsJsonArray("log_tail");
    assertEquals(3, tail.size());
    assertTrue(tail.get(2).getAsString().contains("Last line before crash"));
  }

  @Test
  void discoverBackupDirsOnlyUsesExplicitConfiguration() throws Exception {
    Path tmp = Files.createTempDirectory("wt-discopanel-backup");
    Path serverDir = tmp.resolve("discopanel").resolve("data").resolve("servers").resolve("srv1");
    Files.createDirectories(serverDir);
    Path discoBackups = tmp.resolve("discopanel").resolve("backups");
    Files.createDirectories(discoBackups);

    ReportConfig unconfigured = ReportConfig.builder()
        .serverDir(serverDir.toString())
        .lookbackHours(24)
        .build();
    var dirsEmpty = CraftyCollector.discoverBackupDirs(unconfigured, serverDir.toString());
    assertTrue(dirsEmpty.isEmpty(), "expected no auto-discovery: " + dirsEmpty);

    ReportConfig configured = ReportConfig.builder()
        .serverDir(serverDir.toString())
        .backupDir(discoBackups.toString())
        .lookbackHours(24)
        .build();
    var dirs = CraftyCollector.discoverBackupDirs(configured, serverDir.toString());
    boolean hasDisco = dirs.stream().anyMatch(p -> p.toString().replace('\\', '/').contains("discopanel/backups"));
    assertTrue(hasDisco, "expected configured discopanel/backups in discovery: " + dirs);
  }
}
