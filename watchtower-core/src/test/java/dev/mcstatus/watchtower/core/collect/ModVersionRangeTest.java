package dev.mcstatus.watchtower.core.collect;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class ModVersionRangeTest {

    @Test
    void openUpperBoundInclusiveLower() {
        ModVersionRange range = ModVersionRange.parse("[1.2.0,)");
        assertFalse(range.unparseable());
        assertEquals(ModVersionRange.Match.SATISFIED, range.contains("1.2.0"));
        assertEquals(ModVersionRange.Match.SATISFIED, range.contains("1.3.1"));
        assertEquals(ModVersionRange.Match.NOT_SATISFIED, range.contains("1.1.9"));
    }

    @Test
    void exclusiveLowerInclusiveUpper() {
        ModVersionRange range = ModVersionRange.parse("(1.0,2.0]");
        assertEquals(ModVersionRange.Match.NOT_SATISFIED, range.contains("1.0"));
        assertEquals(ModVersionRange.Match.SATISFIED, range.contains("1.5"));
        assertEquals(ModVersionRange.Match.SATISFIED, range.contains("2.0"));
        assertEquals(ModVersionRange.Match.NOT_SATISFIED, range.contains("2.1"));
    }

    @Test
    void exactVersion() {
        ModVersionRange range = ModVersionRange.parse("6.0.1");
        assertEquals(ModVersionRange.Match.SATISFIED, range.contains("6.0.1"));
        assertEquals(ModVersionRange.Match.NOT_SATISFIED, range.contains("6.0.0"));
    }

    @Test
    void unionOfRanges() {
        ModVersionRange range = ModVersionRange.parse("[1.0,1.5),[2.0,)");
        assertEquals(ModVersionRange.Match.SATISFIED, range.contains("1.2"));
        assertEquals(ModVersionRange.Match.NOT_SATISFIED, range.contains("1.7"));
        assertEquals(ModVersionRange.Match.SATISFIED, range.contains("2.1"));
    }

    @Test
    void blankOrGarbageIsUnknown() {
        assertTrue(ModVersionRange.parse(null).unparseable());
        assertTrue(ModVersionRange.parse("").unparseable());
        assertTrue(ModVersionRange.parse("[___,)").unparseable());
        assertEquals(ModVersionRange.Match.UNKNOWN, ModVersionRange.parse("[1.0,)").contains("?"));
        assertEquals(ModVersionRange.Match.UNKNOWN, ModVersionRange.parse("[1.0,)").contains(null));
    }
}
