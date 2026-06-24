package dev.mcstatus.watchtower.core.collect;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class SparkBytebinUrlsTest {

    @Test
    void buildsViewerAndRawUrlsForSampler() {
        assertEquals("https://spark.lucko.me/H5BVV4Annz",
                SparkBytebinUrls.viewerUrl("H5BVV4Annz.sparkprofile"));
        assertEquals("https://spark.lucko.me/H5BVV4Annz?raw=1",
                SparkBytebinUrls.rawJsonUrl("H5BVV4Annz.sparkprofile"));
    }

    @Test
    void buildsHeapViewerUrl() {
        assertEquals("https://spark.lucko.me/H5BVV4Annz",
                SparkBytebinUrls.heapViewerUrl("H5BVV4Annz.sparkheap"));
    }

    @Test
    void ignoresNonBytebinNames() {
        assertNull(SparkBytebinUrls.viewerUrl("profile-2026.sparkprofile"));
        assertNull(SparkBytebinUrls.heapViewerUrl("heap.dump"));
    }
}
