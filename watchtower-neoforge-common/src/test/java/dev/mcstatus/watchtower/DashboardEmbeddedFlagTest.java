package dev.mcstatus.watchtower;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class DashboardEmbeddedFlagTest {

    @Test
    void injectsEmbeddedWhenHtmlHasSkinAttr() {
        String src = "<!DOCTYPE html>\n<html lang=\"en\" data-theme=\"dark\" data-skin=\"aero\">\n<head>";
        String out = DashboardHttpServer.injectEmbeddedFlag(src);
        assertTrue(out.contains("data-embedded=\"true\""), out);
        assertTrue(out.contains("data-skin=\"aero\""), out);
    }

    @Test
    void injectsEmbeddedOnMinimalHtmlTag() {
        String src = "<html lang=\"en\" data-theme=\"dark\">";
        String out = DashboardHttpServer.injectEmbeddedFlag(src);
        assertTrue(out.contains("data-embedded=\"true\""), out);
    }

    @Test
    void doesNotDuplicateEmbeddedFlag() {
        String src = "<html lang=\"en\" data-theme=\"dark\" data-embedded=\"true\">";
        String out = DashboardHttpServer.injectEmbeddedFlag(src);
        assertTrue(out.contains("data-embedded=\"true\""));
        assertFalse(out.contains("data-embedded=\"true\" data-embedded=\"true\""));
    }
}
