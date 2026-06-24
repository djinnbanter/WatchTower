package dev.mcstatus.watchtower.core.analyze;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class TechModLogClassifierTest {

    @Test
    void classifiesKubeJs() {
        TechModLogClassifier.Hit hit = TechModLogClassifier.classify(
                "[KubeJS Server] ERROR Error in 'startup_scripts/test.js'");
        assertEquals(TechModLogClassifier.TechCategory.KUBEJS_SCRIPT, hit.category());
        assertEquals("kubejs", hit.modId());
    }

    @Test
    void classifiesCreate() {
        TechModLogClassifier.Hit hit = TechModLogClassifier.classify(
                "[ERROR] ContinuousOBBCollider contraption stuck");
        assertEquals(TechModLogClassifier.TechCategory.CREATE_CONTRAPTION, hit.category());
    }
}
