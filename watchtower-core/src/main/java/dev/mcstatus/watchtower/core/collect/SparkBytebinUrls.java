package dev.mcstatus.watchtower.core.collect;

import java.util.regex.Pattern;

/**
 * spark.lucko.me links for bytebin-style Spark export filenames.
 */
public final class SparkBytebinUrls {

    private static final Pattern SAMPLER_KEY = Pattern.compile("^[A-Za-z0-9]{10}\\.sparkprofile$");
    private static final Pattern HEAP_KEY = Pattern.compile("^[A-Za-z0-9]{10}\\.sparkheap$");

    private SparkBytebinUrls() {
    }

    public static String viewerUrl(String sourceFile) {
        String key = bytebinKey(sourceFile, SAMPLER_KEY, ".sparkprofile");
        return key != null ? "https://spark.lucko.me/" + key : null;
    }

    public static String rawJsonUrl(String sourceFile) {
        String key = bytebinKey(sourceFile, SAMPLER_KEY, ".sparkprofile");
        return key != null ? "https://spark.lucko.me/" + key + "?raw=1" : null;
    }

    public static String heapViewerUrl(String sourceFile) {
        String key = bytebinKey(sourceFile, HEAP_KEY, ".sparkheap");
        return key != null ? "https://spark.lucko.me/" + key : null;
    }

    private static String bytebinKey(String sourceFile, Pattern pattern, String suffix) {
        if (sourceFile == null || !pattern.matcher(sourceFile).matches()) {
            return null;
        }
        return sourceFile.substring(0, sourceFile.length() - suffix.length());
    }
}
