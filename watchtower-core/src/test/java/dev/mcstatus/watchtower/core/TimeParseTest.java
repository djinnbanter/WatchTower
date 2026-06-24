package dev.mcstatus.watchtower.core;

import dev.mcstatus.watchtower.core.util.TimeParse;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;

import static org.junit.jupiter.api.Assertions.*;

class TimeParseTest {

  private static final DateTimeFormatter FMT_OUT =
      DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

  @Test
  void fmtTimeUsesSystemDefaultZone() {
    String iso = "2026-06-16T20:28:36+01:00";
    Instant instant = TimeParse.parseTime(iso);
    assertNotNull(instant);
    String local = TimeParse.fmtTime(iso);
    String expectedLocal = FMT_OUT.format(instant.atZone(ZoneId.systemDefault()));
    assertEquals(expectedLocal, local);
  }

  @Test
  void parseTimeRespectsOffset() {
    String iso = "2026-06-16T20:28:36+01:00";
    Instant instant = TimeParse.parseTime(iso);
    assertNotNull(instant);
    assertEquals("2026-06-16 19:28:36", FMT_OUT.format(instant.atZone(ZoneOffset.UTC)));
  }
}
