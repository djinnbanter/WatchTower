package dev.mcstatus.watchtower.core.analyze;

import org.junit.jupiter.api.Test;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.report.ReportConfig;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class BackupVerifyPolicyTest {

    @Test
    void deferWhenPlayers() {
        ReportConfig c = ReportConfig.builder()
                .backupVerifyDeferWhenPlayers(true)
                .backupVerifyMaxMspt(40)
                .build();
        assertTrue(BackupVerifyPolicy.shouldDeferAuto(2, 10, c));
        assertFalse(BackupVerifyPolicy.shouldDeferAuto(0, 10, c));
    }

    @Test
    void deferWhenMsptHigh() {
        ReportConfig c = ReportConfig.builder()
                .backupVerifyDeferWhenPlayers(false)
                .backupVerifyMaxMspt(40)
                .build();
        assertTrue(BackupVerifyPolicy.shouldDeferAuto(0, 41, c));
        assertFalse(BackupVerifyPolicy.shouldDeferAuto(0, 39, c));
    }

    @Test
    void pathsNeedingVerifySkipsFinished() {
        JsonObject live = new JsonObject();
        JsonArray inv = new JsonArray();
        JsonObject a = new JsonObject();
        a.addProperty("path", "/b/a.zip");
        JsonObject va = new JsonObject();
        va.addProperty("status", "verified");
        a.add("verify", va);
        inv.add(a);
        JsonObject b = new JsonObject();
        b.addProperty("path", "/b/b.zip");
        inv.add(b);
        live.add("inventory", inv);
        List<String> need = BackupVerifyPolicy.pathsNeedingVerify(live);
        assertEquals(1, need.size());
        assertTrue(need.get(0).contains("b.zip"));
    }
}
