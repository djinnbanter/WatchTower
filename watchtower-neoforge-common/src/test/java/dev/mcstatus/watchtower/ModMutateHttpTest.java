package dev.mcstatus.watchtower;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import dev.mcstatus.watchtower.core.collect.ModMutateImpactFingerprint;
import dev.mcstatus.watchtower.core.collect.ModMutateJob;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ModMutateHttpTest {

    @Test
    void parseBatchStepsRejectsNonObjectElements() {
        JsonArray steps = JsonParser.parseString("""
                [
                  {"mod_id":"a","modrinth_version_id":"v1"},
                  "not-an-object",
                  {"mod_id":"b","modrinth_version_id":"v2"}
                ]
                """).getAsJsonArray();
        List<ModMutateJob.Step> out = new ArrayList<>();
        assertEquals("invalid_step", ModMutateHttp.parseBatchSteps(steps, out));
        assertEquals(0, out.size());
        assertEquals("Each step must be a JSON object", ModMutateHttp.batchStepErrorMessage(steps));
    }

    @Test
    void parseBatchStepsRejectsMissingModIdOrVersion() {
        JsonArray missingModId = JsonParser.parseString("""
                [{"modrinth_version_id":"v1"}]
                """).getAsJsonArray();
        List<ModMutateJob.Step> outModId = new ArrayList<>();
        assertEquals("invalid_step", ModMutateHttp.parseBatchSteps(missingModId, outModId));
        assertEquals(0, outModId.size());
        assertEquals("Each step needs mod_id and modrinth_version_id",
                ModMutateHttp.batchStepErrorMessage(missingModId));

        JsonArray missingVersion = JsonParser.parseString("""
                [{"mod_id":"a"}]
                """).getAsJsonArray();
        List<ModMutateJob.Step> outVersion = new ArrayList<>();
        assertEquals("invalid_step", ModMutateHttp.parseBatchSteps(missingVersion, outVersion));
        assertEquals(0, outVersion.size());
        assertEquals("Each step needs mod_id and modrinth_version_id",
                ModMutateHttp.batchStepErrorMessage(missingVersion));
    }

    @Test
    void batchStepErrorMessageForNonObjectElement() {
        JsonArray steps = JsonParser.parseString("""
                [42]
                """).getAsJsonArray();
        assertEquals("Each step must be a JSON object", ModMutateHttp.batchStepErrorMessage(steps));
    }

    @Test
    void batchStepErrorMessageForMissingFields() {
        JsonArray steps = JsonParser.parseString("""
                [{"mod_id":"a"}]
                """).getAsJsonArray();
        assertEquals("Each step needs mod_id and modrinth_version_id",
                ModMutateHttp.batchStepErrorMessage(steps));
    }

    @Test
    void needsWorldRiskConfirmWhenHighAndUnconfirmed() {
        JsonObject body = new JsonObject();
        body.addProperty("confirm", true);
        JsonObject risk = new JsonObject();
        risk.addProperty("level", "high");
        assertTrue(ModMutateHttp.needsWorldRiskConfirm(body, risk));
    }

    @Test
    void needsWorldRiskConfirmFalseWhenConfirmed() {
        JsonObject body = new JsonObject();
        body.addProperty("confirm_world_risk", true);
        JsonObject risk = new JsonObject();
        risk.addProperty("level", "high");
        assertFalse(ModMutateHttp.needsWorldRiskConfirm(body, risk));
    }

    @Test
    void needsWorldRiskConfirmFalseWhenLevelNone() {
        JsonObject body = new JsonObject();
        JsonObject risk = new JsonObject();
        risk.addProperty("level", "none");
        assertFalse(ModMutateHttp.needsWorldRiskConfirm(body, risk));
    }

    @Test
    void installFingerprintMatchesSwapCompute() {
        String expected = ModMutateImpactFingerprint.compute(
                "create", "ver_1", "safe", "ok", "[]");
        assertTrue(ModMutateImpactFingerprint.matches(expected, expected));
        assertFalse(ModMutateImpactFingerprint.matches(
                expected,
                ModMutateImpactFingerprint.compute("create", "ver_2", "safe", "ok", "[]")));
    }

    @Test
    void impactFingerprintBlankIsRejected() {
        assertTrue(ModMutateHttp.isBlankImpactFingerprint(new JsonObject()));
        JsonObject body = new JsonObject();
        body.addProperty("impact_fingerprint", "   ");
        assertTrue(ModMutateHttp.isBlankImpactFingerprint(body));
        body.addProperty("impact_fingerprint", "ifp_abc");
        assertFalse(ModMutateHttp.isBlankImpactFingerprint(body));
    }

    @Test
    void parseBatchStepsAcceptsValidObjects() {
        JsonArray steps = JsonParser.parseString("""
                [
                  {"mod_id":"a","modrinth_version_id":"v1","jar":"a.jar"},
                  {"mod_id":"b","version_id":"v2"}
                ]
                """).getAsJsonArray();
        List<ModMutateJob.Step> out = new ArrayList<>();
        assertNull(ModMutateHttp.parseBatchSteps(steps, out));
        assertEquals(2, out.size());
        assertEquals("a", out.get(0).mod_id);
        assertEquals("v1", out.get(0).version_id);
        assertEquals("a.jar", out.get(0).jar_basename);
        assertEquals("b", out.get(1).mod_id);
        assertEquals("v2", out.get(1).version_id);
    }
}
