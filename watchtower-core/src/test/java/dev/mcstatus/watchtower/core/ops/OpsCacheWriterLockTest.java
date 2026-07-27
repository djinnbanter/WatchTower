package dev.mcstatus.watchtower.core.ops;

import com.google.gson.JsonObject;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Concurrent load→mutate→write on ops-cache must not drop sibling keys.
 */
class OpsCacheWriterLockTest {

    @TempDir
    Path temp;

    @Test
    void concurrentDiskAndBackupWritesPreserveBothKeys() throws Exception {
        Path ops = temp.resolve("ops-cache.json");
        Path state = temp.resolve(".watchtower-state.json");

        int threads = 8;
        int rounds = 20;
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        CountDownLatch start = new CountDownLatch(1);
        AtomicInteger failures = new AtomicInteger();
        List<Future<?>> futures = new ArrayList<>();

        for (int t = 0; t < threads; t++) {
            final int id = t;
            futures.add(pool.submit(() -> {
                try {
                    start.await();
                    for (int i = 0; i < rounds; i++) {
                        if ((id + i) % 2 == 0) {
                            JsonObject jump = new JsonObject();
                            jump.addProperty("active", true);
                            jump.addProperty("message", "jump-" + id + "-" + i);
                            OpsCacheWriter.applyDiskJump(ops, state, jump);
                        } else {
                            JsonObject last = new JsonObject();
                            last.addProperty("status", "success");
                            last.addProperty("age_hours", 1.0);
                            OpsCacheWriter.applyBackupsLive(ops, state, last, null);
                        }
                    }
                } catch (Exception e) {
                    failures.incrementAndGet();
                    throw new RuntimeException(e);
                }
            }));
        }

        start.countDown();
        for (Future<?> f : futures) {
            f.get(60, TimeUnit.SECONDS);
        }
        pool.shutdown();
        assertEquals(0, failures.get());

        JsonObject cache = OpsCacheReader.load(ops);
        assertTrue(cache.has(OpsCacheSchema.DISK_JUMP), "disk_jump must survive concurrent writers");
        assertTrue(cache.has(OpsCacheSchema.BACKUPS_LIVE), "backups_live must survive concurrent writers");
    }
}
