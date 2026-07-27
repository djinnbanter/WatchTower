package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonObject;

/**
 * A {@code .sparkprofile} candidate that was found on disk but could not be listed.
 */
public record SparkSkippedProfile(String sourcePath, String reason) {

    public static final String REASON_UNREADABLE = "unreadable";
    public static final String REASON_NO_METADATA = "no_metadata";
    public static final String REASON_IO_ERROR = "io_error";

    public JsonObject toJson() {
        JsonObject out = new JsonObject();
        out.addProperty("source_path", sourcePath);
        out.addProperty("reason", reason);
        return out;
    }
}
